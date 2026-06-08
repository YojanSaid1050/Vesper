const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/guildManager');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { createLog } = require('../../utils/logCache');

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    if (!message.guild || message.author?.bot) return;

    const guildConfig = getGuildConfig(message.guild.id);
    const logChannel = message.guild.channels.cache.get(guildConfig.general?.logChannel);
    if (!logChannel) return;

    if (!createLog(`delete-${message.id}`)) return;

    let deleter = 'Desconocido';
    try {
      const fetchedLogs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
      const deletionLog = fetchedLogs.entries.first();
      if (deletionLog) deleter = deletionLog.executor.tag;
    } catch {}

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Message Deleted')
      .setColor('#ED4245')
      .addFields(
        { name: '👤 Usuario', value: message.author.tag },
        { name: '🛠️ Eliminado por', value: deleter },
        { name: '📍 Canal', value: `${message.channel}` },
        { name: '💬 Contenido', value: message.content || '*Sin texto*' }
      )
      .setTimestamp();
    await sendBrandedMessage(logChannel, { embeds: [embed] });
  }
};