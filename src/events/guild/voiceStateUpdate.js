const { Events, EmbedBuilder } = require('discord.js');
const { getGeneralConfig } = require('../../database/guildManager');

const recentLogs = new Set();

function createVoiceLog(key) {
  if (recentLogs.has(key)) return false;
  recentLogs.add(key);
  setTimeout(() => recentLogs.delete(key), 3000);
  return true;
}

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    if (oldState.channelId === newState.channelId) return;
    if (newState.member?.user.bot) return;

    const general = getGeneralConfig(newState.guild.id);
    const logChannel = newState.guild.channels.cache.get(general.logChannel);
    if (!logChannel) return;

    if (!oldState.channelId && newState.channelId) {
      if (!createVoiceLog(`join-${newState.member.id}-${newState.channelId}`)) return;
      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🔊 Voice Joined')
        .addFields(
          { name: '👤 Usuario', value: newState.member.user.tag, inline: true },
          { name: '🎤 Canal', value: `${newState.channel}`, inline: true }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
      return;
    }

    if (oldState.channelId && !newState.channelId) {
      if (!createVoiceLog(`leave-${newState.member.id}-${oldState.channelId}`)) return;
      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('📴 Voice Left')
        .addFields(
          { name: '👤 Usuario', value: newState.member.user.tag, inline: true },
          { name: '🎤 Canal', value: `${oldState.channel}`, inline: true }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
      return;
    }

    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      if (!createVoiceLog(`move-${newState.member.id}-${oldState.channelId}-${newState.channelId}`)) return;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🔄 Voice Moved')
        .addFields(
          { name: '👤 Usuario', value: newState.member.user.tag },
          { name: '⬅️ De', value: `${oldState.channel}`, inline: true },
          { name: '➡️ A', value: `${newState.channel}`, inline: true }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  }
};