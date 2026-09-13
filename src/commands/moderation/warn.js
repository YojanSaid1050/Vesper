const { SlashCommandBuilder } = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');
const { createCase, caseIdentifier } = require('../../core/ModerationService');
const { getGuildConfig } = require('../../database/mongoManager');
const { isModuleEnabledConfig } = require('../../config/guildPolicy');

module.exports = {
  capability: CAPABILITIES.MODERATE,
  data: new SlashCommandBuilder()
    .setName('advertir')
    .setDescription('Registra una advertencia de moderación.')
    .addUserOption(option => option.setName('usuario').setDescription('Usuario advertido').setRequired(true))
    .addStringOption(option => option.setName('motivo').setDescription('Motivo de la advertencia').setRequired(true).setMaxLength(1000)),
  async execute(interaction) {
    const config = await getGuildConfig(interaction.guildId);
    if (!isModuleEnabledConfig(config, 'moderation')) return interaction.reply({ content: 'El módulo de moderación está desactivado.', flags: 64 });
    const user = interaction.options.getUser('usuario');
    if (user.id === interaction.user.id || user.id === interaction.client.user.id || user.bot) {
      return interaction.reply({ content: 'No puedes registrar esta advertencia contra ti mismo o contra un bot.', flags: 64 });
    }
    const reason = interaction.options.getString('motivo');
    const record = await createCase({ guildId: interaction.guildId, userId: user.id, moderatorId: interaction.user.id, action: 'warning', reason });
    await interaction.reply({ content: `Advertencia **#${caseIdentifier(record)}** registrada para ${user}: ${reason}`, allowedMentions: { parse: [] } });
  }
};
