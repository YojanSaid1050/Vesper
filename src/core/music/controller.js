// src/core/music/controller.js
//
// El controlador fijo del canal de música: un único mensaje que enseña qué
// suena y lleva los botones del reproductor DENTRO del bloque (Components
// V2). Mientras no suena nada invita a escribir el nombre o el enlace de una
// canción en ese canal, y cualquier mensaje que llegue allí se toma como una
// petición.
//
// Los textos salen del catálogo de mensajes (music_controller y
// music_playing), así que cada servidor lo ve con su paquete —Void en Embers
// Void, Limones en Ankerie Dimension— y se puede retocar desde el panel.

const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const { isModuleEnabledConfig } = require('../../config/guildPolicy');
const { buildMessage } = require('../EmbedCatalog');
const { sendBrandedMessage, editBrandedMessage, deleteBrandedMessage, sendTemporaryBranded } = require('../../utils/webhookSender');
const { CAPABILITIES, canWithGuildConfig } = require('../PermissionService');
const providers = require('./providers');

const ROW = 1;
const BUTTON = 2;
const TEXT = 10;
const SECTION = 9;
const THUMBNAIL = 11;
const SEPARATOR = 14;
const STYLE = { primary: 1, secondary: 2, success: 3, danger: 4, link: 5 };

const VOLUME_STEP = 10;
const refreshTimers = new Map();

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (!total) return 'en directo';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

// Los corchetes rompen el enlace Markdown [título](url).
function linkText(value) {
  return String(value || 'Canción').replace(/[[\]]/g, '').slice(0, 200);
}

function trackVars(player, guild) {
  const track = player.current;
  return {
    title: linkText(track.title),
    url: track.pageUrl || track.info?.uri || 'https://discord.com',
    author: String(track.author || 'Desconocido').slice(0, 100),
    duration: formatDuration(track.duration),
    requester: track.requesterId ? `<@${track.requesterId}>` : 'Vesper',
    source: providers.PROVIDER_LABELS[track.provider] || track.source || 'la web',
    volume: player.volume,
    queue: player.queue.length,
    loop: player.loop ? ' · en bucle' : '',
    server: guild?.name || ''
  };
}

function button(id, label, emoji, { style = STYLE.secondary, disabled = false } = {}) {
  return { type: BUTTON, custom_id: `music:${id}`, label, emoji: { name: emoji }, style, disabled };
}

function panelUrl() {
  const base = String(process.env.WEB_BASE_URL || '').trim().replace(/\/+$/, '');
  return /^https:\/\//.test(base) ? `${base}/panel` : null;
}

function controls(player, paused) {
  const playing = Boolean(player?.current);
  const off = !playing;
  const first = [
    button('voldown', 'Bajar', '🔉', { disabled: off }),
    button('previous', 'Anterior', '⏮️', { disabled: off || !player?.history?.length }),
    paused
      ? button('resume', 'Reanudar', '▶️', { style: STYLE.success, disabled: off })
      : button('pause', 'Pausar', '⏸️', { style: playing ? STYLE.success : STYLE.secondary, disabled: off }),
    button('skip', 'Saltar', '⏭️', { disabled: off }),
    button('volup', 'Subir', '🔊', { disabled: off })
  ];
  const url = panelUrl();
  const second = [
    button('shuffle', 'Mezclar', '🔀', { disabled: off || (player?.queue?.length || 0) < 2 }),
    button('loop', player?.loop ? 'Bucle activo' : 'Bucle', '🔁', { style: player?.loop ? STYLE.primary : STYLE.secondary, disabled: off }),
    button('stop', 'Detener', '⏹️', { style: STYLE.danger, disabled: off }),
    button('queue', 'Cola', '📜', { disabled: off }),
    url
      ? { type: BUTTON, style: STYLE.link, label: 'Panel', emoji: { name: '🧭' }, url }
      : button('help', 'Ayuda', '❔')
  ];
  return [{ type: ROW, components: first }, { type: ROW, components: second }];
}

/**
 * El mensaje completo del controlador. Sin `player` (o sin canción) sale en
 * espera; con canción, con la portada a la derecha del título.
 */
function controllerPayload({ guild, config, player = null, paused = false }) {
  const playing = Boolean(player?.current);
  const channelId = config?.music?.controllerChannel;
  const payload = playing
    ? buildMessage('music_playing', { config, vars: trackVars(player, guild) })
    : buildMessage('music_controller', {
      config,
      vars: { server: guild?.name || '', channel: channelId ? `<#${channelId}>` : 'este canal' }
    });

  const container = payload.components[0];
  const thumbnail = playing && /^https:\/\//.test(String(player.current.thumbnail || '')) ? player.current.thumbnail : null;
  if (thumbnail) {
    // La portada va junto al cuerpo del mensaje: el primer texto que no es
    // ni la línea pequeña de arriba ni el título.
    const parts = container.components;
    const index = parts.findIndex((part, position) => part.type === TEXT && position > 0 && !part.content.startsWith('-# '));
    const target = index >= 0 ? index : parts.findIndex(part => part.type === TEXT);
    if (target >= 0) {
      parts[target] = { type: SECTION, components: [parts[target]], accessory: { type: THUMBNAIL, media: { url: thumbnail } } };
    }
  }
  if (paused && playing) container.components.push({ type: TEXT, content: '-# ⏸️ En pausa' });
  container.components.push({ type: SEPARATOR, spacing: 1, divider: true }, ...controls(player, paused));
  return { flags: payload.flags, components: payload.components, allowedMentions: { parse: [] } };
}

