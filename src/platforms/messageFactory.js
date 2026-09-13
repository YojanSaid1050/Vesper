const { EmbedBuilder } = require('discord.js');
const { isMainGuild, isThemedMainGuild } = require('../config/guildPolicy');
const twitch = require('./twitch/embeds');
const youtube = require('./youtube/embeds');
const tiktok = require('./tiktok/embeds');

function neutralPayload({ platform, title, description, url, thumbnail, pingText, color }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
  if (url) embed.setURL(url);
  if (thumbnail && /^https?:\/\//i.test(thumbnail)) embed.setImage(thumbnail);
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
  payload.embeds[0].setFooter({ text: 'AnkeBot • Ankerie Dimension' });
  return payload;
}

function twitchLive(guildId, data) {
  if (isMainGuild(guildId)) return twitch.liveEmbed(data);
  return secondaryPayload(guildId, {
    platform: 'Twitch',
    title: `${data.streamer} está en directo en Twitch`,
    description: `**${data.title || 'Sin título'}**\nCategoría: ${data.game || 'Sin categoría'}\nEspectadores: ${data.viewers || 0}`,
    url: data.streamUrl,
    thumbnail: data.thumbnail,
    pingText: data.pingText,
    color: 0x9146FF
  });
}

function youtubeLive(guildId, data) {
  if (isMainGuild(guildId)) return youtube.liveEmbed(data);
  return secondaryPayload(guildId, {
    platform: 'YouTube',
    title: `${data.channelName} está en directo en YouTube`,
    description: `**${data.title || 'Transmisión en vivo'}**\nEspectadores: ${data.viewers || 0}`,
    url: data.liveUrl,
    thumbnail: data.thumbnail,
    pingText: data.pingText,
    color: 0xFF0000
  });
}

function youtubeVideo(guildId, user, video, pingText = '') {
  if (isMainGuild(guildId)) return youtube.videoEmbed(user, video, pingText);
  return secondaryPayload(guildId, {
    platform: 'YouTube',
    title: `Nuevo video de ${user.channelName}`,
    description: `**${video.title || 'Nuevo video'}**\nVisualizaciones: ${video.views || 0}`,
    url: video.url,
    thumbnail: video.thumbnail,
    pingText,
    color: 0xFF0000
  });
}

function youtubeShort(guildId, user, short, pingText = '') {
  if (isMainGuild(guildId)) return youtube.shortEmbed(user, short, pingText);
  return secondaryPayload(guildId, {
    platform: 'YouTube',
    title: `Nuevo short de ${user.channelName}`,
    description: `**${short.title || 'Nuevo short'}**\nVisualizaciones: ${short.views || 0}`,
    url: short.url,
    thumbnail: short.thumbnail,
    pingText,
    color: 0xFF0000
  });
}

function tiktokLive(guildId, data) {
  if (isMainGuild(guildId)) return tiktok.liveEmbed(data);
  return secondaryPayload(guildId, {
    platform: 'TikTok',
    title: `${data.nickname || `@${data.username}`} está en directo en TikTok`,
    description: `**${data.title || 'Transmisión en vivo'}**\nEspectadores: ${data.viewers || 0}`,
    url: data.liveUrl,
    thumbnail: data.cover,
    pingText: data.pingText,
    color: 0x1E90FF
  });
}

function tiktokVideo(guildId, data) {
  if (isMainGuild(guildId)) return tiktok.videoEmbed(data);
  return secondaryPayload(guildId, {
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
