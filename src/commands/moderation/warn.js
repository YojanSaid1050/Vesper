const { SlashCommandBuilder } = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');
const { createCase } = require('../../core/ModerationService');
const { getGuildConfig } = require('../../database/mongoManager');
const { isModuleEnabledConfig } = require('../../config/guildPolicy');

module.exports = {
  scope: 'main',
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
    const reason = interaction.options.getString('motivo');
    await createCase({ guildId: interaction.guildId, userId: user.id, moderatorId: interaction.user.id, action: 'warning', reason });
    await interaction.reply({ content: `Advertencia registrada para ${user}: ${reason}`, allowedMentions: { parse: [] } });
  }
};
