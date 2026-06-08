const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { updateGuildSection } = require('../../database/guildManager');

function isValidImageUrl(url) {
  if (!url) return false;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return false;
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)(\?.*)?$/i.test(parsedUrl.pathname);
  } catch { return false; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbotavatar')
    .setDescription('Configura el avatar usado en los webhooks')
    .addStringOption(opt => opt.setName('url').setDescription('URL de la imagen').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const url = interaction.options.getString('url');
    
    if (!isValidImageUrl(url)) {
      return interaction.reply({ content: '❌ La URL debe apuntar a una imagen válida (jpg, jpeg, png, gif, webp, bmp, svg, ico).', flags: 64 });
    }

    updateGuildSection(interaction.guild.id, 'branding', { avatar: url });

    const embed = new EmbedBuilder()
      .setTitle('✅ Avatar actualizado')
      .setImage(url)
      .setColor('#ffffff')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};