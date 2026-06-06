const {
  Events,
  EmbedBuilder
} = require('discord.js');

const {
  getGeneralConfig
} = require('../../../utils/guildManager');

// ==================================================
// CACHE ANTI DUPLICADOS
// ==================================================

const recentLogs =
  new Set();

function createVoiceLog(key) {

  if (recentLogs.has(key)) {

    return false;

  }

  recentLogs.add(key);

  setTimeout(() => {

    recentLogs.delete(key);

  }, 3000);

  return true;

}

module.exports = {

  name: Events.VoiceStateUpdate,

  async execute(oldState, newState) {

    try {

      // ==================================================
      // IGNORAR SI NO CAMBIÓ EL CANAL
      // ==================================================

      if (

        oldState.channelId ===
        newState.channelId

      ) return;

      // ==================================================
      // CONFIG DEL SERVIDOR
      // ==================================================

      const general =
        getGeneralConfig(
          newState.guild.id
        );

      const canalLogs =
        newState.guild.channels.cache.get(
          general.logChannel
        );

      if (!canalLogs)
        return;

      // ==================================================
      // MEMBER
      // ==================================================

      const member =
        newState.member;

      if (!member)
        return;

      if (
        member.user.bot
      ) return;

      // ==================================================
      // JOIN
      // ==================================================

      if (

        !oldState.channelId &&
        newState.channelId

      ) {

        const logKey =
          `join-${member.id}-${newState.channelId}`;

        if (
          !createVoiceLog(logKey)
        ) return;

        const embed =
          new EmbedBuilder()

            .setColor(
              '#57F287'
            )

            .setTitle(
              '🔊 Voice Joined'
            )

            .addFields(

              {
                name: '👤 Usuario',
                value:
                  member.user.tag,
                inline: true
              },

              {
                name: '🎤 Canal',
                value:
                  `${newState.channel}`,
                inline: true
              }

            )

            .setTimestamp();

        await canalLogs.send({

          embeds: [embed]

        });

        return;

      }

      // ==================================================
      // LEAVE
      // ==================================================

      if (

        oldState.channelId &&
        !newState.channelId

      ) {

        const logKey =
          `leave-${member.id}-${oldState.channelId}`;

        if (
          !createVoiceLog(logKey)
        ) return;

        const embed =
          new EmbedBuilder()

            .setColor(
              '#ED4245'
            )

            .setTitle(
              '📴 Voice Left'
            )

            .addFields(

              {
                name: '👤 Usuario',
                value:
                  member.user.tag,
                inline: true
              },

              {
                name: '🎤 Canal',
                value:
                  `${oldState.channel}`,
                inline: true
              }

            )

            .setTimestamp();

        await canalLogs.send({

          embeds: [embed]

        });

        return;

      }

      // ==================================================
      // MOVE
      // ==================================================

      if (

        oldState.channelId &&
        newState.channelId &&
        oldState.channelId !==
        newState.channelId

      ) {

        const logKey =
          `move-${member.id}-${oldState.channelId}-${newState.channelId}`;

        if (
          !createVoiceLog(logKey)
        ) return;

        const embed =
          new EmbedBuilder()

            .setColor(
              '#5865F2'
            )

            .setTitle(
              '🔄 Voice Moved'
            )

            .addFields(

              {
                name: '👤 Usuario',
                value:
                  member.user.tag
              },

              {
                name: '⬅️ De',
                value:
                  `${oldState.channel}`,
                inline: true
              },

              {
                name: '➡️ A',
                value:
                  `${newState.channel}`,
                inline: true
              }

            )

            .setTimestamp();

        await canalLogs.send({

          embeds: [embed]

        });

      }

    } catch (error) {

      console.error(
        '❌ Error en VoiceStateUpdate:'
      );

      console.error(error);

    }

  }

};