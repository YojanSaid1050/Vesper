const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/guildManager');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { createLog } = require('../../utils/logCache');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    if (!createLog(`ban-${ban.user.id}`)) return;

    const guildConfig = getGuildConfig(ban.guild.id);
    const logChannel = ban.guild.channels.cache.get(guildConfig.general?.logChannel);
    if (!logChannel) return;

    let executor = 'Desconocido';
    try {
      const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
      const entry = fetchedLogs.entries.first();
      if (entry) executor = entry.executor.tag;
    } catch {}

    const embed = new EmbedBuilder()
      .setTitle('🔨 User Banned')
      .setColor('#ED4245')
      .addFields(
        { name: '👤 Usuario', value: ban.user.tag },
        { name: '🛠️ Baneado por', value: executor }
      )
      .setThumbnail(ban.user.displayAvatarURL())
      .setTimestamp();
    await sendBrandedMessage(logChannel, { embeds: [embed] });
  }
};