const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGeneralConfig } = require('../../database/guildManager');
const { createLog } = require('../../utils/logCache');

module.exports = {
  name: Events.GuildRoleDelete,
  async execute(role) {
    if (!createLog(`role-delete-${role.id}`)) return;

    const general = getGeneralConfig(role.guild.id);
    const logChannel = role.guild.channels.cache.get(general.logChannel);
    if (!logChannel) return;

    let executor = 'Desconocido';
    try {
      const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
      const deleteLog = fetchedLogs.entries.first();
      if (deleteLog) executor = deleteLog.executor.tag;
    } catch {}

    const embed = new EmbedBuilder()
      .setTitle('❌ Role Deleted')
      .setColor('#ff4d4d')
      .addFields(
        { name: '🎭 Rol', value: role.name },
        { name: '🛠️ Eliminado por', value: executor }
      )
      .setTimestamp();
    await logChannel.send({ embeds: [embed] });
  }
};