const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const { verifyStreamer } = require('../../platforms/twitch/utils');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitch-add')
    .setDescription('Añade un streamer de Twitch para monitorear')
    .addStringOption(option => option.setName('streamer').setDescription('Nombre del streamer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('streamer').toLowerCase();
    
    try {
      const streamer = await verifyStreamer(input);

      if (!streamer.exists) {
        return interaction.editReply({ content: `❌ No se encontró el streamer \`${input}\` en Twitch.` });
      }

      const config = await getGuildConfig(interaction.guildId);
      const currentUsers = config.twitch?.users || [];

      if (currentUsers.includes(streamer.login)) {
        return interaction.editReply({ content: `⚠️ El streamer **${streamer.name}** ya está siendo monitoreado.` });
      }

      const newUsers = [...currentUsers, streamer.login];
      await updateGuildSection(interaction.guildId, 'twitch', { ...config.twitch, users: newUsers });

      await interaction.editReply({ content: `✅ Se añadió **${streamer.name}** a la lista de monitoreo.\n\n📺 ID: \`${streamer.id}\`\n📋 Total de streamers: ${newUsers.length}` });
      
      // Refrescar dashboard automáticamente
      const activePanel = await getActivePanel(interaction.guildId);
      await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
      
    } catch (error) {
      console.error('Error en twitch-add:', error);
      await interaction.editReply({ content: `❌ Error al verificar el streamer: ${error.message}. Intenta nuevamente.` });
    }
  }
};