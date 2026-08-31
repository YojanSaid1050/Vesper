// src/commands/tiktok/setpingrole.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tiktok-setpingrole')
    .setDescription('Configura el rol a etiquetar en las notificaciones de TikTok')
    .addRoleOption(opt => opt.setName('rol').setDescription('Rol a etiquetar (opcional, omitir para desactivar)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const role = interaction.options.getRole('rol');
    const pingRole = role ? role.id : null;
    
    await updateGuildSection(interaction.guildId, 'tiktok', { pingRole });
    
    const message = pingRole 
      ? `✅ Rol ${role} será etiquetado en las notificaciones de TikTok.`
      : `✅ Se desactivó el etiquetado de roles en las notificaciones de TikTok.`;
    
    await interaction.editReply({ content: message });
    
    // Refrescar dashboard
    const activePanel = await getActivePanel(interaction.guildId);
    await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
  }
};