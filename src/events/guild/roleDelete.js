// roleDelete.js
const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado
const { createLog } = require('../../utils/logCache');
const { sendBrandedMessage } = require('../../utils/webhookSender');
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

    const embed = new EmbedBuilder()
      .setTitle('❌ Role Deleted')
      .setColor('#ff4d4d')
      .addFields(
        { name: '🎭 Rol', value: role.name },
        { name: '🛠️ Eliminado por', value: executor }
      )
      .setTimestamp();
    await sendBrandedMessage(logChannel, { embeds: [embed] });
  }
};
