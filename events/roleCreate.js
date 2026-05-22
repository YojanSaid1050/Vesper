const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

const {
  createLog
} = require('../utils/logCache');

module.exports = {
  name: Events.GuildRoleCreate,

  async execute(role) {

    const logKey =
      `role-create-${role.id}`;

    if (!createLog(logKey)) return;

    const canal =
      role.guild.channels.cache.get(
        config.logChannel
      );

    if (!canal) return;

    const embed = new EmbedBuilder()

      .setTitle('🎭 Role Created')

      .setColor('#57F287')

      .addFields(
        {
          name: '🎭 Rol',
          value: `${role}`
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