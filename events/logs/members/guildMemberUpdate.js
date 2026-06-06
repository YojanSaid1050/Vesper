const {
  Events,
  EmbedBuilder,
  AuditLogEvent
} = require('discord.js');

const {
  getGuildConfig
} = require('../../../utils/guildManager');

const {
  sendBrandedMessage
} = require('../../../utils/webhookSender');

module.exports = {

  name: Events.GuildMemberUpdate,

  async execute(oldMember, newMember) {

    const guildConfig =
      getGuildConfig(
        newMember.guild.id
      );

    const canal =
      newMember.guild.channels.cache.get(
        guildConfig.general.logChannel
      );

    if (!canal)
      return;

    // ==========================================
    // NICKNAME UPDATE
    // ==========================================

    if (
      oldMember.nickname !==
      newMember.nickname
    ) {

      const embed =
        new EmbedBuilder()

          .setTitle(
            '📝 Nickname Updated'
          )

          .setColor('#00b0f4')

          .addFields(

            {
              name: '👤 Usuario',
              value:
                newMember.user.tag
            },

            {
              name: '📌 Antes',
              value:
                oldMember.nickname ||
                'Sin nickname',
              inline: true
            },

            {
              name: '📌 Después',
              value:
                newMember.nickname ||
                'Sin nickname',
              inline: true
            }

          )

          .setThumbnail(
            newMember.user.displayAvatarURL()
          )

          .setTimestamp();

      await sendBrandedMessage(

        canal,

        {
          embeds: [embed]
        }

      );

    }

    // ==========================================
    // TIMEOUT
    // ==========================================

    if (

      oldMember.communicationDisabledUntilTimestamp !==
      newMember.communicationDisabledUntilTimestamp

    ) {

      let executor =
        'Desconocido';

      let reason =
        'Sin razón';

      try {

        const fetchedLogs =

          await newMember.guild.fetchAuditLogs({

            limit: 1,

            type:
              AuditLogEvent.MemberUpdate

          });

        const timeoutLog =
          fetchedLogs.entries.first();

        if (timeoutLog) {

          executor =
            timeoutLog.executor.tag;

          reason =
            timeoutLog.reason ||
            'Sin razón';

        }

      } catch (error) {

        console.error(error);

      }

      if (
        newMember.communicationDisabledUntilTimestamp
      ) {

        const timeoutDate =
          new Date(

            newMember.communicationDisabledUntilTimestamp

          );

        const embed =
          new EmbedBuilder()

            .setTitle(
              '🔇 User Timed Out'
            )

            .setColor('#ED4245')

            .addFields(

              {
                name: '👤 Usuario',
                value:
                  newMember.user.tag
              },

              {
                name: '🛠️ Timeout por',
                value: executor
              },

              {
                name: '📅 Hasta',
                value:
                  `<t:${Math.floor(timeoutDate.getTime() / 1000)}:F>`
              },

              {
                name: '📝 Razón',
                value: reason
              }

            )

            .setThumbnail(
              newMember.user.displayAvatarURL()
            )

            .setTimestamp();

        await sendBrandedMessage(

          canal,

          {
            embeds: [embed]
          }

        );

      } else {

        const embed =
          new EmbedBuilder()

            .setTitle(
              '🔊 Timeout Removed'
            )

            .setColor('#57F287')

            .addFields(

              {
                name: '👤 Usuario',
                value:
                  newMember.user.tag
              },

              {
                name: '🛠️ Removido por',
                value: executor
              }

            )

            .setThumbnail(
              newMember.user.displayAvatarURL()
            )

            .setTimestamp();

        await sendBrandedMessage(

          canal,

          {
            embeds: [embed]
          }

        );

      }

    }

    // ==========================================
    // ROLE ADDED
    // ==========================================

    const addedRole =
      newMember.roles.cache.find(

        role =>
          !oldMember.roles.cache.has(
            role.id
          )

      );

    if (addedRole) {

      const embed =
        new EmbedBuilder()

          .setTitle(
            '🎭 Role Added'
          )

          .setColor('#57F287')

          .addFields(

            {
              name: '👤 Usuario',
              value:
                newMember.user.tag
            },

            {
              name: '🎭 Rol',
              value:
                `${addedRole}`
            }

          )

          .setTimestamp();

      await sendBrandedMessage(

        canal,

        {
          embeds: [embed]
        }

      );

    }

    // ==========================================
    // ROLE REMOVED
    // ==========================================

    const removedRole =
      oldMember.roles.cache.find(

        role =>
          !newMember.roles.cache.has(
            role.id
          )

      );

    if (removedRole) {

      const embed =
        new EmbedBuilder()

          .setTitle(
            '❌ Role Removed'
          )

          .setColor('#ED4245')

          .addFields(

            {
              name: '👤 Usuario',
              value:
                newMember.user.tag
            },

            {
              name: '🎭 Rol',
              value:
                `${removedRole}`
            }

          )

          .setTimestamp();

      await sendBrandedMessage(

        canal,

        {
          embeds: [embed]
        }

      );

    }

  }

};