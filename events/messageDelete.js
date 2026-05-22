const {
  Events,
  EmbedBuilder,
  AuditLogEvent
} = require('discord.js');

const config = require('../config/config.json');

const {
  createLog
} = require('../utils/logCache');

module.exports = {
  name: Events.MessageDelete,

  async execute(message) {

    if (!message.guild) return;

    if (message.author?.bot) return;

    const logKey =
      `delete-${message.id}`;

    if (!createLog(logKey)) return;

    const canal = message.guild.channels.cache.get(
      config.logChannel
    );

    if (!canal) return;

    let deleter = 'Desconocido';

    try {

      const fetchedLogs =
        await message.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.MessageDelete
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

    const embed = new EmbedBuilder()

      .setTitle('🗑️ Message Deleted')

      .setColor('#ff4d4d')

      .addFields(
        {
          name: '👤 Usuario',
          value: `${message.author.tag}`,
          inline: true
        },

        {
          name: '🛠️ Eliminado por',
          value: `${deleter}`,
          inline: true
        },

        {
          name: '📍 Canal',
          value: `${message.channel}`
        },

        {
          name: '💬 Contenido',
          value:
            message.content || '*Sin texto*'
        }
      )

      .setTimestamp();

    canal.send({
      embeds: [embed]
    });

  }
};