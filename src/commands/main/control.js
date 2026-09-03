const { SlashCommandBuilder } = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');
const { controlCenterPayload } = require('../../dashboard/controlCenter');

module.exports = {
  scope: 'main',
  capability: CAPABILITIES.MAIN_ADMIN,
  data: new SlashCommandBuilder()
    .setName('vesper-control')
    .setDescription('Abre el centro de control exclusivo del servidor principal.'),
  async execute(interaction) {
    await interaction.reply({ ...(await controlCenterPayload(interaction.guild)), flags: 64 });
  }
};
