const {
  Events,
  EmbedBuilder
} = require('discord.js');

const enviarWelcome =
  require('../../../functions/Embeds/welcomeEmbed');

const {
  sendBrandedMessage
} = require('../../../utils/webhookSender');

const {
  getGuildConfig
} = require('../../../utils/guildManager');

module.exports = {

  name: Events.GuildMemberAdd,

  async execute(member) {

    const guildConfig =
      getGuildConfig(
        member.guild.id
      );

    const general =
      guildConfig.general || {};

    // =========================
    // SI ES BOT
    // =========================

    if (member.user.bot) {

      const role =
        member.guild.roles.cache.get(
          general.botRole
        );

      if (role) {

        try {

          await member.roles.add(role);

          console.log(
            `✅ Rol BOT añadido a ${member.user.tag}`
          );

        } catch (error) {

          console.log(
            '❌ ERROR AL AÑADIR ROL'
          );

          console.error(error);

        }

      }

      // =========================
      // LOG BOT
      // =========================

      const botChannel =
        member.guild.channels.cache.get(
          general.botLogChannel
        );

      if (botChannel) {

        const embed =
          new EmbedBuilder()

            .setTitle(
              '🤖 Bot Added'
            )

            .setColor(
              '#5865F2'
            )

            .addFields(

              {
                name: '🤖 Bot',
                value:
                  member.user.tag
              },

              {
                name: '🆔 ID',
                value:
                  member.id
              },

              {
                name:
                  '🎭 Rol añadido',

                value:
                  general.botRole
                    ? `<@&${general.botRole}>`
                    : 'No configurado'
              }

            )

            .setThumbnail(
              member.user.displayAvatarURL()
            )

            .setTimestamp();

        await sendBrandedMessage(

          botChannel,

          {
            embeds: [embed]
          }

        );

      }

    }

    // =========================
    // WELCOME
    // =========================

    const welcomeChannel =
      member.guild.channels.cache.get(
        general.welcomeChannel
      );

    if (welcomeChannel) {

      await enviarWelcome(

        member,

        welcomeChannel

      );

    }

    // =========================
    // LOG NORMAL
    // =========================

    const logChannel =
      member.guild.channels.cache.get(
        general.logChannel
      );

    if (!logChannel)
      return;

    const embed =
      new EmbedBuilder()

        .setTitle(

          member.user.bot

            ? '🤖 Bot Joined'

            : '📥 Member Joined'

        )

        .setColor(

          member.user.bot

            ? '#5865F2'

            : '#57F287'

        )

        .addFields(

          {

            name:

              member.user.bot

                ? '🤖 Bot'

                : '👤 Usuario',

            value:
              member.user.tag

          },

          {

            name: '🆔 ID',

            value:
              member.id

          }

        )

        .setThumbnail(

          member.user.displayAvatarURL()

        )

        .setTimestamp();

    await sendBrandedMessage(

      logChannel,

      {
        embeds: [embed]
      }

    );

  }

};