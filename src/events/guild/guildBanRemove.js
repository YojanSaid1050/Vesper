const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const {memberVars } = require('../../core/EmbedCatalog');
const { publishAlert } = require('../../core/AlertRouter');
const { createLog } = require('../../utils/logCache');
const { quienLoHizo } = require('../../utils/auditLog');

module.exports = {
  name: Events.GuildBanRemove,
  async execute(ban) {
    if (!createLog(`unban-${ban.user.id}`)) return;

    const guildConfig = await getGuildConfig(ban.guild.id); // Añadir await

    const executor = await quienLoHizo(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);

    await publishAlert(ban.guild, guildConfig, 'log_ban_removed', {
      vars: memberVars({ user: ban.user, guild: ban.guild }, { executor }),
      defaults: { authorIconUrl: ban.user.displayAvatarURL() }
    });
  }
};