async function fetchControllerMessage(client, config) {
  const music = config?.music || {};
  if (!music.controllerChannel || !music.controllerMessage) return null;
  const channel = client.channels?.cache?.get(music.controllerChannel)
    || await client.channels?.fetch?.(music.controllerChannel).catch(() => null);
  if (!channel?.messages) return null;
  return channel.messages.fetch(music.controllerMessage).catch(() => null);
}

async function refreshNow(client, guildId) {
  const config = await getGuildConfig(guildId);
  if (!config?.music?.controllerMessage) return false;
  const message = await fetchControllerMessage(client, config);
  if (!message) return false;
  const guild = client.guilds?.cache?.get(guildId) || message.guild;
  const player = client.music?.queue(guildId) || null;
  // Se edita por el webhook con el que se publicó (nombre y foto del servidor).
  await editBrandedMessage(message.channel, message.id, controllerPayload({ guild, config, player, paused: client.music?.paused(guildId) }));
  return true;
}

// Varios cambios seguidos (saltar + empezar la siguiente) se pintan de una
// vez, sin rozar el límite de ediciones de Discord.
function refreshController(client, guildId, delayMs = 800) {
  clearTimeout(refreshTimers.get(guildId));
  const timer = setTimeout(() => {
    refreshTimers.delete(guildId);
    refreshNow(client, guildId).catch(error => console.warn(`[Música] No pude actualizar el controlador de ${guildId}: ${error.message}`));
  }, delayMs);
  timer.unref?.();
  refreshTimers.set(guildId, timer);
}

// Publica (o vuelve a publicar) el controlador en un canal y lo deja como el
// canal donde se piden canciones escribiendo.
async function publishController(client, guildId, channelId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Vesper no está en ese servidor.');
  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.() || channel.isVoiceBased?.()) throw new Error('Elige un canal de texto.');
  const permissions = channel.permissionsFor(guild.members.me);
  const needed = [
    [PermissionFlagsBits.ViewChannel, 'Ver canal'],
    [PermissionFlagsBits.SendMessages, 'Enviar mensajes'],
    [PermissionFlagsBits.ReadMessageHistory, 'Leer el historial']
  ];
  const missing = needed.filter(([flag]) => !permissions?.has(flag)).map(([, label]) => label);
  if (missing.length) throw new Error(`A Vesper le falta en ${channel.name}: ${missing.join(', ')}.`);

  const config = await getGuildConfig(guildId);
  const previous = await fetchControllerMessage(client, config);
  const next = { ...config, music: { ...(config.music || {}), controllerChannel: channel.id } };
  // Con el webhook del servidor: sale con su nombre y su foto (AnkeBot en
  // Ankerie Dimension), no con la cuenta de Vesper.
  const message = await sendBrandedMessage(channel, controllerPayload({
    guild, config: next, player: client.music?.queue(guildId) || null, paused: client.music?.paused(guildId)
  }), { interactive: true, throwOnFailure: true });
  if (!message?.id) throw new Error('Discord no confirmó el mensaje del controlador.');
  await updateGuildSection(guildId, 'music', { controllerChannel: channel.id, controllerMessage: message.id });
  if (previous && previous.id !== message.id) await deleteBrandedMessage(previous.channel, previous.id).catch(() => null);
  // La sesión que ya estuviera sonando también tiene que saber dónde está.
  const player = client.music?.queue(guildId);
  if (player) player.settings = { ...player.settings, controllerChannel: channel.id };
  return { channelId: channel.id, messageId: message.id, canManageMessages: Boolean(permissions?.has(PermissionFlagsBits.ManageMessages)) };
}

async function removeController(client, guildId) {
  const config = await getGuildConfig(guildId);
  const message = await fetchControllerMessage(client, config);
  if (message) await deleteBrandedMessage(message.channel, message.id).catch(() => null);
  await updateGuildSection(guildId, 'music', { controllerChannel: null, controllerMessage: null });
}

/* ------------------------------------------------------------------ */
/* Peticiones escritas en el canal                                     */
/* ------------------------------------------------------------------ */

function temporary(channel, content, ms = 8_000) {
  return sendTemporaryBranded(channel, { content, allowedMentions: { parse: [] } }, ms).catch(() => null);
}

