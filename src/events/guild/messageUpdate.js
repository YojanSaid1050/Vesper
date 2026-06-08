const { Events, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/guildManager');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { createLog } = require('../../utils/logCache');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const guildConfig = getGuildConfig(oldMessage.guild.id);
    const logChannel = oldMessage.guild.channels.cache.get(guildConfig.general?.logChannel);
    if (!logChannel) return;

    if (!createLog(`edit-${newMessage.id}`)) return;

    const embed = new EmbedBuilder()
      .setTitle('✏️ Message Edited')
      .setColor('#FAA61A')
      .addFields(
        { name: '👤 Usuario', value: oldMessage.author.tag },
        { name: '📍 Canal', value: `${oldMessage.channel}` },
        { name: '📌 Antes', value: oldMessage.content || '*Sin texto*' },
        { name: '📌 Después', value: newMessage.content || '*Sin texto*' }
      )
      .setTimestamp();
    await sendBrandedMessage(logChannel, { embeds: [embed] });
  }
};