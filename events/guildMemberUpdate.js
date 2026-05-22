const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.GuildMemberUpdate,

  async execute(oldMember, newMember) {

    const canal = newMember.guild.channels.cache.get(
      config.logChannel
    );

    if (!canal) return;

    // =========================
    // NICKNAME
    // =========================

    if (oldMember.nickname !== newMember.nickname) {

      const embed = new EmbedBuilder()

        .setTitle('📝 Nickname Updated')
        .setColor('#00b0f4')

        .addFields(
          {
            name: '👤 Usuario',
            value: `${newMember.user.tag}`
          },

          {
            name: '📌 Antes',
            value: oldMember.nickname || 'Sin nickname',
            inline: true
          },

          {
            name: '📌 Después',
            value: newMember.nickname || 'Sin nickname',
            inline: true
          }
        )

        .setThumbnail(
          newMember.user.displayAvatarURL()
        )

        .setTimestamp();

      canal.send({
        embeds: [embed]
      });

    }

    // =========================
    // TIMEOUT
    // =========================

    if (
      oldMember.communicationDisabledUntilTimestamp !==
      newMember.communicationDisabledUntilTimestamp
    ) {

      const timeout =
        newMember.communicationDisabledUntilTimestamp;

      const embed = new EmbedBuilder()

        .setTitle(
          timeout
            ? '🔇 User Timed Out'
            : '🔊 Timeout Removed'
        )

        .setColor(
          timeout
            ? '#ff0000'
            : '#57F287'
        )

        .addFields({
          name: '👤 Usuario',
          value: `${newMember.user.tag}`
        })

        .setTimestamp();

      canal.send({
        embeds: [embed]
      });

    }

    // =========================
    // ROLES
    // =========================

    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    // Rol añadido

    const addedRole = newRoles.find(
      role => !oldRoles.has(role.id)
    );

    if (addedRole) {

      const embed = new EmbedBuilder()

        .setTitle('🎭 Role Added')
        .setColor('#57F287')

        .addFields(
          {
            name: '👤 Usuario',
            value: `${newMember.user.tag}`
          },

          {
            name: '🎭 Rol',
            value: `${addedRole}`
          }
        )

        .setTimestamp();

      canal.send({
        embeds: [embed]
      });

    }

    // Rol removido

    const removedRole = oldRoles.find(
      role => !newRoles.has(role.id)
    );

    if (removedRole) {

      const embed = new EmbedBuilder()

        .setTitle('❌ Role Removed')
        .setColor('#ff4d4d')

        .addFields(
          {
            name: '👤 Usuario',
            value: `${newMember.user.tag}`
          },

          {
            name: '🎭 Rol',
            value: `${removedRole}`
          }
        )

        .setTimestamp();

      canal.send({
        embeds: [embed]
      });

    }

  }
};