const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.ChannelCreate,

  async execute(channel) {

    const canal = channel.guild.channels.cache.get(
      config.logChannel
    );

    if (!canal) return;

    const embed = new EmbedBuilder()

      .setTitle('📁 Channel Created')
      .setColor('#57F287')

      .addFields(
        {
          name: '📌 Canal',
          value: `${channel}`
        },

        {
          name: '🆔 ID',
          value: `${channel.id}`
        }
      )

      .setTimestamp();

    canal.send({
      embeds: [embed]
    });

  }
};