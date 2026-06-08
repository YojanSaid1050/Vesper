const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../../database/guildManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('branding')
    .setDescription('Muestra la configuración actual del branding')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = getGuildConfig(interaction.guild.id);
    const branding = config.branding || {};

    const embed = new EmbedBuilder()
      .setTitle('🎨 Branding Actual')
      .addFields(
        { name: '📝 Nombre', value: branding.name || 'Sin configurar', inline: false },
        { name: '🖼️ Avatar', value: branding.avatar || 'Sin configurar', inline: false }
      )
      .setColor('#ffffff')
      .setTimestamp();

    if (branding.avatar) embed.setThumbnail(branding.avatar);

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};