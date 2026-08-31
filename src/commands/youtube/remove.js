// src/commands/youtube/remove.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const { verifyChannel } = require('../../platforms/youtube/utils');
const { cleanYouTubeChannelCache } = require('../../platforms/youtube/monitors'); // NUEVA importación
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');

// ELIMINAMOS la función cleanYouTubeGuild que borraba todo
// Ya no es necesaria

module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtube-remove')
    .setDescription('Elimina un canal de YouTube del monitoreo')
    .addStringOption(option => option.setName('canal').setDescription('URL, @handle o nombre del canal a eliminar').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('canal').toLowerCase();
    
    try {
      const config = await getGuildConfig(interaction.guildId);
      const currentUsers = config.youtube?.users || [];

      let foundChannelId = null;
      let foundChannelName = null;

      for (const channelId of currentUsers) {
        const info = await verifyChannel(channelId);
        if (info.exists && (info.handle === input || info.name.toLowerCase() === input || info.id === input)) {
          foundChannelId = channelId;
          foundChannelName = info.name;
          break;
        }
      }

      if (!foundChannelId) {
        return interaction.editReply({ content: `❌ No se encontró el canal \`${input}\` en la lista de monitoreo.\n\nUsa \`/youtube-list\` para ver los canales actuales.` });
      }

      const newUsers = currentUsers.filter(u => u !== foundChannelId);
      await updateGuildSection(interaction.guildId, 'youtube', { ...config.youtube, users: newUsers });

      // NUEVO: Limpiar SOLO la caché del canal eliminado, no todo el guild
      cleanYouTubeChannelCache(interaction.guildId, foundChannelId);

      await interaction.editReply({ content: `✅ Se eliminó **${foundChannelName || foundChannelId}** de la lista de monitoreo.\n\n📋 Canales restantes: ${newUsers.length}` });
      
      // Refrescar dashboard automáticamente
      const activePanel = await getActivePanel(interaction.guildId);
      await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
      
    } catch (error) {
      console.error('Error en youtube-remove:', error);
      await interaction.editReply({ content: `❌ Error al eliminar el canal: ${error.message}` });
    }
  }
};