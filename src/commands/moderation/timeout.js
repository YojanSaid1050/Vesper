const { SlashCommandBuilder } = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');
const { createCase, caseIdentifier } = require('../../core/ModerationService');
const { getGuildConfig } = require('../../database/mongoManager');
const { isModuleEnabledConfig } = require('../../config/guildPolicy');

module.exports = {
  capability: CAPABILITIES.MODERATE,
  data: new SlashCommandBuilder()
    .setName('aislar')
    .setDescription('Aplica un timeout temporal a un miembro.')
    .addUserOption(option => option.setName('usuario').setDescription('Miembro objetivo').setRequired(true))
    .addIntegerOption(option => option.setName('minutos').setDescription('Duración entre 1 y 40320 minutos').setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(option => option.setName('motivo').setDescription('Motivo').setRequired(true).setMaxLength(1000)),
  async execute(interaction) {
    const config = await getGuildConfig(interaction.guildId);
    if (!isModuleEnabledConfig(config, 'moderation')) return interaction.reply({ content: 'El módulo de moderación está desactivado.', flags: 64 });
    const user = interaction.options.getUser('usuario');
    if (user.id === interaction.user.id || user.id === interaction.client.user.id || user.bot) {
      return interaction.reply({ content: 'No puedes aislarte a ti mismo ni aislar a un bot.', flags: 64 });
    }
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member?.moderatable) return interaction.reply({ content: 'No puedo aplicar timeout a ese miembro. Comprueba la jerarquía de roles.', flags: 64 });
    const minutes = interaction.options.getInteger('minutos');
    const reason = interaction.options.getString('motivo');
    await member.timeout(minutes * 60 * 1000, reason);
    const record = await createCase({ guildId: interaction.guildId, userId: user.id, moderatorId: interaction.user.id, action: 'timeout', reason, expiresAt: new Date(Date.now() + minutes * 60 * 1000) });
    await interaction.reply({ content: `Timeout **#${caseIdentifier(record)}** aplicado a ${user} durante ${minutes} minuto(s).`, allowedMentions: { parse: [] } });
  }
};
