// roleDelete.js
const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado
const { createLog } = require('../../utils/logCache');
const { publishAlert } = require('../../core/AlertRouter');
const { quienLoHizo, findRecentAuditEntry, resolveAuditExecutor } = require('../../utils/auditLog');

// El rol de un bot o de una integración no lo borra nadie: Discord lo quita
// solo al retirar ese bot y no deja entrada de «rol borrado» en la auditoría.
// Se busca quién expulsó al bot y, si no consta, se dice que fue automático.
async function whoDeleted(role) {
  const botId = role.tags?.botId;
  if (!role.managed && !botId && !role.tags?.integrationId) {
    return quienLoHizo(role.guild, AuditLogEvent.RoleDelete, role.id);
  }
  const kick = botId
    ? await findRecentAuditEntry(role.guild, AuditLogEvent.MemberKick, botId, { attemptDelaysMs: [0, 1_500] }).catch(() => null)
    : null;
  const who = kick ? await resolveAuditExecutor(role.guild, kick) : null;
  return who && who !== 'Desconocido' ? `${who} (al retirar el bot)` : 'Automático (Discord lo borra al retirar su bot)';
}

module.exports = {
  whoDeleted,
  name: Events.GuildRoleDelete,
  async execute(role) {
    if (!createLog(`role-delete-${role.id}`)) return;

    const guildConfig = await getGuildConfig(role.guild.id); // Añadir await

    const executor = await whoDeleted(role);

    await publishAlert(role.guild, guildConfig, 'log_role_deleted', {
      vars: {
        role: role.name, roleName: role.name, roleId: role.id, executor,
        server: role.guild.name, memberCount: role.guild.memberCount
      },
      defaults: { authorIconUrl: role.guild.iconURL() }
});
  }
};
