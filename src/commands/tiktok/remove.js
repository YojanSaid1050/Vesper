const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, removeGuildListItem } = require('../../database/mongoManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');
const { clearUserState } = require('../../platforms/tiktok/monitors');
const { friendlyError } = require('../../utils/userMessage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tiktok-remove')
    .setDescription('Deja de seguir una cuenta de TikTok')
    .addStringOption(option => option.setName('usuario').setDescription('Usuario de TikTok').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('usuario').replace('@', '').toLowerCase();
    
    try {
      const config = await getGuildConfig(interaction.guildId);
      const currentUsers = config.tiktok?.users || [];

      const existingUser = currentUsers.find(u => u.toLowerCase() === input);
      
      if (!existingUser) {
        return interaction.editReply({ content: `❌ El usuario \`${input}\` no está entre las cuentas que sigue el bot.\n\nUsa \`/tiktok-list\` para ver los cuentas que sigue.` });
      }

      const updated = await removeGuildListItem(interaction.guildId, 'tiktok', 'users', existingUser);
      const newUsers = updated?.tiktok?.users || [];

      await clearUserState(interaction.guildId, existingUser);

      await interaction.editReply({ content: `✅ Se eliminó **${existingUser}** de las cuentas que sigue el bot.\n\n📋 Cuentas restantes: ${newUsers.length}` });
      
      // Refrescar dashboard automáticamente
      const activePanel = await getActivePanel(interaction.guildId);
      await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
      
    } catch (error) {
      console.error('Error en tiktok-remove:', error);
      await interaction.editReply({ content: `❌ No pude quitar esa cuenta. ${friendlyError(error, interaction)}` });
    }
  }
};
