const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, removeGuildListItem } = require('../../database/mongoManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');
const { clearUserState } = require('../../platforms/twitch/monitors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitch-remove')
    .setDescription('Elimina un streamer de Twitch del monitoreo')
    .addStringOption(option => option.setName('streamer').setDescription('Nombre del streamer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('streamer').toLowerCase();
    
    try {
      const config = await getGuildConfig(interaction.guildId);
      const currentUsers = config.twitch?.users || [];

      const existingUser = currentUsers.find(u => u.toLowerCase() === input);
      
      if (!existingUser) {
        return interaction.editReply({ content: `❌ El streamer \`${input}\` no está en la lista de monitoreo.\n\nUsa \`/twitch-list\` para ver los streamers actuales.` });
      }

      const updated = await removeGuildListItem(interaction.guildId, 'twitch', 'users', existingUser);
      const newUsers = updated?.twitch?.users || [];

      await clearUserState(interaction.guildId, existingUser);

      await interaction.editReply({ content: `✅ Se eliminó **${existingUser}** de la lista de monitoreo.\n\n📋 Streamers restantes: ${newUsers.length}` });
      
      // Refrescar dashboard automáticamente
      const activePanel = await getActivePanel(interaction.guildId);
      await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
      
    } catch (error) {
      console.error('Error en twitch-remove:', error);
      await interaction.editReply({ content: `❌ Error al eliminar el streamer: ${error.message}` });
    }
  }
};
