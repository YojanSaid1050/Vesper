const { Events, EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { createLog } = require('../../utils/logCache');
const {memberVars } = require('../../core/EmbedCatalog');
const { publishAlert } = require('../../core/AlertRouter');
const { findRecentAuditEntry, auditExecutor } = require('../../utils/auditLog');

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (!createLog(`channel-delete-${channel.id}`)) return;

    const guildConfig = await getGuildConfig(channel.guild.id); // Añadir await

    const tipo = {
      [ChannelType.GuildText]: '💬 Texto',
      [ChannelType.GuildVoice]: '🔊 Voz',
      [ChannelType.GuildCategory]: '📂 Categoría',
      [ChannelType.GuildAnnouncement]: '📢 Anuncios',
      [ChannelType.GuildForum]: '🧵 Foro'
    }[channel.type] || 'Desconocido';

    let executor = 'Desconocido';
    try {
      executor = auditExecutor(await findRecentAuditEntry(channel.guild, AuditLogEvent.ChannelDelete, channel.id));
    } catch {}

    await publishAlert(channel.guild, guildConfig, 'log_channel_deleted', {
      vars: {
        channel: channel.name, channelName: channel.name, type: tipo, executor,
        server: channel.guild.name, memberCount: channel.guild.memberCount
      }
    });
  }
};
