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
  name: Events.GuildBanAdd,

  async execute(ban) {

    const logKey =
      `ban-${ban.user.id}`;

    if (!createLog(logKey)) return;

    const canal =
      ban.guild.channels.cache.get(
        config.logChannel
      );

    if (!canal) return;

    let executor = 'Desconocido';

    try {

      const fetchedLogs =
        await ban.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.MemberBanAdd
        });

      const banLog =
        fetchedLogs.entries.first();

      if (banLog) {

        executor =
          banLog.executor.tag;

      }

    } catch (error) {

      console.error(error);

    }

    const embed = new EmbedBuilder()

      .setTitle('🔨 User Banned')

      .setColor('#ff0000')

      .addFields(
        {
          name: '👤 Usuario',
          value: `${ban.user.tag}`
        },

        {
          name: '🛠️ Baneado por',
          value: `${executor}`
        }
      )

      .setThumbnail(
        ban.user.displayAvatarURL()
      )

      .setTimestamp();

    canal.send({
      embeds: [embed]
    });

  }
};