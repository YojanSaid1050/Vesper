const { Events, EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { getGuildConfig } = require('../../database/guildManager');
const { createLog } = require('../../utils/logCache');

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (!createLog(`channel-delete-${channel.id}`)) return;

    const guildConfig = getGuildConfig(channel.guild.id);
    const logChannel = channel.guild.channels.cache.get(guildConfig.general?.logChannel);
    if (!logChannel) return;

    const tipo = {
      [ChannelType.GuildText]: '💬 Texto',
      [ChannelType.GuildVoice]: '🔊 Voz',
      [ChannelType.GuildCategory]: '📂 Categoría',
      [ChannelType.GuildAnnouncement]: '📢 Anuncios',
      [ChannelType.GuildForum]: '🧵 Foro'
    }[channel.type] || 'Desconocido';

    let executor = 'Desconocido';
    try {
      const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
      const entry = fetchedLogs.entries.first();
      if (entry) executor = entry.executor.tag;
    } catch {}

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Channel Deleted')
      .setColor('#ED4245')
      .addFields(
        { name: '📌 Canal', value: channel.name },
        { name: '📂 Tipo', value: tipo, inline: true },
        { name: '🛠️ Eliminado por', value: executor, inline: true }
      )
      .setTimestamp();
    await logChannel.send({ embeds: [embed] });
  }
};