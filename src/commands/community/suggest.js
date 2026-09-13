const { SlashCommandBuilder } = require('discord.js');
const { createSuggestion } = require('../../core/CommunityService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sugerir')
    .setDescription('Publica una sugerencia para la comunidad.')
    .addStringOption(option => option.setName('texto').setDescription('Tu propuesta').setMinLength(5).setMaxLength(1500).setRequired(true)),
  async execute(interaction) {
    return createSuggestion(interaction, interaction.options.getString('texto'));
  }
};
