const { Events, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { createLog } = require('../../utils/logCache');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const guildConfig = await getGuildConfig(oldMessage.guild.id); // Añadir await
    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = oldMessage.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    if (!createLog(`edit-${newMessage.id}`)) return;

    const embed = new EmbedBuilder()
      .setTitle('✏️ Message Edited')
      .setColor('#FAA61A')
      .addFields(
        { name: '👤 Usuario', value: oldMessage.author.tag },
        { name: '📍 Canal', value: `${oldMessage.channel}` },
        { name: '📌 Antes', value: oldMessage.content?.substring(0, 500) || '*Sin texto*' },
        { name: '📌 Después', value: newMessage.content?.substring(0, 500) || '*Sin texto*' }
      )
      .setTimestamp();
    await sendBrandedMessage(logChannel, { embeds: [embed] });
  }
};