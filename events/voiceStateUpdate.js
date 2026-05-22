const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.VoiceStateUpdate,

  async execute(oldState, newState) {

    const canal = newState.guild.channels.cache.get(
      config.logChannel
    );

    if (!canal) return;

    // JOIN

    if (!oldState.channel && newState.channel) {

      const embed = new EmbedBuilder()

        .setTitle('🎤 Voice Joined')
        .setColor('#57F287')

        .addFields(
          {
            name: '👤 Usuario',
            value: `${newState.member.user.tag}`
          },

          {
            name: '🔊 Canal',
            value: `${newState.channel}`
          }
        )

        .setTimestamp();

      canal.send({
        embeds: [embed]
      });

    }

    // LEAVE

    if (oldState.channel && !newState.channel) {

      const embed = new EmbedBuilder()

        .setTitle('📤 Voice Left')
        .setColor('#ff4d4d')

        .addFields(
          {
            name: '👤 Usuario',
            value: `${oldState.member.user.tag}`
          },

          {
            name: '🔊 Canal',
            value: `${oldState.channel}`
          }
        )

        .setTimestamp();

      canal.send({
        embeds: [embed]
      });

    }

    // MOVE

    if (
      oldState.channel &&
      newState.channel &&
      oldState.channel.id !== newState.channel.id
    ) {

      const embed = new EmbedBuilder()

        .setTitle('🔁 Voice Moved')
        .setColor('#ffaa00')

        .addFields(
          {
            name: '👤 Usuario',
            value: `${newState.member.user.tag}`
          },

          {
            name: '📤 Antes',
            value: `${oldState.channel}`,
            inline: true
          },

          {
            name: '📥 Después',
            value: `${newState.channel}`,
            inline: true
          }
        )

        .setTimestamp();

      canal.send({
        embeds: [embed]
      });

    }

  }
};