// src/core/MusicService.js
//
// Reproductor de música de Vesper.
//
// Antes esto hablaba con Lavalink, un servidor de Java que hay que arrancar
// aparte. En un alojamiento donde solo se ejecuta el bot —Render, Railway y
// parecidos— ese servidor no existe, así que la música nunca llegaba a
// funcionar: el bot intentaba conectarse a 127.0.0.1:2333 una y otra vez
// contra nada.
//
// Ahora todo ocurre dentro de este mismo proceso:
//   · yt-dlp busca la canción y da la dirección del audio,
//   · ffmpeg lo convierte a Opus, que es lo que Discord quiere,
//   · @discordjs/voice lo manda al canal de voz.
//
// Las dos herramientas vienen instaladas con el bot, así que no hay que
// levantar ningún servicio extra ni pagar nada.

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  entersState,
  getVoiceConnection
} = require('@discordjs/voice');
const { PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../database/mongoManager');
const { isModuleEnabledConfig, featureAvailable } = require('../config/guildPolicy');
const sources = require('./music/sources');

const DEFAULTS = Object.freeze({
  volume: 50,
  maxQueue: 100,
  maxPerUser: 3,
  maxTrackMinutes: 15,
  idleSeconds: 180
});

function sessionDefaults(config = {}) {
  return {
    voiceChannelId: null,
    textChannelId: null,
    queue: [],
    current: null,
    volume: Number(config.defaultVolume || DEFAULTS.volume),
    loop: false,
    skipVotes: new Set(),
    idleTimer: null,
    startedAt: 0,
    pausedAt: 0,
    elapsedBeforeSeek: 0,
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

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (!total) return 'en directo';
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

// Cada pista lleva también un `info` con la forma antigua, para que los
// comandos y las pruebas que ya existían sigan funcionando sin tocarlos.
function withLegacyShape(track) {
  return {
    ...track,
    info: {
      title: track.title,
      author: track.author,
      uri: track.pageUrl,
      identifier: track.pageUrl,
      length: Math.round((Number(track.duration) || 0) * 1000),
      isStream: Boolean(track.live)
    }
  };
}

class MusicService {
  constructor(client) {
    this.client = client;
    this.players = new Map();
    this.connections = new Map();
    this.lastError = null;
    this.started = false;
    this.tools = sources.toolCheck();
  }

  async start() {
    if (this.started) return;
    this.started = true;
    this.tools = sources.toolCheck();
    this.client.on?.('voiceStateUpdate', (oldState, newState) => {
      const guildId = newState.guild?.id || oldState.guild?.id;
      if (guildId) setTimeout(() => this.checkAudience(guildId), 1000);
    });
  }

  // Si falta alguna herramienta, se dice antes de que nadie escriba un
  // comando y con la solución incluida.
  unavailableExplanation() {
    if (this.tools.ok) return null;
    const nombres = { ytdlp: 'yt-dlp', ffmpeg: 'ffmpeg' };
    const faltan = this.tools.missing.map(name => nombres[name] || name);
    return this.tools.missing.includes('ytdlp')
      ? `Falta ${faltan.join(' y ')}. Ejecuta "npm run music:setup" en el alojamiento para descargarlo; el resto del bot funciona igual.`
      : `Falta ${faltan.join(' y ')}. Vuelve a instalar las dependencias con "npm install".`;
  }

  status() {
    const reason = this.unavailableExplanation();
    return {
      engine: 'integrado',
      configured: this.tools.ok,
      connected: this.tools.ok,
      available: this.tools.ok,
      reason,
      players: this.players.size,
      playing: [...this.players.values()].filter(player => player.current).length,
      ytdlp: this.tools.ytdlp,
      ffmpeg: this.tools.ffmpeg,
      lastError: this.lastError
    };
  }

  // Se conserva por compatibilidad: ya no hay ningún servidor al que esperar.
  async waitUntilReady() {
    const reason = this.unavailableExplanation();
    if (reason) throw new Error(reason);
    return true;
  }

  async ensureAllowed(interaction) {
    const config = await getGuildConfig(interaction.guildId);
    if (!isModuleEnabledConfig(config, 'music', interaction.guildId)) {
      throw new Error(featureAvailable('music', interaction.guildId, config)
        ? 'El módulo de música está desactivado para este servidor'
        : 'La música forma parte del plan premium. Este servidor todavía no lo tiene.');
    }
    const reason = this.unavailableExplanation();
    if (reason) throw new Error(reason);

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

    if (!this.connections.has(guild.id)) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false
      });

      const audio = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
      connection.subscribe(audio);

      // Discord mueve las conexiones de voz entre servidores de vez en cuando.
      // Sin esto, el bot se quedaba mudo y no volvía solo.
      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
          ]);
        } catch {
          this.stop(guild.id).catch(() => null);
        }
      });

      audio.on(AudioPlayerStatus.Idle, () => { this.advance(guild.id).catch(() => null); });
      audio.on('error', error => {
        this.lastError = error.message;
        this.advance(guild.id).catch(() => null);
      });

      this.connections.set(guild.id, { connection, audio });

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
      } catch {
        this.stop(guild.id).catch(() => null);
        throw new Error('No pude entrar al canal de voz. Comprueba los permisos y vuelve a intentarlo.');
      }
    }

    return player;
  }

  async enqueue(interaction, query) {
    const { config, voiceChannel } = await this.ensureAllowed(interaction);
    const player = await this.join(interaction.guild, voiceChannel, interaction.channelId, config.music || {});
    const maxQueue = Number(player.settings.maxQueue || DEFAULTS.maxQueue);
    const maxPerUser = Number(player.settings.maxPerUser || DEFAULTS.maxPerUser);
    if (player.queue.length >= maxQueue) throw new Error(`La cola alcanzó su límite de ${maxQueue} canciones`);
    const pending = player.queue.filter(item => item.requesterId === interaction.user.id).length;
    if (pending >= maxPerUser) throw new Error(`Cada usuario puede tener máximo ${maxPerUser} canciones pendientes`);

    const track = await this.loadTrack(query);
    if (!track) throw new Error('No encontré una canción para esa búsqueda');
    const info = track.info || {};
    if (info.isStream && player.settings.allowLive === false) throw new Error('Los directos están desactivados en el reproductor');
    const maxLength = Number(player.settings.maxTrackMinutes || DEFAULTS.maxTrackMinutes) * 60 * 1000;
    if (!info.isStream && Number(info.length || 0) > maxLength) {
      throw new Error(`La canción supera el máximo de ${player.settings.maxTrackMinutes || DEFAULTS.maxTrackMinutes} minutos`);
    }
    const trackUri = info.uri || info.identifier;
    const duplicate = [player.current, ...player.queue].some(item => (item?.info?.uri || item?.info?.identifier) === trackUri);
    if (trackUri && duplicate) throw new Error('Esa canción ya está en reproducción o en la cola');

    const item = { ...track, requesterId: interaction.user.id };
    player.queue.push(item);
    if (!player.current) await this.advance(interaction.guildId);
    return { item, position: player.current === item ? 0 : player.queue.indexOf(item) + 1 };
  }

  async loadTrack(query) {
    const [track] = await sources.search(query, { limit: 1 });
    return track ? withLegacyShape(track) : null;
  }

  // Pone a sonar lo que toque. Si una pista falla —caducó el enlace, el vídeo
  // se borró— se salta y se sigue con la siguiente en vez de dejar la sesión
  // colgada en silencio.
  async advance(guildId) {
    const player = this.players.get(guildId);
    if (!player) return;
    if (player.idleTimer) clearTimeout(player.idleTimer);
    player.idleTimer = null;
    if (player.loop && player.current) player.queue.unshift(player.current);
    player.current = player.queue.shift() || null;
    player.skipVotes.clear();
    player.elapsedBeforeSeek = 0;

    if (!player.current) {
      const seconds = Number(player.settings.idleSeconds || DEFAULTS.idleSeconds);
      player.idleTimer = setTimeout(() => this.stop(guildId).catch(() => null), seconds * 1000);
      return;
    }

    try {
      await this.playCurrent(guildId);
    } catch (error) {
      this.lastError = error.message;
      this.announce(player, `⚠️ No pude reproducir **${player.current?.title || 'esa canción'}**: ${error.message}`);
      player.loop = false;
      await this.advance(guildId);
    }
  }

  // Arranca ffmpeg sobre la pista actual y se lo pasa a Discord. `seek` sirve
  // para retomar donde iba al cambiar el volumen.
  async playCurrent(guildId, seekSeconds = 0) {
    const player = this.players.get(guildId);
    const session = this.connections.get(guildId);
    if (!player?.current || !session) return;

    const url = await sources.resolveStream(player.current);
    const handle = sources.openStream(url, {
      seekSeconds,
      volume: player.volume,
      live: Boolean(player.current.live)
    });

    const resource = createAudioResource(handle.stream, { inputType: StreamType.OggOpus });
    player.process?.kill?.('SIGKILL');
    player.process = handle.process;
    player.startedAt = Date.now();
    player.pausedAt = 0;
    player.elapsedBeforeSeek = seekSeconds;
    session.audio.play(resource);
  }

  // Segundos reproducidos de la canción actual.
  elapsed(player) {
    if (!player?.startedAt) return 0;
    const reference = player.pausedAt || Date.now();
    return player.elapsedBeforeSeek + Math.max(0, Math.floor((reference - player.startedAt) / 1000));
  }

  announce(player, text) {
    const channel = player?.textChannelId && this.client.channels?.cache?.get(player.textChannelId);
    if (channel?.send) channel.send({ content: text, allowedMentions: { parse: [] } }).catch(() => null);
  }

  checkAudience(guildId) {
    const player = this.players.get(guildId);
    if (!player?.voiceChannelId) return;
    const channel = this.client.guilds?.cache?.get(guildId)?.channels?.cache?.get(player.voiceChannelId);
    const listeners = channel?.members?.filter(member => !member.user.bot).size || 0;
    if (listeners > 0 && player.current) {
      if (player.idleTimer) clearTimeout(player.idleTimer);
      player.idleTimer = null;
      return;
    }
    if (!player.idleTimer) {
      const seconds = Number(player.settings.idleSeconds || DEFAULTS.idleSeconds);
      player.idleTimer = setTimeout(() => this.stop(guildId).catch(() => null), seconds * 1000);
    }
  }

  async pause(guildId, paused) {
    const player = this.players.get(guildId);
    const session = this.connections.get(guildId);
    if (!player?.current || !session) throw new Error('No hay una canción reproduciéndose');
    if (paused) {
      session.audio.pause();
      player.pausedAt = Date.now();
    } else {
      session.audio.unpause();
      if (player.pausedAt) {
        player.startedAt += Date.now() - player.pausedAt;
        player.pausedAt = 0;
      }
    }
  }

  async skip(guildId) {
    const player = this.players.get(guildId);
    if (!player?.current) throw new Error('No hay una canción reproduciéndose');
    player.loop = false;
    const session = this.connections.get(guildId);
    // `stop` deja el reproductor en reposo y eso dispara el paso a la
    // siguiente, sin necesidad de llamar a `advance` por nuestra cuenta.
    if (session) session.audio.stop(true);
    else await this.advance(guildId);
  }

  // El volumen va dentro de ffmpeg, así que cambiarlo significa volver a
  // arrancarlo. Se retoma en el segundo exacto en el que iba, de modo que
  // desde fuera solo se nota un pequeño salto.
  async setVolume(guildId, volume) {
    const player = this.players.get(guildId);
    if (!player) throw new Error('No hay una sesión de música');
    player.volume = Math.max(1, Math.min(100, Number(volume) || DEFAULTS.volume));
    if (player.current && !player.current.live) await this.playCurrent(guildId, this.elapsed(player));
    return player.volume;
  }

  queue(guildId) {
    return this.players.get(guildId) || null;
  }

  async stop(guildId) {
    const player = this.players.get(guildId);
    const session = this.connections.get(guildId);
    if (player?.idleTimer) clearTimeout(player.idleTimer);
    player?.process?.kill?.('SIGKILL');
    if (session) {
      session.audio.stop(true);
      try { session.connection.destroy(); } catch { /* ya estaba cerrada */ }
    } else {
      try { getVoiceConnection(guildId)?.destroy(); } catch { /* nada que cerrar */ }
    }
    this.connections.delete(guildId);
    this.players.delete(guildId);
  }

  async shutdown() {
    this.started = false;
    await Promise.all([...this.players.keys()].map(guildId => this.stop(guildId).catch(() => null)));
  }
}

module.exports = {
  MusicService,
  sessionDefaults,
  voicePermissionIssues,
  withLegacyShape,
  formatDuration,
  DEFAULTS
};
