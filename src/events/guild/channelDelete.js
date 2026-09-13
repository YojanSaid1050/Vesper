const { Events, EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { createLog } = require('../../utils/logCache');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { buildMessage, memberVars } = require('../../core/EmbedCatalog');
const { findRecentAuditEntry, auditExecutor } = require('../../utils/auditLog');

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (!createLog(`channel-delete-${channel.id}`)) return;

    const guildConfig = await getGuildConfig(channel.guild.id); // Añadir await
    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = channel.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const tipo = {
      [ChannelType.GuildText]: '💬 Texto',
      [ChannelType.GuildVoice]: '🔊 Voz',
      [ChannelType.GuildCategory]: '📂 Categoría',
      [ChannelType.GuildAnnouncement]: '📢 Anuncios',
      [ChannelType.GuildForum]: '🧵 Foro'
    }[channel.type] || 'Desconocido';

    let executor = 'Desconocido';
    try {
      executor = auditExecutor(await findRecentAuditEntry(channel.guild, AuditLogEvent.ChannelDelete, channel.id));
    } catch {}

    await sendBrandedMessage(logChannel, buildMessage('log_channel_deleted', {
      config: guildConfig,
      vars: {
        channel: channel.name, channelName: channel.name, type: tipo, executor,
        server: channel.guild.name, memberCount: channel.guild.memberCount
      },
      defaults: { title: '🗑️ Channel Deleted', color: '#ED4245' },
      fields: [
        { name: '📌 Canal', value: channel.name },
        { name: '📂 Tipo', value: tipo, inline: true },
        { name: '🛠️ Eliminado por', value: executor, inline: true }
      ]
    }));
  }
};
