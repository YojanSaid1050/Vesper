const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSection } = require('../../database/guildManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetbranding')
    .setDescription('Restablece el branding del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    updateGuildSection(interaction.guild.id, 'branding', { name: null, avatar: null });
    await interaction.reply({ content: '✅ Branding restablecido correctamente.', flags: 64 });
  }
};