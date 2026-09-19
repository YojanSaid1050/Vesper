const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const {memberVars } = require('../../core/EmbedCatalog');
const { publishAlert } = require('../../core/AlertRouter');
const { createLog } = require('../../utils/logCache');
const { findRecentAuditEntry, auditExecutor } = require('../../utils/auditLog');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    if (!createLog(`ban-${ban.user.id}`)) return;

    const guildConfig = await getGuildConfig(ban.guild.id); // Añadir await

    let executor = 'Desconocido';
    try {
      executor = auditExecutor(await findRecentAuditEntry(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id));
    } catch {}

    // El motivo lo guarda Discord en el propio baneo; el de la auditoría puede
    // no haber llegado todavía.
    const reason = ban.reason || 'Sin motivo';

    await publishAlert(ban.guild, guildConfig, 'log_ban_added', {
      vars: memberVars({ user: ban.user, guild: ban.guild }, { executor, reason }),
      defaults: { thumbnailUrl: ban.user.displayAvatarURL() }
    });
  }
};
