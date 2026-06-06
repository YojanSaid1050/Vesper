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

  name: Events.GuildBanRemove,

  async execute(ban) {

    const logKey =
      `unban-${ban.user.id}`;

    if (!createLog(logKey))
      return;

    const guildConfig =
      getGuildConfig(
        ban.guild.id
      );

    const canal =
      ban.guild.channels.cache.get(
        guildConfig.general.logChannel
      );

    if (!canal)
      return;

    let executor =
      'Desconocido';

    try {

      const fetchedLogs =
        await ban.guild.fetchAuditLogs({

          limit: 1,

          type:
            AuditLogEvent.MemberBanRemove

        });

      const entry =
        fetchedLogs.entries.first();

      if (entry)
        executor =
          entry.executor.tag;

    } catch (error) {

      console.error(error);

    }

    const embed =
      new EmbedBuilder()

        .setTitle(
          '🔓 User Unbanned'
        )

        .setColor('#57F287')

        .addFields(

          {
            name: '👤 Usuario',
            value: ban.user.tag
          },

          {
            name: '🛠️ Desbaneado por',
            value: executor
          }

        )

        .setThumbnail(
          ban.user.displayAvatarURL()
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