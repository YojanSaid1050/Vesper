const WebSocket = require('ws');
const { GatewayOpcodes, GatewayDispatchEvents, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../database/mongoManager');
const { isModuleEnabledConfig } = require('../config/guildPolicy');

function normalizeLavalinkUrl(value) {
  return String(value || '')
    .trim()
    .replace(/^ws:/i, 'http:')
    .replace(/^wss:/i, 'https:')
    .replace(/\/+$/, '');
}

function lavalinkConfig() {
  const embedded = String(process.env.LAVALINK_EMBEDDED || '').toLowerCase() === 'true';
  const rawUrl = normalizeLavalinkUrl(process.env.LAVALINK_URL || (embedded ? 'http://127.0.0.1:2333' : ''));
  return {
    url: rawUrl,
    password: process.env.LAVALINK_PASSWORD || '',
    configured: Boolean(rawUrl && process.env.LAVALINK_PASSWORD),
    mode: embedded ? 'integrado' : 'externo'
  };
}

function wsUrl(httpUrl) {
  return httpUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + '/v4/websocket';
}

function reconnectDelay(attempt) {
  const base = Math.min(60_000, 2_000 * (2 ** Math.max(0, attempt)));
  return base + Math.floor(Math.random() * Math.max(250, base * 0.2));
}

function sessionDefaults(config = {}) {
  return {
    voiceChannelId: null,
    textChannelId: null,
    queue: [],
    current: null,
    volume: Number(config.defaultVolume || 50),
    loop: false,
    skipVotes: new Set(),
    idleTimer: null,
    settings: config
  };
}

function voicePermissionIssues(guild, voiceChannel) {
  const me = guild?.members?.me;
  const permissions = me && voiceChannel?.permissionsFor?.(me);
  if (!permissions) return ['No pude comprobar los permisos del bot en el canal'];

  const required = [
    [PermissionFlagsBits.ViewChannel, 'Ver canal'],
    [PermissionFlagsBits.Connect, 'Conectar'],
    [PermissionFlagsBits.Speak, 'Hablar']
  ];
  return required.filter(([permission]) => !permissions.has(permission)).map(([, label]) => label);
}

class MusicService {
  constructor(client) {
    this.client = client;
    this.socket = null;
    this.sessionId = null;
    this.resumeSessionId = null;
    this.players = new Map();
    this.voiceStates = new Map();
    this.reconnectTimer = null;
    this.lastError = null;
    this.started = false;
    this.reconnectAttempts = 0;
  }

  async start() {
    if (this.started) return;
    this.started = true;
    this.client.ws.on(GatewayDispatchEvents.VoiceServerUpdate, data => this.receiveVoiceServer(data));
    this.client.ws.on(GatewayDispatchEvents.VoiceStateUpdate, data => this.receiveVoiceState(data));
    this.client.on('voiceStateUpdate', (oldState, newState) => {
      const guildId = newState.guild?.id || oldState.guild?.id;
      if (guildId) setTimeout(() => this.checkAudience(guildId), 1000);
    });
    if (lavalinkConfig().configured) this.connect();
  }

  connect() {
    const config = lavalinkConfig();
    if (!config.configured || !this.client.user || [WebSocket.OPEN, WebSocket.CONNECTING].includes(this.socket?.readyState)) return;
    const headers = {
      Authorization: config.password,
      'User-Id': this.client.user.id,
      'Client-Name': 'Vesper/2.8.1'
    };
    if (this.resumeSessionId) headers['Session-Id'] = this.resumeSessionId;
    this.socket = new WebSocket(wsUrl(config.url), {
      headers
    });
    this.socket.on('message', data => {
      try {
        const payload = JSON.parse(String(data));
        Promise.resolve(this.handlePayload(payload)).catch(error => { this.lastError = error.message; });
      } catch (error) {
        this.lastError = `Respuesta Lavalink inválida: ${error.message}`;
      }
    });
    this.socket.on('error', error => { this.lastError = error.message; });
    this.socket.on('close', () => {
      if (this.sessionId) this.resumeSessionId = this.sessionId;
      this.sessionId = null;
      this.socket = null;
      if (this.started && !this.reconnectTimer) {
        const delay = reconnectDelay(this.reconnectAttempts++);
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, delay);
      }
    });
  }

  async handlePayload(payload) {
    if (payload.op === 'ready') {
      this.sessionId = payload.sessionId;
      this.resumeSessionId = payload.sessionId;
      this.reconnectAttempts = 0;
      this.lastError = null;
      await this.request(`/v4/sessions/${this.sessionId}`, {
        method: 'PATCH',
        body: { resuming: true, timeout: 60 }
      }).catch(() => null);
      for (const guildId of this.voiceStates.keys()) await this.syncVoice(guildId).catch(() => null);
      return;
    }
    if (payload.op !== 'event') return;
    if (payload.type === 'TrackEndEvent' && payload.reason !== 'replaced') await this.advance(payload.guildId);
    if (payload.type === 'TrackExceptionEvent' || payload.type === 'TrackStuckEvent') await this.advance(payload.guildId);
    if (payload.type === 'WebSocketClosedEvent' && payload.code >= 4000) this.lastError = `Voice WebSocket ${payload.code}: ${payload.reason || 'cerrado'}`;
  }

  receiveVoiceServer(data) {
    const state = this.voiceStates.get(data.guild_id) || {};
    state.token = data.token;
    state.endpoint = data.endpoint;
    this.voiceStates.set(data.guild_id, state);
    this.syncVoice(data.guild_id).catch(error => { this.lastError = error.message; });
  }

  receiveVoiceState(data) {
    if (data.user_id !== this.client.user?.id) return;
    const state = this.voiceStates.get(data.guild_id) || {};
    state.sessionId = data.session_id;
    state.channelId = data.channel_id;
    this.voiceStates.set(data.guild_id, state);
    this.syncVoice(data.guild_id).catch(error => { this.lastError = error.message; });
  }

  async syncVoice(guildId) {
    const voice = this.voiceStates.get(guildId);
    if (!this.sessionId || !voice?.token || !voice?.endpoint || !voice?.sessionId) return false;
    await this.updatePlayer(guildId, {
      voice: { token: voice.token, endpoint: voice.endpoint, sessionId: voice.sessionId, channelId: voice.channelId },
      volume: this.players.get(guildId)?.volume || 50
    });
    return true;
  }

  async request(path, { method = 'GET', body } = {}) {
    const config = lavalinkConfig();
    if (!config.configured) throw new Error('Lavalink no está configurado');
    const timeoutMs = Math.max(1_000, Number(process.env.LAVALINK_REQUEST_TIMEOUT_MS || 15_000));
    const response = await fetch(`${config.url}${path}`, {
      method,
      headers: {
        Authorization: config.password,
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      const detail = String(await response.text().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 180);
      throw new Error(`Lavalink respondió HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async updatePlayer(guildId, body) {
    if (!this.sessionId) throw new Error('Lavalink todavía no está conectado');
    return this.request(`/v4/sessions/${this.sessionId}/players/${guildId}?noReplace=false`, { method: 'PATCH', body });
  }

  async loadTrack(query) {
    let identifier = `ytsearch:${query}`;
    if (/^https?:\/\//i.test(query)) {
      const url = new URL(query);
      const domain = url.hostname.toLowerCase().replace(/^www\./, '');
      if (domain === 'spotify.com' || domain.endsWith('.spotify.com')) {
        throw new Error('Spotify no entrega audio directo. Busca la canción por título y artista');
      }
      const allowed = ['youtube.com', 'youtu.be', 'music.youtube.com', 'soundcloud.com'];
      if (!allowed.some(host => domain === host || domain.endsWith(`.${host}`))) {
        throw new Error('Solo se aceptan búsquedas, enlaces de YouTube o enlaces de SoundCloud');
      }
      identifier = query;
    }
    const result = await this.request(`/v4/loadtracks?identifier=${encodeURIComponent(identifier)}`);
    if (result.loadType === 'error') throw new Error(result.data?.message || 'No fue posible cargar la canción');
    if (result.loadType === 'empty') return null;
    if (result.loadType === 'track') return result.data;
    if (result.loadType === 'playlist') return result.data?.tracks?.[0] || null;
    return Array.isArray(result.data) ? result.data[0] : null;
  }

  async ensureAllowed(interaction) {
    const config = await getGuildConfig(interaction.guildId);
    if (!isModuleEnabledConfig(config, 'music')) throw new Error('El módulo de música está desactivado para este servidor');
    if (!lavalinkConfig().configured) throw new Error('Lavalink no está configurado en el alojamiento');
    if (!this.sessionId) await this.waitUntilReady();
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) throw new Error('Debes estar en un canal de voz');
    if (config.music?.preferredVoiceChannel && voiceChannel.id !== config.music.preferredVoiceChannel) {
      throw new Error(`La música de este servidor está configurada para <#${config.music.preferredVoiceChannel}>`);
    }
    const missingPermissions = voicePermissionIssues(interaction.guild, voiceChannel);
    if (missingPermissions.length) throw new Error(`A Vesper le faltan permisos en ${voiceChannel}: ${missingPermissions.join(', ')}`);
    const alreadyInside = interaction.guild?.members?.me?.voice?.channelId === voiceChannel.id;
    if (!alreadyInside && voiceChannel.userLimit > 0 && voiceChannel.members?.size >= voiceChannel.userLimit) {
      throw new Error(`El canal ${voiceChannel} está lleno`);
    }
    if (config.music?.requestChannel && interaction.channelId !== config.music.requestChannel) {
      throw new Error(`Las solicitudes de música solo se aceptan en <#${config.music.requestChannel}>`);
    }
    return { config, voiceChannel };
  }

  async waitUntilReady(timeoutMs = 10_000) {
    if (this.sessionId) return true;
    this.connect();
    const deadline = Date.now() + Math.max(250, Number(timeoutMs) || 10_000);
    while (Date.now() < deadline) {
      if (this.sessionId) return true;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    const detail = this.lastError ? ` Último error: ${this.lastError}` : '';
    throw new Error(`El servidor de música no respondió a tiempo.${detail}`);
  }

  async join(guild, voiceChannel, textChannelId, musicConfig) {
    let player = this.players.get(guild.id);
    if (player?.voiceChannelId && player.voiceChannelId !== voiceChannel.id) {
      throw new Error(`Vesper ya está reproduciendo en <#${player.voiceChannelId}>`);
    }
    if (!player) {
      player = sessionDefaults(musicConfig);
      this.players.set(guild.id, player);
    }
    player.voiceChannelId = voiceChannel.id;
    player.textChannelId = textChannelId;
    guild.shard.send({
      op: GatewayOpcodes.VoiceStateUpdate,
      d: { guild_id: guild.id, channel_id: voiceChannel.id, self_mute: false, self_deaf: true }
    });
    return player;
  }

  async enqueue(interaction, query) {
    const { config, voiceChannel } = await this.ensureAllowed(interaction);
    const player = await this.join(interaction.guild, voiceChannel, interaction.channelId, config.music || {});
    const maxQueue = Number(player.settings.maxQueue || 100);
    const maxPerUser = Number(player.settings.maxPerUser || 3);
    if (player.queue.length >= maxQueue) throw new Error(`La cola alcanzó su límite de ${maxQueue} canciones`);
    const pending = player.queue.filter(item => item.requesterId === interaction.user.id).length;
    if (pending >= maxPerUser) throw new Error(`Cada usuario puede tener máximo ${maxPerUser} canciones pendientes`);

    const track = await this.loadTrack(query);
    if (!track) throw new Error('No encontré una canción para esa búsqueda');
    const info = track.info || {};
    if (info.isStream) throw new Error('Los directos están desactivados en el reproductor');
    const maxLength = Number(player.settings.maxTrackMinutes || 15) * 60 * 1000;
    if (Number(info.length || 0) > maxLength) throw new Error(`La canción supera el máximo de ${player.settings.maxTrackMinutes || 15} minutos`);
    const trackUri = info.uri || info.identifier;
    const duplicate = [player.current, ...player.queue].some(item => (item?.info?.uri || item?.info?.identifier) === trackUri);
    if (trackUri && duplicate) throw new Error('Esa canción ya está en reproducción o en la cola');
    const item = { ...track, requesterId: interaction.user.id };
    player.queue.push(item);
    if (!player.current) await this.advance(interaction.guildId);
    return { item, position: player.current === item ? 0 : player.queue.indexOf(item) + 1 };
  }

  async advance(guildId) {
    const player = this.players.get(guildId);
    if (!player) return;
    if (player.idleTimer) clearTimeout(player.idleTimer);
    if (player.loop && player.current) player.queue.unshift(player.current);
    player.current = player.queue.shift() || null;
    player.skipVotes.clear();
    if (player.current) {
      await this.updatePlayer(guildId, { track: { encoded: player.current.encoded }, volume: player.volume, paused: false });
      return;
    }
    const seconds = Number(player.settings.idleSeconds || 180);
    player.idleTimer = setTimeout(() => this.stop(guildId).catch(() => null), seconds * 1000);
  }

  checkAudience(guildId) {
    const player = this.players.get(guildId);
    if (!player?.voiceChannelId) return;
    const channel = this.client.guilds.cache.get(guildId)?.channels.cache.get(player.voiceChannelId);
    const listeners = channel?.members?.filter(member => !member.user.bot).size || 0;
    if (listeners > 0 && player.current) {
      if (player.idleTimer) clearTimeout(player.idleTimer);
      player.idleTimer = null;
      return;
    }
    if (!player.idleTimer) {
      const seconds = Number(player.settings.idleSeconds || 180);
      player.idleTimer = setTimeout(() => this.stop(guildId).catch(() => null), seconds * 1000);
    }
  }

  async pause(guildId, paused) {
    const player = this.players.get(guildId);
    if (!player?.current) throw new Error('No hay una canción reproduciéndose');
    await this.updatePlayer(guildId, { paused });
  }

  async skip(guildId) {
    const player = this.players.get(guildId);
    if (!player?.current) throw new Error('No hay una canción reproduciéndose');
    player.loop = false;
    await this.updatePlayer(guildId, { track: { encoded: null } });
  }

  async setVolume(guildId, volume) {
    const player = this.players.get(guildId);
    if (!player) throw new Error('No hay una sesión de música');
    player.volume = Math.max(1, Math.min(100, volume));
    await this.updatePlayer(guildId, { volume: player.volume });
  }

  async stop(guildId) {
    const player = this.players.get(guildId);
    if (player?.idleTimer) clearTimeout(player.idleTimer);
    if (this.sessionId) await this.request(`/v4/sessions/${this.sessionId}/players/${guildId}`, { method: 'DELETE' }).catch(() => null);
    const guild = this.client.guilds.cache.get(guildId);
    if (guild) guild.shard.send({ op: GatewayOpcodes.VoiceStateUpdate, d: { guild_id: guildId, channel_id: null, self_mute: false, self_deaf: true } });
    this.players.delete(guildId);
    this.voiceStates.delete(guildId);
  }

  queue(guildId) {
    const player = this.players.get(guildId);
    return player ? { current: player.current, queue: [...player.queue], volume: player.volume, loop: player.loop, voiceChannelId: player.voiceChannelId } : null;
  }

  status() {
    const config = lavalinkConfig();
    return {
      configured: config.configured,
      connected: Boolean(this.sessionId && this.socket?.readyState === WebSocket.OPEN),
      mode: config.mode,
      players: this.players.size,
      reconnectAttempts: this.reconnectAttempts,
      lastError: this.lastError
    };
  }

  async shutdown() {
    this.started = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await Promise.all([...this.players.keys()].map(guildId => this.stop(guildId)));
    this.socket?.close();
    this.socket = null;
    this.sessionId = null;
    this.resumeSessionId = null;
  }
}

module.exports = { MusicService, lavalinkConfig, normalizeLavalinkUrl, wsUrl, reconnectDelay, sessionDefaults, voicePermissionIssues };
