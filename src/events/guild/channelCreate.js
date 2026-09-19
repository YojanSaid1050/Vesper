const { Events, EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { createLog } = require('../../utils/logCache');
const {memberVars } = require('../../core/EmbedCatalog');
const { publishAlert } = require('../../core/AlertRouter');
const { findRecentAuditEntry, auditExecutor } = require('../../utils/auditLog');

module.exports = {
  name: Events.ChannelCreate,
  async execute(channel) {
    if (!createLog(`channel-create-${channel.id}`)) return;

    const guildConfig = await getGuildConfig(channel.guild.id); // Añadir await

    const tipo = {
      [ChannelType.GuildText]: '💬 Texto',
      [ChannelType.GuildVoice]: '🔊 Voz',
      [ChannelType.GuildCategory]: '📂 Categoría',
      [ChannelType.GuildAnnouncement]: '📢 Anuncios',
      [ChannelType.GuildForum]: '🧵 Foro'
    }[channel.type] || 'Desconocido';

    let creator = 'Desconocido';
    try {
      creator = auditExecutor(await findRecentAuditEntry(channel.guild, AuditLogEvent.ChannelCreate, channel.id));
    } catch {}

    await publishAlert(channel.guild, guildConfig, 'log_channel_created', {
      vars: {
        channel: `${channel}`, channelName: channel.name, type: tipo, executor: creator,
        server: channel.guild.name, memberCount: channel.guild.memberCount
      }
    });
  }
};
