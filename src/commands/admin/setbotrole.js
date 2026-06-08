const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSection } = require('../../database/guildManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbotrole')
    .setDescription('Configura el rol automático para bots')
    .addRoleOption(opt => opt.setName('rol').setDescription('Rol para bots').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const rol = interaction.options.getRole('rol');
    updateGuildSection(interaction.guild.id, 'general', { botRole: rol.id });
    await interaction.reply({ content: `✅ Rol para bots configurado: ${rol}`, flags: 64 });
  }
};