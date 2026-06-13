const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { updateGuildConfig, getGuildConfig } = require('../../database/mongoManager');
const CacheManager = require('../../core/CacheManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');

// Inicializar limpiadores de caché
const twitchCache = new CacheManager('./data/twitch');
const tiktokLiveCache = new CacheManager('./data/tiktok');
const tiktokVideosCache = new CacheManager('./data/tiktok');
const youtubeCache = new CacheManager('./data/youtube');

function cleanAllGuildCache(guildId) {
  // Limpiar caché de Twitch
  const twitchStatus = twitchCache.load('status', {});
  for (const key of Object.keys(twitchStatus)) {
    if (key.startsWith(`${guildId}_`)) {
      delete twitchStatus[key];
    }
  }
  twitchCache.save('status', twitchStatus);

  // Limpiar caché de TikTok
  const tiktokLive = tiktokLiveCache.load('liveStatus', {});
  delete tiktokLive[guildId];
  tiktokLiveCache.save('liveStatus', tiktokLive);
  
  const tiktokVideos = tiktokVideosCache.load('videos', {});
  delete tiktokVideos[guildId];
  tiktokVideosCache.save('videos', tiktokVideos);

  // Limpiar caché de YouTube
  const youtubeLive = youtubeCache.load('liveStatus', {});
  delete youtubeLive[guildId];
  youtubeCache.save('liveStatus', youtubeLive);
  
  const youtubeVideos = youtubeCache.load('videos', {});
  delete youtubeVideos[guildId];
  youtubeCache.save('videos', youtubeVideos);
  
  const youtubeShorts = youtubeCache.load('shorts', {});
  delete youtubeShorts[guildId];
  youtubeCache.save('shorts', youtubeShorts);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetconfig')
    .setDescription('Resetea TODA la configuración del servidor (canales, usuarios, branding)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = await getGuildConfig(interaction.guildId);
    
    // Verificar si hay algo que resetear
    const hasGeneral = config.general && Object.values(config.general).some(v => v);
    const hasTikTok = config.tiktok?.users?.length > 0 || config.tiktok?.liveChannel || config.tiktok?.videoChannel;
    const hasTwitch = config.twitch?.users?.length > 0 || config.twitch?.liveChannel;
    const hasYouTube = config.youtube?.users?.length > 0 || config.youtube?.liveChannel || config.youtube?.videoChannel || config.youtube?.shortChannel;
    const hasBranding = config.branding?.name || config.branding?.avatar;
    
    if (!hasGeneral && !hasTikTok && !hasTwitch && !hasYouTube && !hasBranding) {
      return interaction.reply({ 
        content: '📋 No hay configuración para resetear. El servidor ya está limpio.', 
        flags: 64 
      });
    }

    // Crear embed de confirmación
    const embed = new EmbedBuilder()
      .setTitle('⚠️ RESETEO COMPLETO DE CONFIGURACIÓN')
      .setDescription('Estás a punto de eliminar **TODA** la configuración de este servidor.')
      .setColor(0xFF0000)
      .addFields(
        { name: '📋 General', value: hasGeneral ? '✅ Canales configurados' : '❌ Sin datos', inline: true },
        { name: '🎭 TikTok', value: hasTikTok ? `✅ ${config.tiktok?.users?.length || 0} usuarios, canales configurados` : '❌ Sin datos', inline: true },
        { name: '📺 Twitch', value: hasTwitch ? `✅ ${config.twitch?.users?.length || 0} streamers, canal configurado` : '❌ Sin datos', inline: true },
        { name: '📀 YouTube', value: hasYouTube ? `✅ ${config.youtube?.users?.length || 0} canales, canales configurados` : '❌ Sin datos', inline: true },
        { name: '🎨 Branding', value: hasBranding ? '✅ Nombre/Avatar configurado' : '❌ Sin datos', inline: true }
      )
      .setFooter({ text: 'Esta acción no se puede deshacer. Se eliminarán: canales, usuarios monitoreados, branding y caché.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_reset_config').setLabel('✅ SÍ, RESETEAR TODO').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel_reset_config').setLabel('❌ CANCELAR').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: 64
    });

    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async i => {
      if (i.customId === 'confirm_reset_config') {
        await i.deferUpdate();
        
        try {
          // Resetear toda la configuración
          const resetConfig = {
            general: {
              welcomeChannel: null,
              goodbyeChannel: null,
              logChannel: null,
              botLogChannel: null,
              botRole: null
            },
            dashboard: {
              channel: null,
              message: null,
              enabled: false,
              currentPanel: 'main',
              currentMode: 'default'
            },
            tiktok: {
              liveChannel: null,
              videoChannel: null,
              users: [],
              showUsers: false
            },
            twitch: {
              liveChannel: null,
              users: [],
              showUsers: false
            },
            youtube: {
              liveChannel: null,
              videoChannel: null,
              shortChannel: null,
              users: [],
              showUsers: false
            },
            branding: {
              name: null,
              avatar: null
            },
            testPanel: {
              activeSection: 'general'
            }
          };
          
          await updateGuildConfig(interaction.guildId, resetConfig);
          
          // Limpiar toda la caché del guild
          cleanAllGuildCache(interaction.guildId);
          
          // Limpiar webhook cache
          const { clearWebhookCache } = require('../../utils/webhookSender');
          clearWebhookCache(interaction.guildId);
          
          const successEmbed = new EmbedBuilder()
            .setTitle('✅ Configuración reseteada')
            .setDescription('Toda la configuración del servidor ha sido eliminada correctamente.\n\nUsa `/config-dashboard` para crear un nuevo dashboard.')
            .setColor(0x00FF00)
            .setTimestamp();
          
          await i.editReply({ embeds: [successEmbed], components: [] });
          
          // Refrescar dashboard si existe
          const activePanel = await getActivePanel(interaction.guildId);
          await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
          
        } catch (error) {
          console.error('Error resetting config:', error);
          await i.editReply({ 
            content: `❌ Error al resetear la configuración: ${error.message}`,
            components: [],
            embeds: []
          });
        }
        
      } else if (i.customId === 'cancel_reset_config') {
        await i.update({ 
          content: '❌ Operación cancelada. La configuración no ha sido modificada.',
          embeds: [],
          components: [] 
        });
      }
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        await interaction.editReply({ 
          content: '⏰ Tiempo de espera agotado. Operación cancelada.',
          components: [],
          embeds: []
        });
      }
    });
  }
};