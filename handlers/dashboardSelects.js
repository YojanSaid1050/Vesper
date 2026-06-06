const {
  updateGuildSection
} = require('../utils/guildManager');

const generalPanel =
  require('../functions/Embeds/dashboard/generalPanel');

const botPanel =
  require('../functions/Embeds/dashboard/botPanel');

const tiktokPanel =
  require('../functions/Embeds/dashboard/tiktokPanel');

const twitchPanel =
  require('../functions/Embeds/dashboard/twitchPanel');

module.exports =
  async function dashboardSelects(
    interaction
  ) {

    try {

      const guildId =
        interaction.guild.id;

      // =====================================
      // CHANNEL SELECT MENUS
      // =====================================

      if (
        interaction.isChannelSelectMenu()
      ) {

        const channelId =
          interaction.values[0];

        switch (
          interaction.customId
        ) {

          // ==========================
          // GENERAL
          // ==========================

          case 'general_welcome':

            updateGuildSection(

              guildId,

              'general',

              {
                welcomeChannel:
                  channelId
              }

            );

            return interaction.update(

              generalPanel(
                guildId
              )

            );

          case 'general_goodbye':

            updateGuildSection(

              guildId,

              'general',

              {
                goodbyeChannel:
                  channelId
              }

            );

            return interaction.update(

              generalPanel(
                guildId
              )

            );

          case 'general_log':

            updateGuildSection(

              guildId,

              'general',

              {
                logChannel:
                  channelId
              }

            );

            return interaction.update(

              generalPanel(
                guildId
              )

            );

          // ==========================
          // BOT
          // ==========================

          case 'bot_log_channel':

            updateGuildSection(

              guildId,

              'general',

              {
                botLogChannel:
                  channelId
              }

            );

            return interaction.update(

              botPanel(
                guildId
              )

            );

          // ==========================
          // TIKTOK
          // ==========================

          case 'tiktok_live_channel':

            updateGuildSection(

              guildId,

              'tiktok',

              {
                liveChannel:
                  channelId
              }

            );

            return interaction.update(

              tiktokPanel(
                guildId
              )

            );

          case 'tiktok_video_channel':

            updateGuildSection(

              guildId,

              'tiktok',

              {
                videoChannel:
                  channelId
              }

            );

            return interaction.update(

              tiktokPanel(
                guildId
              )

            );

          // ==========================
          // TWITCH
          // ==========================

          case 'twitch_live_channel':

            updateGuildSection(

              guildId,

              'twitch',

              {
                liveChannel:
                  channelId
              }

            );

            return interaction.update(

              twitchPanel(
                guildId
              )

            );

          default:

            return;

        }

      }

      // =====================================
      // ROLE SELECT MENUS
      // =====================================

      if (
        interaction.isRoleSelectMenu()
      ) {

        const roleId =
          interaction.values[0];

        switch (
          interaction.customId
        ) {

          case 'bot_role':

            updateGuildSection(

              guildId,

              'general',

              {
                botRole:
                  roleId
              }

            );

            return interaction.update(

              botPanel(
                guildId
              )

            );

          default:

            return;

        }

      }

    }

    catch (error) {

      console.error(
        '❌ Error dashboardSelects'
      );

      console.error(
        error
      );

    }

  };