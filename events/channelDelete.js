const {
  Events,
  EmbedBuilder,
  AuditLogEvent
} = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.ChannelDelete,

  async execute(channel) {

    const canal = channel.guild.channels.cache.get(
      config.logChannel
    );

    if (!canal) return;

    // =========================
    // AUDIT LOG
    // =========================

    let executor = 'Desconocido';

    try {

      const fetchedLogs =
        await channel.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.ChannelDelete
        });

      const deleteLog = fetchedLogs.entries.first();

      if (deleteLog) {

        executor = deleteLog.executor.tag;

      }

    } catch (error) {

      console.error(error);

    }

    // =========================
    // EMBED
    // =========================

    const embed = new EmbedBuilder()

      .setTitle('🗑️ Channel Deleted')
      .setColor('#ff4d4d')

      .addFields(
        {
          name: '📌 Canal',
          value: `${channel.name}`
        },

        {
          name: '🆔 ID',
          value: `${channel.id}`
        },

        {
          name: '🛠️ Eliminado por',
          value: `${executor}`
        }
      )

      .setTimestamp();

    canal.send({
      embeds: [embed]
    });

  }
};