const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { monitorVideos: tiktokVideos, monitorLives: tiktokLives } = require('../../platforms/tiktok/monitors');
const { monitorStreams: twitchStreams } = require('../../platforms/twitch/monitors');
const { monitorVideos: youtubeVideos, monitorShorts: youtubeShorts, monitorLives: youtubeLives } = require('../../platforms/youtube/monitors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forcecheck')
    .setDescription('Fuerza la verificación manual de una plataforma específica')
    .addStringOption(option =>
      option.setName('plataforma')
        .setDescription('Plataforma a forzar')
        .setRequired(true)
        .addChoices(
          { name: '📹 TikTok - Videos', value: 'tiktok_videos' },
          { name: '🔴 TikTok - Lives', value: 'tiktok_lives' },
          { name: '📹 TikTok - Todos', value: 'tiktok_all' },
          { name: '🎮 Twitch - Streams', value: 'twitch' },
          { name: '📹 YouTube - Videos', value: 'youtube_videos' },
          { name: '📱 YouTube - Shorts', value: 'youtube_shorts' },
          { name: '🔴 YouTube - Lives', value: 'youtube_lives' },
          { name: '📹 YouTube - Todos', value: 'youtube_all' },
          { name: '🌍 Todas las plataformas', value: 'all' }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });
    
    const plataforma = interaction.options.getString('plataforma');
    const startTime = Date.now();
    const results = [];
    const errors = [];

    // Función para ejecutar y registrar resultados
    async function runCheck(name, fn) {
      const checkStart = Date.now();
      try {
        const result = await fn(client);
        const duration = Date.now() - checkStart;
        
        // Verificar si la función retornó un resultado estructurado
        if (result && typeof result === 'object') {
          if (result.success === false) {
            results.push({ 
              name, 
              status: '❌', 
              duration, 
              error: result.error || result.reason || 'Falló la verificación'
            });
            errors.push({ name, error: result.error || result.reason });
          } else {
            // Mostrar estadísticas si están disponibles
            const stats = [];
            if (result.videos !== undefined && result.videos > 0) stats.push(`${result.videos} videos nuevos`);
            if (result.lives !== undefined && result.lives > 0) stats.push(`${result.lives} lives nuevos`);
            if (result.shorts !== undefined && result.shorts > 0) stats.push(`${result.shorts} shorts nuevos`);
            if (result.streams !== undefined && result.streams > 0) stats.push(`${result.streams} streams nuevos`);
            if (result.guilds !== undefined) stats.push(`${result.guilds} servidores`);
            if (result.channels !== undefined) stats.push(`${result.channels} canales`);
            if (result.users !== undefined) stats.push(`${result.users} usuarios`);
            
            const statusIcon = result.videos > 0 || result.lives > 0 || result.shorts > 0 || result.streams > 0 ? '🆕' : '✅';
            
            results.push({ 
              name, 
              status: statusIcon, 
              duration, 
              details: stats.length > 0 ? stats.join(', ') : 'Verificación completada'
            });
          }
        } else {
          // Si no hay resultado estructurado, considerar como éxito
          results.push({ name, status: '✅', duration, details: 'Verificación completada' });
        }
      } catch (error) {
        const duration = Date.now() - checkStart;
        const errorMessage = error.message || String(error);
        results.push({ 
          name, 
          status: '❌', 
          duration, 
          error: errorMessage.substring(0, 150)
        });
        errors.push({ name, error: errorMessage });
      }
    }

    // Actualizar mensaje de progreso
    await interaction.editReply({ content: '🔄 Forzando verificación...' });

    // Ejecutar según la plataforma seleccionada
    switch (plataforma) {
      case 'tiktok_videos':
        await interaction.editReply({ content: '🔄 Verificando TikTok (videos)...' });
        await runCheck('📹 TikTok Videos', tiktokVideos);
        break;
        
      case 'tiktok_lives':
        await interaction.editReply({ content: '🔄 Verificando TikTok (lives)...' });
        await runCheck('🔴 TikTok Lives', tiktokLives);
        break;
        
      case 'tiktok_all':
        await interaction.editReply({ content: '🔄 Verificando TikTok (videos y lives)...' });
        await runCheck('📹 TikTok Videos', tiktokVideos);
        await runCheck('🔴 TikTok Lives', tiktokLives);
        break;
        
      case 'twitch':
        await interaction.editReply({ content: '🔄 Verificando Twitch (streams)...' });
        await runCheck('🎮 Twitch Streams', twitchStreams);
        break;
        
      case 'youtube_videos':
        await interaction.editReply({ content: '🔄 Verificando YouTube (videos)...' });
        await runCheck('📹 YouTube Videos', youtubeVideos);
        break;
        
      case 'youtube_shorts':
        await interaction.editReply({ content: '🔄 Verificando YouTube (shorts)...' });
        await runCheck('📱 YouTube Shorts', youtubeShorts);
        break;
        
      case 'youtube_lives':
        await interaction.editReply({ content: '🔄 Verificando YouTube (lives)...' });
        await runCheck('🔴 YouTube Lives', youtubeLives);
        break;
        
      case 'youtube_all':
        await interaction.editReply({ content: '🔄 Verificando YouTube (videos, shorts y lives)...' });
        await runCheck('📹 YouTube Videos', youtubeVideos);
        await runCheck('📱 YouTube Shorts', youtubeShorts);
        await runCheck('🔴 YouTube Lives', youtubeLives);
        break;
        
      case 'all':
      default:
        await interaction.editReply({ content: '🔄 Verificando TODAS las plataformas...' });
        await runCheck('📹 TikTok Videos', tiktokVideos);
        await runCheck('🔴 TikTok Lives', tiktokLives);
        await runCheck('🎮 Twitch Streams', twitchStreams);
        await runCheck('📹 YouTube Videos', youtubeVideos);
        await runCheck('📱 YouTube Shorts', youtubeShorts);
        await runCheck('🔴 YouTube Lives', youtubeLives);
        break;
    }

    const totalDuration = Date.now() - startTime;
    
    // Calcular estadísticas
    const successCount = results.filter(r => r.status === '✅' || r.status === '🆕').length;
    const errorCount = results.filter(r => r.status === '❌').length;
    
    // Crear embed con resultados
    const embed = new EmbedBuilder()
      .setTitle('✅ Verificación completada')
      .setDescription(`**Plataforma:** ${plataforma}\n**Tiempo total:** ${totalDuration}ms\n\n**Resumen:** ✅ ${successCount} | ❌ ${errorCount}`)
      .setColor(errorCount > 0 ? '#ED4245' : '#57F287')
      .setTimestamp()
      .addFields(
        results.map(r => {
          let value = `⏱️ ${r.duration}ms`;
          if (r.details) value += `\n📊 ${r.details}`;
          if (r.error) value += `\n❌ \`${r.error}\``;
          return {
            name: `${r.status} ${r.name}`,
            value: value,
            inline: true
          };
        })
      );

    // Si hay errores, agregar un campo con el resumen
    if (errors.length > 0) {
      embed.addFields({
        name: '📋 Resumen de errores',
        value: errors.map(e => `**${e.name}:** ${e.error.substring(0, 100)}`).join('\n'),
        inline: false
      });
    }

    await interaction.editReply({ content: null, embeds: [embed] });
  }
};