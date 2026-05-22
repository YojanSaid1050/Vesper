const {
  Events,
  EmbedBuilder,
  AuditLogEvent
} = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.ChannelCreate,

  async execute(channel) {

    const canal = channel.guild.channels.cache.get(
      config.logChannel
    );

    if (!canal) return;

    let creator = 'Desconocido';

    try {

      const fetchedLogs =
        await channel.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.ChannelCreate
        });

      const createLog = fetchedLogs.entries.first();

      if (createLog) {

        creator = createLog.executor.tag;

      }

    } catch (error) {

      console.error(error);

    }

    const embed = new EmbedBuilder()

      .setTitle('📁 Channel Created')
      .setColor('#57F287')

      .addFields(
        {
          name: '📌 Canal',
          value: `${channel}`
        },

        {
          name: '🛠️ Creado por',
          value: `${creator}`
        }
      )

      .setTimestamp();

    canal.send({
      embeds: [embed]
    });

  }
};