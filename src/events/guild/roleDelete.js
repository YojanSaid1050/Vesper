// roleDelete.js
const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado
const { createLog } = require('../../utils/logCache');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { buildMessage } = require('../../core/EmbedCatalog');
const { findRecentAuditEntry, auditExecutor } = require('../../utils/auditLog');

module.exports = {
  name: Events.GuildRoleDelete,
  async execute(role) {
    if (!createLog(`role-delete-${role.id}`)) return;

    const guildConfig = await getGuildConfig(role.guild.id); // Añadir await
    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = role.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    let executor = 'Desconocido';
    try {
      executor = auditExecutor(await findRecentAuditEntry(role.guild, AuditLogEvent.RoleDelete, role.id));
    } catch {}

    await sendBrandedMessage(logChannel, buildMessage('log_role_deleted', {
      config: guildConfig,
      vars: {
        role: role.name, roleName: role.name, executor,
        server: role.guild.name, memberCount: role.guild.memberCount
      },
      defaults: { title: '❌ Role Deleted', color: '#ff4d4d' },
      fields: [
        { name: '🎭 Rol', value: role.name },
        { name: '🛠️ Eliminado por', value: executor }
      ]
    }));
  }
};
