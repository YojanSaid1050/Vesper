// commands/admin/cache.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const PersistentStateStore = require('../../core/PersistentStateStore');
const { getMonitorStats: getTikTokMonitorStats } = require('../../platforms/tiktok/monitors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cache')
    .setDescription('Muestra cuántas cuentas está siguiendo el bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    // Lo mismo que leen los avisos: el estado guardado en la base de datos,
    // que sobrevive a los reinicios (la copia local se pierde en Render).
    const tiktokState = new PersistentStateStore('tiktok');
    const youtubeState = new PersistentStateStore('youtube');
    const twitchState = new PersistentStateStore('twitch');
    const [tiktokVideos, tiktokLive, tiktokStats, youtubeVideos, youtubeShorts, youtubeLive, twitchStatus] = await Promise.all([
      tiktokState.load('videos', {}),
      tiktokState.load('liveStatus', {}),
      getTikTokMonitorStats(),
      youtubeState.load('videos', {}),
      youtubeState.load('shorts', {}),
      youtubeState.load('liveStatus', {}),
      twitchState.load('status', {})
    ]);
    
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
