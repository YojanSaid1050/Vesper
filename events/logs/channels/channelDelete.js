const {
  Events,
  EmbedBuilder,
  AuditLogEvent,
  ChannelType
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

  name: Events.ChannelDelete,

  async execute(channel) {

    const logKey =
      `channel-delete-${channel.id}`;

    if (!createLog(logKey))
      return;

    const guildConfig =
      getGuildConfig(
        channel.guild.id
      );

    const canal =
      channel.guild.channels.cache.get(
        guildConfig.general.logChannel
      );

    if (!canal)
      return;

    let tipo = 'Desconocido';

    if (channel.type === ChannelType.GuildText)
      tipo = '💬 Texto';

    else if (channel.type === ChannelType.GuildVoice)
      tipo = '🔊 Voz';

    else if (channel.type === ChannelType.GuildCategory)
      tipo = '📂 Categoría';

    else if (channel.type === ChannelType.GuildAnnouncement)
      tipo = '📢 Anuncios';

    else if (channel.type === ChannelType.GuildForum)
      tipo = '🧵 Foro';

    let executor = 'Desconocido';

    try {

      const fetchedLogs =
        await channel.guild.fetchAuditLogs({

          limit: 1,

          type:
            AuditLogEvent.ChannelDelete

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
          '🗑️ Channel Deleted'
        )

        .setColor('#ED4245')

        .addFields(

          {
            name: '📌 Canal',
            value: channel.name
          },

          {
            name: '📂 Tipo',
            value: tipo,
            inline: true
          },

          {
            name: '🛠️ Eliminado por',
            value: executor,
            inline: true
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