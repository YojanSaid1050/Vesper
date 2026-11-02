const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { updateGuildSection, getGuildConfig } = require('../../database/mongoManager');
const { featureAvailable } = require('../../config/guildPolicy');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');
const { clearWebhookCache } = require('../../utils/webhookSender');
const { isValidImageUrl } = require('../../utils/imageUrlValidator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbotavatar')
    .setDescription('Cambia el logo con el que publica el bot en este servidor')
    .addStringOption(opt => opt.setName('url').setDescription('Enlace de la imagen').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!featureAvailable('branding', interaction.guild.id, await getGuildConfig(interaction.guild.id))) {
      return interaction.editReply({ content: '🔒 Cambiar el nombre y el logo del bot es parte del plan premium.' });
    }
    const url = interaction.options.getString('url');
    
    await interaction.editReply({ content: '🔍 Verificando imagen...' });
    
    const isValid = await isValidImageUrl(url);
    
    if (!isValid) {
      return interaction.editReply({ 
        content: '❌ Ese enlace no lleva a una imagen. Copia el enlace de una imagen (JPG, PNG, GIF o WEBP) que se pueda abrir sin iniciar sesión.' 
      });
    }

    // Solo guardar en DB para webhooks, NO cambiar el avatar del bot
    await updateGuildSection(interaction.guild.id, 'branding', { avatar: url });
    
    // Limpiar caché de webhooks para que usen el nuevo avatar
    clearWebhookCache(interaction.guild.id);
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Logo actualizado')
      .setDescription('Desde ahora el bot firma sus mensajes con esta imagen en este servidor.\n\n> Su cuenta de Discord sigue igual.')
      .setImage(url)
      .setColor('#57F287')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // Refrescar dashboard automáticamente
    const activePanel = await getActivePanel(interaction.guildId);
    await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
  }
};
