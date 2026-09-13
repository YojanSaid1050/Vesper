const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');
const {
  getCase,
  transitionCase,
  addCaseNote,
  caseIdentifier
} = require('../../core/ModerationService');

const ACTION_LABELS = { warning: 'Advertencia', timeout: 'Aislamiento', filter: 'Filtro automático' };
const STATUS_LABELS = { active: '🟠 Activo', resolved: '🟢 Resuelto', revoked: '⚫ Revocado' };

function caseEmbed(record) {
  const notes = (record.notes || []).slice(-5).map(note =>
    `• <@${note.moderatorId}> · <t:${Math.floor(new Date(note.createdAt).getTime() / 1000)}:f>\n${note.text}`
  ).join('\n\n');
  return new EmbedBuilder()
    .setTitle(`Caso #${caseIdentifier(record)}`)
    .setColor(record.status === 'active' || (!record.status && record.active) ? 0xFEE75C : record.status === 'revoked' ? 0x747F8D : 0x57F287)
    .addFields(
      { name: 'Usuario', value: `<@${record.userId}>`, inline: true },
      { name: 'Acción', value: ACTION_LABELS[record.action] || record.action, inline: true },
      { name: 'Estado', value: STATUS_LABELS[record.status] || (record.active ? '🟠 Activo' : '🟢 Resuelto'), inline: true },
      { name: 'Responsable', value: `<@${record.moderatorId}>`, inline: true },
      { name: 'Creado', value: `<t:${Math.floor(new Date(record.createdAt).getTime() / 1000)}:f>`, inline: true },
      { name: 'Expira', value: record.expiresAt ? `<t:${Math.floor(new Date(record.expiresAt).getTime() / 1000)}:R>` : 'No aplica', inline: true },
      { name: 'Motivo', value: String(record.reason || 'Sin motivo').slice(0, 1024) },
      ...(record.evidence ? [{ name: 'Evidencia', value: String(record.evidence).slice(0, 1024) }] : []),
      { name: 'Notas recientes', value: notes.slice(0, 1024) || 'Sin notas.' }
    )
    .setFooter({ text: record.resolvedBy ? `Último cierre por ${record.resolvedBy}` : 'Registro interno de moderación' })
    .setTimestamp(record.updatedAt || record.createdAt);
}

function idOption(option) {
  return option.setName('id').setDescription('ID visible del caso').setRequired(true).setMinLength(6).setMaxLength(24);
}

module.exports = {
  capability: CAPABILITIES.MODERATE,
  data: new SlashCommandBuilder()
    .setName('caso')
    .setDescription('Consulta y administra casos de moderación.')
    .addSubcommand(command => command.setName('ver').setDescription('Muestra un caso.').addStringOption(idOption))
    .addSubcommand(command => command.setName('resolver').setDescription('Marca un caso como resuelto.')
      .addStringOption(idOption)
      .addStringOption(option => option.setName('nota').setDescription('Nota de cierre').setMaxLength(1000)))
    .addSubcommand(command => command.setName('revocar').setDescription('Invalida una sanción registrada.')
      .addStringOption(idOption)
      .addStringOption(option => option.setName('motivo').setDescription('Motivo de la revocación').setRequired(true).setMaxLength(1000)))
    .addSubcommand(command => command.setName('reabrir').setDescription('Reabre el seguimiento de un caso.')
      .addStringOption(idOption)
      .addStringOption(option => option.setName('nota').setDescription('Motivo de reapertura').setMaxLength(1000)))
    .addSubcommand(command => command.setName('nota').setDescription('Añade una nota interna al caso.')
      .addStringOption(idOption)
      .addStringOption(option => option.setName('texto').setDescription('Contenido de la nota').setRequired(true).setMaxLength(1000))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const identifier = interaction.options.getString('id');
    let record;

    if (subcommand === 'ver') record = await getCase(interaction.guildId, identifier);
    if (subcommand === 'resolver') {
      record = await transitionCase(interaction.guildId, identifier, 'resolved', interaction.user.id, interaction.options.getString('nota'));
    }
    if (subcommand === 'revocar') {
      const current = await getCase(interaction.guildId, identifier);
      if (current?.action === 'timeout') {
        const member = await interaction.guild.members.fetch(current.userId).catch(() => null);
        if (member?.communicationDisabledUntilTimestamp && !member.moderatable) {
          return interaction.reply({ content: 'No puedo retirar el aislamiento por la jerarquía de roles. El caso no fue revocado.', flags: 64 });
        }
        if (member?.communicationDisabledUntilTimestamp) {
          await member.timeout(null, `Caso #${caseIdentifier(current)} revocado: ${interaction.options.getString('motivo')}`);
        }
      }
      record = await transitionCase(interaction.guildId, identifier, 'revoked', interaction.user.id, interaction.options.getString('motivo'));
    }
    if (subcommand === 'reabrir') {
      record = await transitionCase(interaction.guildId, identifier, 'active', interaction.user.id, interaction.options.getString('nota'));
    }
    if (subcommand === 'nota') {
      record = await addCaseNote(interaction.guildId, identifier, interaction.user.id, interaction.options.getString('texto'));
    }

    if (!record) return interaction.reply({ content: `No encontré el caso **#${identifier.toUpperCase()}** en este servidor.`, flags: 64 });
    return interaction.reply({ embeds: [caseEmbed(record)], flags: 64, allowedMentions: { parse: [] } });
  }
};

module.exports.caseEmbed = caseEmbed;
