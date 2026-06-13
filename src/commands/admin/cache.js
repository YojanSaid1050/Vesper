// commands/admin/cache.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const CacheManager = require('../../core/CacheManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cache')
    .setDescription('Muestra el estado de la caché de monitores')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const tiktokCache = new CacheManager('./data/tiktok');
    const youtubeCache = new CacheManager('./data/youtube');
    const twitchCache = new CacheManager('./data/twitch');
    
    const tiktokVideos = tiktokCache.load('videos', {});
    const tiktokLive = tiktokCache.load('liveStatus', {});
    const youtubeVideos = youtubeCache.load('videos', {});
    const youtubeShorts = youtubeCache.load('shorts', {});
    const youtubeLive = youtubeCache.load('liveStatus', {});
    const twitchStatus = twitchCache.load('status', {});
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Estado de Caché')
      .setColor('#ffffff')
      .addFields(
        { name: '📹 TikTok Videos', value: `Guilds: ${Object.keys(tiktokVideos).length}\nUsuarios con caché: ${Object.values(tiktokVideos).reduce((a, b) => a + Object.keys(b).length, 0)}`, inline: true },
        { name: '🔴 TikTok Lives', value: `Guilds: ${Object.keys(tiktokLive).length}`, inline: true },
        { name: '📺 Twitch Streams', value: `Guilds: ${Object.keys(twitchStatus).length}`, inline: true },
        { name: '📹 YouTube Videos', value: `Guilds: ${Object.keys(youtubeVideos).length}\nCanales con caché: ${Object.values(youtubeVideos).reduce((a, b) => a + Object.keys(b).length, 0)}`, inline: true },
        { name: '📱 YouTube Shorts', value: `Guilds: ${Object.keys(youtubeShorts).length}\nCanales con caché: ${Object.values(youtubeShorts).reduce((a, b) => a + Object.keys(b).length, 0)}`, inline: true },
        { name: '🔴 YouTube Lives', value: `Guilds: ${Object.keys(youtubeLive).length}`, inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }
};