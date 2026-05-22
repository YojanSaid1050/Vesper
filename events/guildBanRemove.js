const {
  Events,
  EmbedBuilder,
  AuditLogEvent
} = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.GuildBanRemove,

  async execute(ban) {

    const canal = ban.guild.channels.cache.get(
      config.logChannel
    );

    if (!canal) return;

    // =========================
    // AUDIT LOG
    // =========================

    let executor = 'Desconocido';

    try {

      const fetchedLogs =
        await ban.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.MemberBanRemove
        });

      const unbanLog = fetchedLogs.entries.first();

      if (unbanLog) {

        executor = unbanLog.executor.tag;

      }

    } catch (error) {

      console.error(error);

    }

    // =========================
    // EMBED
    // =========================

    const embed = new EmbedBuilder()

      .setTitle('🔓 User Unbanned')
      .setColor('#57F287')

      .addFields(
        {
          name: '👤 Usuario',
          value: `${ban.user.tag}`
        },

        {
          name: '🛠️ Desbaneado por',
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