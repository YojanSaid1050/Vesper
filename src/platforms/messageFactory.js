const { isMainGuild, isThemedMainGuild } = require('../config/guildPolicy');
const { buildMessage } = require('../core/EmbedCatalog');
const { getGuildConfig } = require('../database/mongoManager');
const twitch = require('./twitch/embeds');
const youtube = require('./youtube/embeds');
const tiktok = require('./tiktok/embeds');

// Los avisos de redes los escribe el catálogo, igual que los registros: así
// salen como los enseña el panel y se pueden cambiar desde la web. Aquí solo
// se aportan los datos del directo o del vídeo y la carátula.
function neutralPayload({ platform, title, description, url, thumbnail, pingText, color, footer, kind, config, vars = {} }) {
  const defaults = { image: thumbnail && /^https?:\/\//i.test(thumbnail) ? thumbnail : null };
  if (color) defaults.color = color;
  if (footer) defaults.footer = footer;
  // `title` y `description` siguen aceptándose por si alguna llamada antigua
  // los manda, pero ya nadie los usa: el texto vive en el catálogo.
  if (title) defaults.title = title;
  if (description) defaults.description = description;

  const built = buildMessage(kind || 'notify_twitch_live', {
    config,
    vars: { platform, ...vars },
    defaults
  });

  const embed = built.embeds[0];
  if (url) embed.url = url;
  return { content: String(pingText || '').trim() || undefined, embeds: [embed] };
}

// Ankerie Dimension solo cambia el color y la firma: el texto es el mismo del
// catálogo, así que el paquete «Limones» y la vista previa cuadran.
function secondaryPayload(guildId, options) {
  if (!isThemedMainGuild(guildId)) return neutralPayload(options);
  return neutralPayload({ ...options, color: 0xA8DCEF, footer: 'AnkeBot · Ankerie Dimension' });
}

async function twitchLive(guildId, data, config = null) {
  config = config || await getGuildConfig(guildId).catch(() => ({}));
  if (isMainGuild(guildId)) return twitch.liveEmbed(data);
  return secondaryPayload(guildId, {
    kind: 'notify_twitch_live',
    config,
    vars: { creator: data.streamer, title: data.title || 'Sin título', url: data.streamUrl || '', game: data.game || 'sin categoría', viewers: data.viewers ?? 0 },
    platform: 'Twitch',
    url: data.streamUrl,
    thumbnail: data.thumbnail,
    pingText: data.pingText,
    color: 0x9146FF
  });
}

async function youtubeLive(guildId, data, config = null) {
  config = config || await getGuildConfig(guildId).catch(() => ({}));
  if (isMainGuild(guildId)) return youtube.liveEmbed(data);
  return secondaryPayload(guildId, {
    kind: 'notify_youtube_live',
    config,
    vars: { creator: data.channelName, title: data.title || 'Transmisión en vivo', url: data.liveUrl || '', viewers: data.viewers ?? 0 },
    platform: 'YouTube',
    url: data.liveUrl,
    thumbnail: data.thumbnail,
    pingText: data.pingText,
    color: 0xFF0000
  });
}

async function youtubeVideo(guildId, user, video, pingText = '', config = null) {
  config = config || await getGuildConfig(guildId).catch(() => ({}));
  if (isMainGuild(guildId)) return youtube.videoEmbed(user, video, pingText);
  return secondaryPayload(guildId, {
    kind: 'notify_youtube_video',
    config,
    vars: { creator: user.channelName, title: video.title || 'Vídeo nuevo', url: video.url || '', views: video.views ?? 0 },
    platform: 'YouTube',
    url: video.url,
    thumbnail: video.thumbnail,
    pingText,
    color: 0xFF0000
  });
}

async function youtubeShort(guildId, user, short, pingText = '', config = null) {
  config = config || await getGuildConfig(guildId).catch(() => ({}));
  if (isMainGuild(guildId)) return youtube.shortEmbed(user, short, pingText);
  return secondaryPayload(guildId, {
    kind: 'notify_youtube_short',
    config,
    vars: { creator: user.channelName, title: short.title || 'Short nuevo', url: short.url || '', views: short.views ?? 0 },
    platform: 'YouTube',
    url: short.url,
    thumbnail: short.thumbnail,
    pingText,
    color: 0xFF0000
  });
}

async function tiktokLive(guildId, data, config = null) {
  config = config || await getGuildConfig(guildId).catch(() => ({}));
  if (isMainGuild(guildId)) return tiktok.liveEmbed(data);
  return secondaryPayload(guildId, {
    kind: 'notify_tiktok_live',
    config,
    vars: { creator: data.nickname || `@${data.username}`, title: data.title || 'Transmisión en vivo', url: data.liveUrl || '', viewers: data.viewers ?? 0 },
    platform: 'TikTok',
    title: `${data.nickname || `@${data.username}`} está en directo en TikTok`,
    description: `**${data.title || 'Transmisión en vivo'}**\nEspectadores: ${data.viewers || 0}`,
    url: data.liveUrl,
    thumbnail: data.cover,
    pingText: data.pingText,
    color: 0x1E90FF
  });
}

async function tiktokVideo(guildId, data, config = null) {
  config = config || await getGuildConfig(guildId).catch(() => ({}));
  if (isMainGuild(guildId)) return tiktok.videoEmbed(data);
  return secondaryPayload(guildId, {
    kind: 'notify_tiktok_video',
    config,
    vars: { creator: data.nickname || `@${data.username}`, title: data.description || 'Vídeo nuevo', url: data.url || '', views: data.playCount ?? 0 },
    platform: 'TikTok',
    title: `Nuevo video de ${data.nickname || `@${data.username}`}`,
    description: `${data.description || 'Se publicó un nuevo video.'}\nReproducciones: ${data.playCount || 0}\nComentarios: ${data.commentCount || 0}`,
    url: data.url,
    thumbnail: data.thumbnail,
    pingText: data.pingText,
    color: 0x1E90FF
  });
}

module.exports = { neutralPayload, secondaryPayload, twitchLive, youtubeLive, youtubeVideo, youtubeShort, tiktokLive, tiktokVideo };
