const {
  Events,
 EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.GuildRoleDelete,

  async execute(role) {

    const canal = role.guild.channels.cache.get(
      config.logChannel
    );

    if (!canal) return;

    const embed = new EmbedBuilder()

      .setTitle('❌ Role Deleted')
      .setColor('#ff4d4d')

      .addFields(
        {
          name: '🎭 Rol',
          value: `${role.name}`
        },

        {
          name: '🆔 ID',
          value: `${role.id}`
        }
      )

      .setTimestamp();

    canal.send({
      embeds: [embed]
    });

  }
};