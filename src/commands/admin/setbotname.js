const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { updateGuildSection } = require('../../database/mongoManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');
const { clearWebhookCache } = require('../../utils/webhookSender');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbotname')
    .setDescription('Configura el nombre usado en los webhooks (no afecta al nombre del bot)')
    .addStringOption(opt => opt.setName('nombre').setDescription('Nombre a mostrar en webhooks').setRequired(true).setMaxLength(80))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const nombre = interaction.options.getString('nombre');
    
    // Solo guardar en DB para webhooks, NO cambiar el nombre del bot
    await updateGuildSection(interaction.guild.id, 'branding', { name: nombre });
    
    // Limpiar caché de webhooks para que usen el nuevo nombre
    clearWebhookCache(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle('✅ Branding actualizado')
      .setDescription(`El nombre **"${nombre}"** se usará en los webhooks.\n\n> ⚠️ **Nota:** Esto NO cambia el nombre del bot principal.`)
      .setColor('#57F287')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // Refrescar dashboard automáticamente
    const activePanel = await getActivePanel(interaction.guildId);
    await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
  }
};