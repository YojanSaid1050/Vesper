const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { createLog } = require('../../utils/logCache');
const { findRecentAuditEntry, auditExecutor } = require('../../utils/auditLog');

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    if (!message.guild || message.author?.bot) return;

    // Discord puede emitir este evento con un mensaje parcial. En ese caso no
    // hay autor ni contenido disponibles, pero el registro no debe fallar.
    const authorTag = message.author?.tag || 'Usuario desconocido';

    const guildConfig = await getGuildConfig(message.guild.id); // Añadir await
    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = message.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    if (!createLog(`delete-${message.id}`)) return;

    let deleter = 'Desconocido';
    try {
      const deletionLog = await findRecentAuditEntry(message.guild, AuditLogEvent.MessageDelete, message.author?.id, {
        extraMatches: extra => !extra?.channel?.id || extra.channel.id === message.channelId
      });
      deleter = auditExecutor(deletionLog);
    } catch {}

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Message Deleted')
      .setColor('#ED4245')
      .addFields(
        { name: '👤 Usuario', value: authorTag },
        { name: '🛠️ Eliminado por', value: deleter },
        { name: '📍 Canal', value: `${message.channel}` },
        { name: '💬 Contenido', value: message.content?.substring(0, 1000) || '*Sin texto*' }
      )
      .setTimestamp();
    await sendBrandedMessage(logChannel, { embeds: [embed] });
  }
};
