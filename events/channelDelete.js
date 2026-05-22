const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.ChannelDelete,

  async execute(channel) {

    const canal = channel.guild.channels.cache.get(
      config.logChannel
    );

    if (!canal) return;

    const embed = new EmbedBuilder()

      .setTitle('🗑️ Channel Deleted')
      .setColor('#ff4d4d')

      .addFields(
        {
          name: '📌 Canal',
          value: `${channel.name}`
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