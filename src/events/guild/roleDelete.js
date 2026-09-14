// roleDelete.js
const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado
const { createLog } = require('../../utils/logCache');
const { publishAlert } = require('../../core/AlertRouter');
const { findRecentAuditEntry, auditExecutor } = require('../../utils/auditLog');

module.exports = {
  name: Events.GuildRoleDelete,
  async execute(role) {
    if (!createLog(`role-delete-${role.id}`)) return;

    const guildConfig = await getGuildConfig(role.guild.id); // Añadir await

    let executor = 'Desconocido';
    try {
      executor = auditExecutor(await findRecentAuditEntry(role.guild, AuditLogEvent.RoleDelete, role.id));
    } catch {}

    await publishAlert(role.guild, guildConfig, 'log_role_deleted', {
      vars: {
        role: role.name, roleName: role.name, executor,
        server: role.guild.name, memberCount: role.guild.memberCount
      },
      defaults: { title: '❌ Rol borrado', color: '#ff4d4d' },
      fields: [
        { name: '🎭 Rol', value: role.name },
        { name: '🛠️ Eliminado por', value: executor }
      ]
    });
  }
};
