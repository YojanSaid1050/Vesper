const {
  Events,
  EmbedBuilder
} = require('discord.js');

const {
  createLog
} = require('../../../utils/logCache');

const {
  getGeneralConfig
} = require('../../../utils/guildManager');

module.exports = {

  name: Events.GuildRoleCreate,

  async execute(role) {

    const logKey =
      `role-create-${role.id}`;

    if (!createLog(logKey))
      return;

    const general =
      getGeneralConfig(
        role.guild.id
      );

    const canal =
      role.guild.channels.cache.get(
        general.logChannel
      );

    if (!canal)
      return;

    const embed =
      new EmbedBuilder()

        .setTitle(
          '🎭 Role Created'
        )

        .setColor(
          '#57F287'
        )

        .addFields(

          {
            name: '🎭 Rol',
            value: `${role}`
          },

          {
            name: '🆔 ID',
            value: role.id
          }

        )

        .setTimestamp();

    await canal.send({

      embeds: [embed]

    });

  }

};