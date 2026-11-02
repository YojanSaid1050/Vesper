// commands/admin/cache.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const CacheManager = require('../../core/CacheManager');
const { getMonitorStats: getTikTokMonitorStats } = require('../../platforms/tiktok/monitors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cache')
    .setDescription('Muestra cuántas cuentas está siguiendo el bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const tiktokCache = new CacheManager('./data/tiktok');
    const youtubeCache = new CacheManager('./data/youtube');
    const twitchCache = new CacheManager('./data/twitch');
    
    const tiktokVideos = tiktokCache.load('videos', {});
    const tiktokLive = tiktokCache.load('liveStatus', {});
    const tiktokStats = await getTikTokMonitorStats();
    const youtubeVideos = youtubeCache.load('videos', {});
    const youtubeShorts = youtubeCache.load('shorts', {});
    const youtubeLive = youtubeCache.load('liveStatus', {});
    const twitchStatus = twitchCache.load('status', {});
    
    const servers = n => `${n} ${n === 1 ? 'servidor' : 'servidores'}`;
    const embed = new EmbedBuilder()
      .setTitle('📊 Lo que está siguiendo el bot')
      .setColor('#ffffff')
      .addFields(
        { name: '📹 Videos de TikTok', value: `${servers(tiktokStats.guilds?.videos ?? Object.keys(tiktokVideos).length)} · ${tiktokStats.entries?.videos ?? 0} cuentas`, inline: true },
        { name: '🔴 Directos de TikTok', value: `${servers(tiktokStats.guilds?.live ?? Object.keys(tiktokLive).length)} · ${tiktokStats.entries?.live ?? 0} cuentas`, inline: true },
        // Si TikTok todavía no ha arrancado, estas claves pueden faltar.
        { name: '🎬 Lector de TikTok', value: tiktokStats.provider?.browser?.ready ? 'Listo' : tiktokStats.provider?.browser?.installed ? 'En espera' : 'Modo sencillo', inline: true },
        { name: '📺 Directos de Twitch', value: servers(Object.keys(twitchStatus).length), inline: true },
        { name: '📹 Videos de YouTube', value: `${servers(Object.keys(youtubeVideos).length)} · ${Object.values(youtubeVideos).reduce((a, b) => a + Object.keys(b).length, 0)} canales`, inline: true },
        { name: '📱 Shorts de YouTube', value: `${servers(Object.keys(youtubeShorts).length)} · ${Object.values(youtubeShorts).reduce((a, b) => a + Object.keys(b).length, 0)} canales`, inline: true },
        { name: '🔴 Directos de YouTube', value: servers(Object.keys(youtubeLive).length), inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }
};
