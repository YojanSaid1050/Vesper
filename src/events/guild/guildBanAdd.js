const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { buildMessage, memberVars } = require('../../core/EmbedCatalog');
const { createLog } = require('../../utils/logCache');
const { findRecentAuditEntry, auditExecutor } = require('../../utils/auditLog');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    if (!createLog(`ban-${ban.user.id}`)) return;

    const guildConfig = await getGuildConfig(ban.guild.id); // Añadir await
    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = ban.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    let executor = 'Desconocido';
    try {
      executor = auditExecutor(await findRecentAuditEntry(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id));
    } catch {}

    await sendBrandedMessage(logChannel, buildMessage('log_ban_added', {
      config: guildConfig,
      vars: memberVars({ user: ban.user, guild: ban.guild }, { executor }),
      defaults: {
        title: '🔨 User Banned',
        color: '#ED4245',
        thumbnailUrl: ban.user.displayAvatarURL()
      },
      fields: [
        { name: '👤 Usuario', value: ban.user.tag },
        { name: '🛠️ Baneado por', value: executor }
      ]
    }));
  }
};