// Un mensaje escrito en el canal del controlador es una canción que pedir.
// Devuelve true si lo atendió (así no sigue a otros manejadores).
async function handleMusicRequest(message, client) {
  if (!message.guild || message.author?.bot || !client?.music) return false;
  const config = await getGuildConfig(message.guild.id).catch(() => null);
  if (!config?.music?.controllerChannel || config.music.controllerChannel !== message.channelId) return false;
  if (!isModuleEnabledConfig(config, 'music', message.guild.id)) return false;
  const query = String(message.content || '').trim();
  if (!query) return false;

  // El canal queda limpio: la petición se ve en el controlador.
  setTimeout(() => message.delete().catch(() => null), 1_500).unref?.();
  const request = {
    guildId: message.guild.id,
    guild: message.guild,
    channelId: message.channelId,
    member: message.member,
    user: message.author
  };
  try {
    await message.channel.sendTyping?.().catch(() => null);
    const result = await client.music.enqueue(request, query.slice(0, 300));
    if (result.position > 0) {
      await temporary(message.channel, `➕ ${message.author}, añadí **${linkText(result.item.title)}** en la posición ${result.position}.`, 6_000);
    }
  } catch (error) {
    await temporary(message.channel, `❌ ${message.author}, ${String(error.message || error).slice(0, 300)}`);
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Botones                                                             */
/* ------------------------------------------------------------------ */

async function ephemeral(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload).catch(() => null);
  return interaction.reply(payload).catch(() => null);
}

function queueText(player) {
  const lines = player.queue.slice(0, 15).map((track, index) =>
    `${index + 1}. ${linkText(track.title)} · ${formatDuration(track.duration)}${track.requesterId ? ` · <@${track.requesterId}>` : ''}`);
  const more = player.queue.length > 15 ? `\n…y ${player.queue.length - 15} más.` : '';
  return `**Ahora:** ${linkText(player.current?.title)}\n\n${lines.join('\n') || 'No hay más canciones en cola.'}${more}`;
}

// Sin rol DJ se pueden usar los botones cuando la canción es tuya o cuando
// estás solo con el bot: así nadie interrumpe la música de los demás.
function ownsTheMoment(interaction, player) {
  if (player.current?.requesterId === interaction.user.id) return true;
  const channel = interaction.guild?.channels?.cache?.get(player.voiceChannelId);
  const listeners = channel?.members?.filter(member => !member.user.bot).size || 0;
  return listeners <= 1;
}

async function handleMusicButton(interaction, client) {
  const customId = String(interaction.customId || '');
  if (!customId.startsWith('music:')) return false;
  const action = customId.split(':')[1];
  const music = client.music;
  const guildId = interaction.guildId;

  if (action === 'help') {
    await ephemeral(interaction, 'Escribe en este canal el nombre o el enlace de una canción (SoundCloud, YouTube, Spotify…) y empezará a sonar en tu canal de voz. Los botones controlan la canción actual.');
    return true;
  }

  const player = music?.queue(guildId);
  if (!player?.current) {
    await ephemeral(interaction, 'No suena nada ahora. Escribe el nombre de una canción en este canal para empezar.');
    refreshController(client, guildId, 0);
    return true;
  }
  if (action === 'queue') {
    await ephemeral(interaction, queueText(player));
    return true;
  }
  if (interaction.member?.voice?.channelId !== player.voiceChannelId) {
    await ephemeral(interaction, `Entra a <#${player.voiceChannelId}> para controlar la música.`);
    return true;
  }

  const dj = await canWithGuildConfig(interaction, CAPABILITIES.MUSIC_DJ);
  try {
    if (action === 'skip' && !dj && !ownsTheMoment(interaction, player)) {
      player.skipVotes.add(interaction.user.id);
      const channel = interaction.guild.channels.cache.get(player.voiceChannelId);
      const listeners = channel?.members?.filter(member => !member.user.bot).size || 1;
      const needed = Math.max(1, Math.ceil(listeners / 2));
      if (player.skipVotes.size < needed) {
        await ephemeral(interaction, `⏭️ Voto registrado (${player.skipVotes.size}/${needed}).`);
        return true;
      }
    } else if (action !== 'skip' && !dj && !ownsTheMoment(interaction, player)) {
      await ephemeral(interaction, 'Ese botón es para quien pidió la canción o para el rol DJ.');
      return true;
    }

    await interaction.deferUpdate();
    if (action === 'pause') await music.pause(guildId, true);
    else if (action === 'resume') await music.pause(guildId, false);
    else if (action === 'skip') await music.skip(guildId);
    else if (action === 'previous') await music.previous(guildId);
    else if (action === 'stop') await music.stop(guildId);
    else if (action === 'shuffle') music.shuffle(guildId);
    else if (action === 'loop') music.setLoop(guildId, !player.loop);
    else if (action === 'volup' || action === 'voldown') {
      const delta = action === 'volup' ? VOLUME_STEP : -VOLUME_STEP;
      await music.setVolume(guildId, Math.max(1, Math.min(100, player.volume + delta)));
    }
  } catch (error) {
    await ephemeral(interaction, `❌ ${String(error.message || error).slice(0, 300)}`);
  }
  refreshController(client, guildId, 300);
  return true;
}

function attachController(client) {
  if (!client?.music) return;
  client.music.onChange = guildId => refreshController(client, guildId);
}

module.exports = {
  fetchControllerMessage,
  controllerPayload,
  publishController,
  removeController,
  refreshController,
  handleMusicRequest,
  handleMusicButton,
  attachController,
  formatDuration
};
