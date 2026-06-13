const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('branding')
    .setDescription('Muestra la configuración actual del branding para webhooks')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = await getGuildConfig(interaction.guild.id);
    const branding = config.branding || {};

    const embed = new EmbedBuilder()
      .setTitle('🎨 Branding para Webhooks')
      .setDescription('Esta configuración solo afecta a los mensajes enviados por webhooks, NO al bot principal.')
      .addFields(
        { name: '📝 Nombre en webhooks', value: branding.name || 'Nombre del bot', inline: false },
        { name: '🖼️ Avatar en webhooks', value: branding.avatar || 'Avatar del bot', inline: false }
      )
      .setColor('#ffffff')
      .setTimestamp();

    if (branding.avatar) embed.setThumbnail(branding.avatar);

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};