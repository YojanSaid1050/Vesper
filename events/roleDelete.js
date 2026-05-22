const {
  Events,
  EmbedBuilder,
  AuditLogEvent
} = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.GuildRoleDelete,

  async execute(role) {

    const canal = role.guild.channels.cache.get(
      config.logChannel
    );

    if (!canal) return;

    let executor = 'Desconocido';

    try {

      const fetchedLogs =
        await role.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.RoleDelete
        });

      const deleteLog = fetchedLogs.entries.first();

      if (deleteLog) {

        executor = deleteLog.executor.tag;

      }

    } catch (error) {

      console.error(error);

    }

    const embed = new EmbedBuilder()

      .setTitle('❌ Role Deleted')
      .setColor('#ff4d4d')

      .addFields(
        {
          name: '🎭 Rol',
          value: `${role.name}`
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