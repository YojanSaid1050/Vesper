const {
  Events,
  EmbedBuilder
} = require('discord.js');

const enviarGoodbye =
  require('../../../functions/Embeds/goodbyeEmbed');

const {
  sendBrandedMessage
} = require('../../../utils/webhookSender');

const {
  getGuildConfig
} = require('../../../utils/guildManager');

module.exports = {

  name: Events.GuildMemberRemove,

  async execute(member) {

    const guildConfig =
      getGuildConfig(
        member.guild.id
      );

    const general =
      guildConfig.general || {};

    // =========================
    // GOODBYE
    // =========================

    const goodbyeChannel =
      member.guild.channels.cache.get(
        general.goodbyeChannel
      );

    if (goodbyeChannel) {

      await enviarGoodbye(

        member,

        goodbyeChannel

      );

    }

    // =========================
    // LOG
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
            ? '🤖 Bot Left'
            : '📤 Member Left'
        )

        .setColor(
          '#ED4245'
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