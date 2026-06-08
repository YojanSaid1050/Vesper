const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/guildManager');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { createLog } = require('../../utils/logCache');

module.exports = {
  name: Events.GuildBanRemove,
  async execute(ban) {
    if (!createLog(`unban-${ban.user.id}`)) return;

    const guildConfig = getGuildConfig(ban.guild.id);
    const logChannel = ban.guild.channels.cache.get(guildConfig.general?.logChannel);
    if (!logChannel) return;

    let executor = 'Desconocido';
    try {
      const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove });
      const entry = fetchedLogs.entries.first();
      if (entry) executor = entry.executor.tag;
    } catch {}

    const embed = new EmbedBuilder()
      .setTitle('🔓 User Unbanned')
      .setColor('#57F287')
      .addFields(
        { name: '👤 Usuario', value: ban.user.tag },
        { name: '🛠️ Desbaneado por', value: executor }
      )
      .setThumbnail(ban.user.displayAvatarURL())
      .setTimestamp();
    await sendBrandedMessage(logChannel, { embeds: [embed] });
  }
};