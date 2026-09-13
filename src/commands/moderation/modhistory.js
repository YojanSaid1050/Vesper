const { SlashCommandBuilder } = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');
const { history, caseIdentifier } = require('../../core/ModerationService');

module.exports = {
  capability: CAPABILITIES.MODERATE,
  data: new SlashCommandBuilder()
    .setName('sanciones')
    .setDescription('Consulta el historial de moderación de un usuario.')
    .addUserOption(option => option.setName('usuario').setDescription('Usuario consultado').setRequired(true)),
  async execute(interaction) {
    const user = interaction.options.getUser('usuario');
    const rows = await history(interaction.guildId, user.id, 10);
    const text = rows.map(row => `• **#${caseIdentifier(row)} · ${row.action} · ${row.status || (row.active ? 'active' : 'resolved')}**\n<t:${Math.floor(new Date(row.createdAt).getTime() / 1000)}:f> · ${row.reason}`).join('\n\n');
    await interaction.reply({ content: text.slice(0, 1900) || `${user} no tiene sanciones registradas.`, flags: 64, allowedMentions: { parse: [] } });
  }
};
