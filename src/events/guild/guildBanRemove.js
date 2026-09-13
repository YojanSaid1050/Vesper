const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { buildMessage, memberVars } = require('../../core/EmbedCatalog');
const { createLog } = require('../../utils/logCache');
const { findRecentAuditEntry, auditExecutor } = require('../../utils/auditLog');

module.exports = {
  name: Events.GuildBanRemove,
  async execute(ban) {
    if (!createLog(`unban-${ban.user.id}`)) return;

    const guildConfig = await getGuildConfig(ban.guild.id); // Añadir await
    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = ban.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    let executor = 'Desconocido';
    try {
      executor = auditExecutor(await findRecentAuditEntry(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id));
    } catch {}

    await sendBrandedMessage(logChannel, buildMessage('log_ban_removed', {
      config: guildConfig,
      vars: memberVars({ user: ban.user, guild: ban.guild }, { executor }),
      defaults: {
        title: '🔓 User Unbanned',
        color: '#57F287',
        thumbnailUrl: ban.user.displayAvatarURL()
      },
      fields: [
        { name: '👤 Usuario', value: ban.user.tag },
        { name: '🛠️ Desbaneado por', value: executor }
      ]
    }));
  }
};
