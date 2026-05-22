const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

const {
  createLog
} = require('../utils/logCache');

module.exports = {
  name: Events.VoiceStateUpdate,

  async execute(oldState, newState) {

    const canalLogs =
      newState.guild.channels.cache.get(
        config.logChannel
      );

    if (!canalLogs) return;

    const member =
      newState.member;

    // =========================
    // JOIN VOICE
    // =========================

    if (!oldState.channel && newState.channel) {

      const logKey =
        `voice-join-${member.id}-${newState.channel.id}`;

      if (!createLog(logKey)) return;

      const embed = new EmbedBuilder()

        .setTitle('🔊 Voice Joined')

        .setColor('#57F287')

        .addFields(
          {
            name: '👤 Usuario',
            value: `${member.user.tag}`,
            inline: true
          },

          {
            name: '🎤 Canal',
            value: `${newState.channel}`,
            inline: true
          }
        )

        .setTimestamp();

      return canalLogs.send({
        embeds: [embed]
      });

    }

    // =========================
    // LEAVE VOICE
    // =========================

    if (oldState.channel && !newState.channel) {

      const logKey =
        `voice-leave-${member.id}-${oldState.channel.id}`;

      if (!createLog(logKey)) return;

      const embed = new EmbedBuilder()

        .setTitle('📴 Voice Left')

        .setColor('#ff4d4d')

        .addFields(
          {
            name: '👤 Usuario',
            value: `${member.user.tag}`,
            inline: true
          },

          {
            name: '🎤 Canal',
            value: `${oldState.channel}`,
            inline: true
          }
        )

        .setTimestamp();

      return canalLogs.send({
        embeds: [embed]
      });

    }

    // =========================
    // MOVE VOICE
    // =========================

    if (
      oldState.channel &&
      newState.channel &&
      oldState.channel.id !== newState.channel.id
    ) {

      const logKey =
        `voice-move-${member.id}-${oldState.channel.id}-${newState.channel.id}`;

      if (!createLog(logKey)) return;

      const embed = new EmbedBuilder()

        .setTitle('🔄 Voice Moved')

        .setColor('#5865F2')

        .addFields(
          {
            name: '👤 Usuario',
            value: `${member.user.tag}`
          },

          {
            name: '⬅️ De',
            value: `${oldState.channel}`,
            inline: true
          },

          {
            name: '➡️ A',
            value: `${newState.channel}`,
            inline: true
          }
        )

        .setTimestamp();

      return canalLogs.send({
        embeds: [embed]
      });

    }

  }
};