const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('branding')
    .setDescription('Muestra el nombre y el logo con los que publica el bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = await getGuildConfig(interaction.guild.id);
    const branding = config.branding || {};

    const embed = new EmbedBuilder()
      .setTitle('🎨 Nombre y logo del bot')
      .setDescription('Así firma el bot sus mensajes en este servidor. Su cuenta de Discord sigue igual.')
      .addFields(
        { name: '📝 Nombre', value: branding.name || 'El de la cuenta del bot', inline: false },
        { name: '🖼️ Logo', value: branding.avatar ? 'Imagen propia (se ve al lado)' : 'El de la cuenta del bot', inline: false }
      )
      .setColor('#ffffff')
      .setTimestamp();

    if (branding.avatar) embed.setThumbnail(branding.avatar);

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};