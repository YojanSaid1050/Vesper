const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.MessageCreate,

  async execute(message) {

    // SOLO BOTS

    if (!message.author.bot) return;

    // IGNORAR TU BOT

    if (message.author.id === message.client.user.id)
      return;

    const canal = message.guild.channels.cache.get(
      config.botLogChannel
    );

    if (!canal) return;

    const embed = new EmbedBuilder()

      .setTitle('🤖 Bot Message Detected')
      .setColor('#5865F2')

      .addFields(
        {
          name: '🤖 Bot',
          value: `${message.author.tag}`,
          inline: true
        },

        {
          name: '📍 Canal',
          value: `${message.channel}`,
          inline: true
        },

        {
          name: '💬 Mensaje',
          value: message.content || '*Sin texto*'
        }
      )

      .setThumbnail(
        message.author.displayAvatarURL()
      )

      .setTimestamp();

    canal.send({
      embeds: [embed]
    });

  }
};