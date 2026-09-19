const { Events } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado
const {memberVars } = require('../../core/EmbedCatalog');
const { publishAlert } = require('../../core/AlertRouter');

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

    // `newState.member` lee de la caché de miembros y devuelve null si no
    // está: pasaba al desconectar a alguien que acababa de salir del servidor
    // o tras limpiar la caché, y el registro de voz reventaba con un
    // TypeError en vez de publicarse.
    const member = newState.member ?? oldState.member;
    if (!member || member.user?.bot) return;

    const guildConfig = await getGuildConfig(newState.guild.id); // Añadir await

    // Joined voice channel
    if (!oldState.channelId && newState.channelId) {
      if (!createVoiceLog(`join-${member.id}-${newState.channelId}`)) return;
      await publishAlert(newState.guild, guildConfig, 'log_voice_join', {
        vars: memberVars(member, { channel: `${newState.channel}`, channelName: newState.channel?.name || '' })
    });
      return;
    }

    // Left voice channel
    if (oldState.channelId && !newState.channelId) {
      if (!createVoiceLog(`leave-${member.id}-${oldState.channelId}`)) return;
      await publishAlert(newState.guild, guildConfig, 'log_voice_leave', {
        vars: memberVars(member, { channel: `${oldState.channel}`, channelName: oldState.channel?.name || '' })
    });
      return;
    }

    // Moved between voice channels
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      if (!createVoiceLog(`move-${member.id}-${oldState.channelId}-${newState.channelId}`)) return;
      await publishAlert(newState.guild, guildConfig, 'log_voice_move', {
        vars: memberVars(member, { from: `${oldState.channel}`, to: `${newState.channel}` })
    });
    }
  }
};