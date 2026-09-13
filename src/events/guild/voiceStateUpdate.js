const { Events, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { buildMessage, memberVars } = require('../../core/EmbedCatalog');

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

    const guildConfig = await getGuildConfig(newState.guild.id); // Añadir await
    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = newState.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // Joined voice channel
    if (!oldState.channelId && newState.channelId) {
      if (!createVoiceLog(`join-${newState.member.id}-${newState.channelId}`)) return;
      await sendBrandedMessage(logChannel, buildMessage('log_voice_join', {
        config: guildConfig,
        vars: memberVars(newState.member, { channel: `${newState.channel}`, channelName: newState.channel?.name || '' }),
        defaults: { title: '🔊 Voice Joined', color: '#57F287' },
        fields: [
          { name: '👤 Usuario', value: newState.member.user.tag, inline: true },
          { name: '🎤 Canal', value: `${newState.channel}`, inline: true }
        ]
      }));
      return;
    }

    // Left voice channel
    if (oldState.channelId && !newState.channelId) {
      if (!createVoiceLog(`leave-${newState.member.id}-${oldState.channelId}`)) return;
      await sendBrandedMessage(logChannel, buildMessage('log_voice_leave', {
        config: guildConfig,
        vars: memberVars(newState.member, { channel: `${oldState.channel}`, channelName: oldState.channel?.name || '' }),
        defaults: { title: '📴 Voice Left', color: '#ED4245' },
        fields: [
          { name: '👤 Usuario', value: newState.member.user.tag, inline: true },
          { name: '🎤 Canal', value: `${oldState.channel}`, inline: true }
        ]
      }));
      return;
    }

    // Moved between voice channels
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      if (!createVoiceLog(`move-${newState.member.id}-${oldState.channelId}-${newState.channelId}`)) return;
      await sendBrandedMessage(logChannel, buildMessage('log_voice_move', {
        config: guildConfig,
        vars: memberVars(newState.member, { from: `${oldState.channel}`, to: `${newState.channel}` }),
        defaults: { title: '🔄 Voice Moved', color: '#5865F2' },
        fields: [
          { name: '👤 Usuario', value: newState.member.user.tag },
          { name: '⬅️ De', value: `${oldState.channel}`, inline: true },
          { name: '➡️ A', value: `${newState.channel}`, inline: true }
        ]
      }));
    }
  }
};