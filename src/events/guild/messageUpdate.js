const { Events, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { buildMessage, memberVars } = require('../../core/EmbedCatalog');
const { createLog } = require('../../utils/logCache');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    // El contenido anterior puede ser parcial (por ejemplo tras reiniciar el
    // proceso). Conservamos el log con valores seguros en vez de lanzar error.
    const authorTag = oldMessage.author?.tag || newMessage.author?.tag || 'Usuario desconocido';

    const guildConfig = await getGuildConfig(oldMessage.guild.id); // Añadir await
    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = oldMessage.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    if (!createLog(`edit-${newMessage.id}`)) return;

    const before = oldMessage.content?.substring(0, 500) || '*Sin texto*';
    const after = newMessage.content?.substring(0, 500) || '*Sin texto*';
    await sendBrandedMessage(logChannel, buildMessage('log_message_edited', {
      config: guildConfig,
      vars: memberVars(newMessage.member || { user: newMessage.author, guild: newMessage.guild }, {
        userTag: authorTag, channel: `${oldMessage.channel}`,
        channelName: oldMessage.channel?.name || '', before, after
      }),
      defaults: { title: '✏️ Message Edited', color: '#FAA61A' },
      fields: [
        { name: '👤 Usuario', value: authorTag },
        { name: '📍 Canal', value: `${oldMessage.channel}` },
        { name: '📌 Antes', value: before },
        { name: '📌 Después', value: after }
      ]
    }));
  }
};
