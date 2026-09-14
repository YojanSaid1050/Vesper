// messageDeleteBulk.js — purgas de mensajes
const { Events } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager');
const { publishAlert } = require('../../core/AlertRouter');

module.exports = {
  name: Events.MessageBulkDelete,
  async execute(messages) {
    const first = messages.first();
    const guild = first?.guild;
    if (!guild) return;

    const guildConfig = await getGuildConfig(guild.id);

    const channel = first.channel;
    await publishAlert(guild, guildConfig, 'log_messages_purged', {
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
    });
  }
};
