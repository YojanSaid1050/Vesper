const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

const {
  createLog
} = require('../utils/logCache');

module.exports = {
  name: Events.MessageUpdate,

  async execute(oldMessage, newMessage) {

    if (!oldMessage.guild) return;

    if (oldMessage.author?.bot) return;

    if (oldMessage.content === newMessage.content)
      return;

    const logKey =
      `edit-${newMessage.id}`;

    if (!createLog(logKey)) return;

    const canal =
      oldMessage.guild.channels.cache.get(
        config.logChannel
      );

    if (!canal) return;

    const embed = new EmbedBuilder()

      .setTitle('✏️ Message Edited')

      .setColor('#ffaa00')

      .addFields(
        {
          name: '👤 Usuario',
          value: `${oldMessage.author.tag}`
        },

        {
          name: '📍 Canal',
          value: `${oldMessage.channel}`
        },

        {
          name: '📌 Antes',
          value:
            oldMessage.content || '*Sin texto*'
        },

        {
          name: '📌 Después',
          value:
            newMessage.content || '*Sin texto*'
        }
      )

      .setTimestamp();

    canal.send({
      embeds: [embed]
    });

  }
};