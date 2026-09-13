const { isMainGuild, isThemedMainGuild } = require('../config/guildPolicy');
const { buildMessage } = require('../core/EmbedCatalog');
const { getGuildConfig } = require('../database/mongoManager');
const twitch = require('./twitch/embeds');
const youtube = require('./youtube/embeds');
const tiktok = require('./tiktok/embeds');

// Los avisos de redes también se pueden personalizar desde el panel. Si el
// administrador no ha escrito nada, sale exactamente el mismo aviso de antes.
function neutralPayload({ platform, title, description, url, thumbnail, pingText, color, kind, config, vars = {} }) {
  const built = buildMessage(kind || 'notify_twitch_live', {
    config,
    vars: { platform, ...vars },
    defaults: { title, description, color, image: thumbnail && /^https?:\/\//i.test(thumbnail) ? thumbnail : null }
  });

  const embed = built.embeds[0];
  if (url) embed.url = url;
  return { content: String(pingText || '').trim() || undefined, embeds: [embed] };
}

function secondaryPayload(guildId, options) {
  if (!isThemedMainGuild(guildId)) return neutralPayload(options);
  const payload = neutralPayload({
    ...options,
    title: `☁️ ${options.title}`,
    description: `${options.description}\n\n✨ Una señal llegó a Ankerie Dimension.`,
    color: 0x8DDCF4
  });
  if (!payload.embeds[0].footer) payload.embeds[0].footer = { text: 'AnkeBot • Ankerie Dimension' };
  return payload;
}

async function twitchLive(guildId, data, config = null) {
  config = config || await getGuildConfig(guildId).catch(() => ({}));
  if (isMainGuild(guildId)) return twitch.liveEmbed(data);
  return secondaryPayload(guildId, {
    kind: 'notify_twitch_live',
    config,
    vars: { creator: data.streamer, title: data.title || '', url: data.streamUrl || '', game: data.game || '', viewers: data.viewers || 0 },
    platform: 'Twitch',
    title: `${data.streamer} está en directo en Twitch`,
    description: `**${data.title || 'Sin título'}**\nCategoría: ${data.game || 'Sin categoría'}\nEspectadores: ${data.viewers || 0}`,
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
    vars: { creator: data.channelName, title: data.title || '', url: data.liveUrl || '', viewers: data.viewers || 0 },
    platform: 'YouTube',
    title: `${data.channelName} está en directo en YouTube`,
    description: `**${data.title || 'Transmisión en vivo'}**\nEspectadores: ${data.viewers || 0}`,
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
    vars: { creator: user.channelName, title: video.title || '', url: video.url || '', views: video.views || 0 },
    platform: 'YouTube',
    title: `Nuevo video de ${user.channelName}`,
    description: `**${video.title || 'Nuevo video'}**\nVisualizaciones: ${video.views || 0}`,
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
    vars: { creator: user.channelName, title: short.title || '', url: short.url || '', views: short.views || 0 },
    platform: 'YouTube',
    title: `Nuevo short de ${user.channelName}`,
    description: `**${short.title || 'Nuevo short'}**\nVisualizaciones: ${short.views || 0}`,
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
    vars: { creator: data.nickname || `@${data.username}`, title: data.title || '', url: data.liveUrl || '', viewers: data.viewers || 0 },
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
    vars: { creator: data.nickname || `@${data.username}`, title: data.description || '', url: data.url || '', views: data.playCount || 0 },
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
