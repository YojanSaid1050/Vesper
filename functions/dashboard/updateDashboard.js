const {
  getAllGuilds
} = require('../../utils/guildManager');

const mainPanel =
  require('../Embeds/dashboard/mainPanel');

module.exports = async client => {

  const guilds =
    getAllGuilds();

  for (const guild of guilds) {

    try {

      if (
        !guild.dashboard?.channel ||
        !guild.dashboard?.message
      ) {
        continue;
      }

      const channel =
        await client.channels.fetch(
          guild.dashboard.channel
        );

      if (!channel) {
        continue;
      }

      const message =
        await channel.messages.fetch(
          guild.dashboard.message
        );

      await message.edit(
        mainPanel()
      );

      console.log(
        `✅ Dashboard actualizado (${guild.guildId})`
      );

    } catch (err) {

      console.error(
        `❌ Dashboard ${guild.guildId}`
      );

    }

  }

};