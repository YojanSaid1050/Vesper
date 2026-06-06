const {
  Events,
  EmbedBuilder,
  AuditLogEvent
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

  name: Events.MessageDelete,

  async execute(message) {

    if (!message.guild)
      return;

    if (message.author?.bot)
      return;

    const guildConfig =
      getGuildConfig(
        message.guild.id
      );

    const canal =
      message.guild.channels.cache.get(
        guildConfig.general.logChannel
      );

    if (!canal)
      return;

    const logKey =
      `delete-${message.id}`;

    if (!createLog(logKey))
      return;

    let deleter =
      'Desconocido';

    try {

      const fetchedLogs =
        await message.guild.fetchAuditLogs({

          limit: 1,

          type:
            AuditLogEvent.MessageDelete

        });

      const deletionLog =
        fetchedLogs.entries.first();

      if (deletionLog) {

        deleter =
          deletionLog.executor.tag;

      }

    } catch (error) {

      console.error(error);

    }

    const embed =
      new EmbedBuilder()

        .setTitle(
          '🗑️ Message Deleted'
        )

        .setColor('#ED4245')

        .addFields(

          {
            name: '👤 Usuario',
            value:
              message.author.tag
          },

          {
            name: '🛠️ Eliminado por',
            value: deleter
          },

          {
            name: '📍 Canal',
            value:
              `${message.channel}`
          },

          {
            name: '💬 Contenido',
            value:
              message.content ||
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