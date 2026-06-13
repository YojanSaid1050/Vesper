const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { updateGuildSection } = require('../../database/mongoManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');
const { clearWebhookCache } = require('../../utils/webhookSender');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetbranding')
    .setDescription('Restablece el branding de los webhooks a los valores por defecto')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    await updateGuildSection(interaction.guild.id, 'branding', { name: null, avatar: null });
    
    // Limpiar caché de webhooks
    clearWebhookCache(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle('✅ Branding restablecido')
      .setDescription('Los webhooks usarán ahora el nombre y avatar predeterminados del bot.')
      .setColor('#57F287')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // Refrescar dashboard automáticamente
    const activePanel = await getActivePanel(interaction.guildId);
    await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
  }
};