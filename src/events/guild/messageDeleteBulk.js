// messageDeleteBulk.js — purgas de mensajes
const { Events } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { buildMessage } = require('../../core/EmbedCatalog');

module.exports = {
  name: Events.MessageBulkDelete,
  async execute(messages) {
    const first = messages.first();
    const guild = first?.guild;
    if (!guild) return;

    const guildConfig = await getGuildConfig(guild.id);
    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const channel = first.channel;
    await sendBrandedMessage(logChannel, buildMessage('log_messages_purged', {
      config: guildConfig,
      vars: {
        server: guild.name,
        memberCount: guild.memberCount,
        channel: `${channel}`,
        channelName: channel?.name || '',
        count: messages.size
      },
      defaults: { title: '🧹 Mensajes purgados', color: '#FAA61A' },
      fields: [
        { name: '📍 Canal', value: `${channel}`, inline: true },
        { name: '🔢 Cantidad', value: String(messages.size), inline: true }
      ]
    }));
  }
};
