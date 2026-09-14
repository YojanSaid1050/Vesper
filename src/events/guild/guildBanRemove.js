const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const {memberVars } = require('../../core/EmbedCatalog');
const { publishAlert } = require('../../core/AlertRouter');
const { createLog } = require('../../utils/logCache');
const { findRecentAuditEntry, auditExecutor } = require('../../utils/auditLog');

module.exports = {
  name: Events.GuildBanRemove,
  async execute(ban) {
    if (!createLog(`unban-${ban.user.id}`)) return;

    const guildConfig = await getGuildConfig(ban.guild.id); // Añadir await

    let executor = 'Desconocido';
    try {
      executor = auditExecutor(await findRecentAuditEntry(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id));
    } catch {}

    await publishAlert(ban.guild, guildConfig, 'log_ban_removed', {
      vars: memberVars({ user: ban.user, guild: ban.guild }, { executor }),
      defaults: {
        title: '🔓 Baneo retirado',
        color: '#57F287',
        thumbnailUrl: ban.user.displayAvatarURL()
      },
      fields: [
        { name: '👤 Usuario', value: ban.user.tag },
        { name: '🛠️ Desbaneado por', value: executor }
      ]
    });
  }
};
