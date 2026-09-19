// roleDelete.js
const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado
const { createLog } = require('../../utils/logCache');
const { publishAlert } = require('../../core/AlertRouter');
const { quienLoHizo } = require('../../utils/auditLog');

module.exports = {
  name: Events.GuildRoleDelete,
  async execute(role) {
    if (!createLog(`role-delete-${role.id}`)) return;

    const guildConfig = await getGuildConfig(role.guild.id); // Añadir await

    const executor = await quienLoHizo(role.guild, AuditLogEvent.RoleDelete, role.id);

    await publishAlert(role.guild, guildConfig, 'log_role_deleted', {
      vars: {
        role: role.name, roleName: role.name, roleId: role.id, executor,
        server: role.guild.name, memberCount: role.guild.memberCount
      },
      defaults: { authorIconUrl: role.guild.iconURL() }
});
  }
};
