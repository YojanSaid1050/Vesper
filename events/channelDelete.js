const {
  Events,
  EmbedBuilder,
  AuditLogEvent,
  ChannelType
} = require('discord.js');

const config = require('../config/config.json');

const {
  createLog
} = require('../utils/logCache');

module.exports = {
  name: Events.ChannelDelete,

  async execute(channel) {

    const logKey =
      `channel-delete-${channel.id}`;

    if (!createLog(logKey)) return;

    const canal =
      channel.guild.channels.cache.get(
        config.logChannel
      );

    if (!canal) return;

    // =========================
    // TIPO DE CANAL
    // =========================

    let tipo = 'Desconocido';

    if (channel.type === ChannelType.GuildText) {
      tipo = '💬 Texto';
    }

    else if (channel.type === ChannelType.GuildVoice) {
      tipo = '🔊 Voz';
    }

    else if (channel.type === ChannelType.GuildCategory) {
      tipo = '📂 Categoría';
    }

    else if (channel.type === ChannelType.GuildAnnouncement) {
      tipo = '📢 Anuncios';
    }

    else if (channel.type === ChannelType.GuildForum) {
      tipo = '🧵 Foro';
    }

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

      const deleteLog =
        fetchedLogs.entries.first();

      if (deleteLog) {

        executor =
          deleteLog.executor.tag;

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
          name: '📂 Tipo',
          value: tipo,
          inline: true
        },

        {
          name: '🛠️ Eliminado por',
          value: `${executor}`,
          inline: true
        }
      )

      .setTimestamp();

    canal.send({
      embeds: [embed]
    });

  }
};