const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSection } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbotrole')
    .setDescription('Configura el rol automático para bots')
    .addRoleOption(opt => opt.setName('rol').setDescription('Rol para bots').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const rol = interaction.options.getRole('rol');
    await updateGuildSection(interaction.guild.id, 'general', { botRole: rol.id }); // Añadir await
    await interaction.reply({ content: `✅ Rol para bots configurado: ${rol}`, flags: 64 });
// Refrescar dashboard automáticamente
    const activePanel = await getActivePanel(interaction.guildId);
    await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
  }
};