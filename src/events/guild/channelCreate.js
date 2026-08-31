const { Events, EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { createLog } = require('../../utils/logCache');

module.exports = {
  name: Events.ChannelCreate,
  async execute(channel) {
    if (!createLog(`channel-create-${channel.id}`)) return;

    const guildConfig = await getGuildConfig(channel.guild.id); // Añadir await
    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = channel.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const tipo = {
      [ChannelType.GuildText]: '💬 Texto',
      [ChannelType.GuildVoice]: '🔊 Voz',
      [ChannelType.GuildCategory]: '📂 Categoría',
      [ChannelType.GuildAnnouncement]: '📢 Anuncios',
      [ChannelType.GuildForum]: '🧵 Foro'
    }[channel.type] || 'Desconocido';

    let creator = 'Desconocido';
    try {
      const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
      const createLogEntry = fetchedLogs.entries.first();
      if (createLogEntry?.executor) creator = createLogEntry.executor.tag;
    } catch {}

    const embed = new EmbedBuilder()
      .setTitle('📁 Channel Created')
      .setColor('#57F287')
      .addFields(
        { name: '📌 Canal', value: `${channel}` },
        { name: '📂 Tipo', value: tipo, inline: true },
        { name: '🛠️ Creado por', value: creator, inline: true }
      )
      .setTimestamp();
    await logChannel.send({ embeds: [embed] });
  }
};