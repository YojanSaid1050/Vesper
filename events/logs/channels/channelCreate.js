const {
  Events,
  EmbedBuilder,
  AuditLogEvent,
  ChannelType
} = require('discord.js');

const {
  getGuildConfig
} = require('../../../utils/guildManager');

const {
  createLog
} = require('../../../utils/logCache');

module.exports = {
  name: Events.ChannelCreate,

  async execute(channel) {

    const logKey =
      `channel-create-${channel.id}`;

    if (!createLog(logKey)) return;

    const guildConfig =
      getGuildConfig(
        channel.guild.id
      );

    const canal =
      channel.guild.channels.cache.get(
        guildConfig.logChannel
      );

    if (!canal) return;

    // =========================
    // TIPO DE CANAL
    // =========================

    let tipo = 'Desconocido';

    if (
      channel.type ===
      ChannelType.GuildText
    ) {
      tipo = '💬 Texto';
    }

    else if (
      channel.type ===
      ChannelType.GuildVoice
    ) {
      tipo = '🔊 Voz';
    }

    else if (
      channel.type ===
      ChannelType.GuildCategory
    ) {
      tipo = '📂 Categoría';
    }

    else if (
      channel.type ===
      ChannelType.GuildAnnouncement
    ) {
      tipo = '📢 Anuncios';
    }

    else if (
      channel.type ===
      ChannelType.GuildForum
    ) {
      tipo = '🧵 Foro';
    }

    // =========================
    // AUDIT LOG
    // =========================

    let creator =
      'Desconocido';

    try {

      const fetchedLogs =
        await channel.guild.fetchAuditLogs({
          limit: 1,
          type:
            AuditLogEvent.ChannelCreate
        });

      const createLogEntry =
        fetchedLogs.entries.first();

      if (
        createLogEntry?.executor
      ) {

        creator =
          createLogEntry.executor.tag;

      }

    } catch (error) {

      console.error(error);

    }

    // =========================
    // EMBED
    // =========================

    const embed =
      new EmbedBuilder()

        .setTitle(
          '📁 Channel Created'
        )

        .setColor(
          '#57F287'
        )

        .addFields(

          {
            name: '📌 Canal',
            value: `${channel}`
          },

          {
            name: '📂 Tipo',
            value: tipo,
            inline: true
          },

          {
            name: '🛠️ Creado por',
            value: creator,
            inline: true
          }

        )

        .setTimestamp();

    await canal.send({
      embeds: [embed]
    });

  }
};