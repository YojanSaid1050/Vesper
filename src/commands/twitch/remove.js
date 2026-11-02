const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, removeGuildListItem } = require('../../database/mongoManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');
const { clearUserState } = require('../../platforms/twitch/monitors');
const { friendlyError } = require('../../utils/userMessage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitch-remove')
    .setDescription('Deja de seguir un canal de Twitch')
    .addStringOption(option => option.setName('canal').setDescription('Nombre del canal de Twitch').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('canal').toLowerCase();
    
    try {
      const config = await getGuildConfig(interaction.guildId);
      const currentUsers = config.twitch?.users || [];

      const existingUser = currentUsers.find(u => u.toLowerCase() === input);
      
      if (!existingUser) {
        return interaction.editReply({ content: `❌ El canal \`${input}\` no está entre las cuentas que sigue el bot.\n\nUsa \`/twitch-list\` para ver los canales que sigue.` });
      }

      const updated = await removeGuildListItem(interaction.guildId, 'twitch', 'users', existingUser);
      const newUsers = updated?.twitch?.users || [];

      await clearUserState(interaction.guildId, existingUser);

      await interaction.editReply({ content: `✅ Se eliminó **${existingUser}** de las cuentas que sigue el bot.\n\n📋 Canales restantes: ${newUsers.length}` });
      
      // Refrescar dashboard automáticamente
      const activePanel = await getActivePanel(interaction.guildId);
      await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
      
    } catch (error) {
      console.error('Error en twitch-remove:', error);
      await interaction.editReply({ content: `❌ No pude quitar ese canal. ${friendlyError(error, interaction)}` });
    }
  }
};
