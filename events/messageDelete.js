const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.MessageDelete,

  async execute(message) {

    if (!message.guild) return;

    if (message.author?.bot) return;

    const canal = message.guild.channels.cache.get(config.logChannel);

    if (!canal) return;

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Message Deleted')
      .setColor('#ff4d4d')

      .addFields(
        {
          name: '👤 Usuario',
          value: `${message.author}`,
          inline: true
        },

        {
          name: '📍 Canal',
          value: `${message.channel}`,
          inline: true
        },

        {
          name: '💬 Contenido',
          value: message.content || '*Sin texto*'
        }
      )

      .setTimestamp();

    canal.send({
      embeds: [embed]
    });

  }
};