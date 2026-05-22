const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.MessageUpdate,

  async execute(oldMessage, newMessage) {

    if (!oldMessage.guild) return;

    if (oldMessage.author?.bot) return;

    if (oldMessage.content === newMessage.content) return;

    const canal = oldMessage.guild.channels.cache.get(config.logChannel);

    if (!canal) return;

    const embed = new EmbedBuilder()
      .setTitle('✏️ Message Edited')
      .setColor('#ffaa00')

      .addFields(
        {
          name: '👤 Usuario',
          value: `${oldMessage.author}`,
          inline: true
        },

        {
          name: '📍 Canal',
          value: `${oldMessage.channel}`,
          inline: true
        },

        {
          name: '📝 Antes',
          value: oldMessage.content || '*Vacío*'
        },

        {
          name: '📝 Después',
          value: newMessage.content || '*Vacío*'
        }
      )

      .setTimestamp();

    canal.send({
      embeds: [embed]
    });

  }
};