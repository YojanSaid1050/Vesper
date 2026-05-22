const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.GuildBanRemove,

  async execute(ban) {

    const canal = ban.guild.channels.cache.get(
      config.logChannel
    );

    if (!canal) return;

    const embed = new EmbedBuilder()

      .setTitle('🔓 User Unbanned')
      .setColor('#57F287')

      .addFields(
        {
          name: '👤 Usuario',
          value: `${ban.user.tag}`
        },

        {
          name: '🆔 ID',
          value: `${ban.user.id}`
        }
      )

      .setThumbnail(
        ban.user.displayAvatarURL()
      )

      .setTimestamp();

    canal.send({
      embeds: [embed]
    });

  }
};