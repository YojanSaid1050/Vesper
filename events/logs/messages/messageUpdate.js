const {
  Events,
  EmbedBuilder
} = require('discord.js');

const {
  createLog
} = require('../../../utils/logCache');

const {
  getGuildConfig
} = require('../../../utils/guildManager');

const {
  sendBrandedMessage
} = require('../../../utils/webhookSender');

module.exports = {

  name: Events.MessageUpdate,

  async execute(
    oldMessage,
    newMessage
  ) {

    if (!oldMessage.guild)
      return;

    if (oldMessage.author?.bot)
      return;

    if (
      oldMessage.content ===
      newMessage.content
    ) {

      return;

    }

    const guildConfig =
      getGuildConfig(
        oldMessage.guild.id
      );

    const canal =
      oldMessage.guild.channels.cache.get(
        guildConfig.general.logChannel
      );

    if (!canal)
      return;

    const logKey =
      `edit-${newMessage.id}`;

    if (!createLog(logKey))
      return;

    const embed =
      new EmbedBuilder()

        .setTitle(
          '✏️ Message Edited'
        )

        .setColor('#FAA61A')

        .addFields(

          {
            name: '👤 Usuario',
            value:
              oldMessage.author.tag
          },

          {
            name: '📍 Canal',
            value:
              `${oldMessage.channel}`
          },

          {
            name: '📌 Antes',
            value:
              oldMessage.content ||
              '*Sin texto*'
          },

          {
            name: '📌 Después',
            value:
              newMessage.content ||
              '*Sin texto*'
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

};