const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { updateGuildSection, getGuildConfig } = require('../../database/mongoManager');
const { featureAvailable } = require('../../config/guildPolicy');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');
const { clearWebhookCache } = require('../../utils/webhookSender');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbotname')
    .setDescription('Cambia el nombre con el que publica el bot en este servidor')
    .addStringOption(opt => opt.setName('nombre').setDescription('Nombre que se verá en los mensajes').setRequired(true).setMaxLength(80))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!featureAvailable('branding', interaction.guild.id, await getGuildConfig(interaction.guild.id))) {
      return interaction.editReply({ content: '🔒 Cambiar el nombre y el logo del bot es parte del plan premium.' });
    }
    const nombre = interaction.options.getString('nombre');
    
    // Solo guardar en DB para webhooks, NO cambiar el nombre del bot
    await updateGuildSection(interaction.guild.id, 'branding', { name: nombre });
    
    // Limpiar caché de webhooks para que usen el nuevo nombre
    clearWebhookCache(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle('✅ Nombre actualizado')
      .setDescription(`Desde ahora el bot firma sus mensajes como **${nombre}** en este servidor.\n\n> Su cuenta de Discord sigue igual.`)
      .setColor('#57F287')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // Refrescar dashboard automáticamente
    const activePanel = await getActivePanel(interaction.guildId);
    await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
  }
};