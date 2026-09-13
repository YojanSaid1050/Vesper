const { Events, EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { createLog } = require('../../utils/logCache');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { buildMessage, memberVars } = require('../../core/EmbedCatalog');
const { findRecentAuditEntry, auditExecutor } = require('../../utils/auditLog');

module.exports = {
  name: Events.ChannelCreate,
  async execute(channel) {
    if (!createLog(`channel-create-${channel.id}`)) return;

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

    let creator = 'Desconocido';
    try {
      creator = auditExecutor(await findRecentAuditEntry(channel.guild, AuditLogEvent.ChannelCreate, channel.id));
    } catch {}

    await sendBrandedMessage(logChannel, buildMessage('log_channel_created', {
      config: guildConfig,
      vars: {
        channel: `${channel}`, channelName: channel.name, type: tipo, executor: creator,
        server: channel.guild.name, memberCount: channel.guild.memberCount
      },
      defaults: { title: '📁 Channel Created', color: '#57F287' },
      fields: [
        { name: '📌 Canal', value: `${channel}` },
        { name: '📂 Tipo', value: tipo, inline: true },
        { name: '🛠️ Creado por', value: creator, inline: true }
      ]
    }));
  }
};
