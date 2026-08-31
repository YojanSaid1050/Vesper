const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { updateGuildSection } = require('../../database/mongoManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');
const { clearWebhookCache } = require('../../utils/webhookSender');
const { isValidImageUrl } = require('../../utils/imageUrlValidator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbotavatar')
    .setDescription('Configura el avatar usado en los webhooks (no afecta al avatar del bot)')
    .addStringOption(opt => opt.setName('url').setDescription('URL de la imagen').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const url = interaction.options.getString('url');
    
    await interaction.editReply({ content: '🔍 Verificando imagen...' });
    
    const isValid = await isValidImageUrl(url);
    
    if (!isValid) {
      return interaction.editReply({ 
        content: '❌ URL inválida. Asegúrate de que la URL apunte a una imagen válida (jpg, jpeg, png, gif, webp).' 
      });
    }

    // Solo guardar en DB para webhooks, NO cambiar el avatar del bot
    await updateGuildSection(interaction.guild.id, 'branding', { avatar: url });
    
    // Limpiar caché de webhooks para que usen el nuevo avatar
    clearWebhookCache(interaction.guild.id);
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Avatar actualizado')
      .setDescription('La nueva imagen se usará en los webhooks.\n\n> ⚠️ **Nota:** Esto NO cambia el avatar del bot principal.')
      .setImage(url)
      .setColor('#57F287')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // Refrescar dashboard automáticamente
    const activePanel = await getActivePanel(interaction.guildId);
    await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
  }
};
