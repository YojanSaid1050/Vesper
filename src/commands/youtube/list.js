const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { joinWithinLimit } = require('../../utils/discordLimits');
const { getGuildConfig } = require('../../database/mongoManager');
const { getChannelInfo } = require('../../platforms/youtube/utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtube-list')
    .setDescription('Muestra la lista de canales de YouTube monitoreados')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const config = await getGuildConfig(interaction.guildId);
    const users = config.youtube?.users || [];
    const { liveChannel, videoChannel, shortChannel } = config.youtube || {};

    if (users.length === 0) {
      return interaction.editReply({ content: '📋 No hay canales de YouTube configurados para monitorear.\n\nUsa `/youtube-add` para agregar uno.' });
    }

    const channelInfoList = [];
    for (const userId of users.slice(0, 25)) {
      const info = await getChannelInfo(userId);
      channelInfoList.push(info || { name: userId, handle: userId, error: true });
      await new Promise(r => setTimeout(r, 100));
    }

    const embed = new EmbedBuilder()
      .setTitle('📺 Canales de YouTube monitoreados')
      .setColor(0xFF0000)
      .addFields(
        // Un valor de campo admite 1024 caracteres: con ~20 canales de nombre
        // largo se pasaba y el comando no mostraba nada.
        { name: '🎭 Canales vigilados', value: joinWithinLimit(
          channelInfoList.map(c => c.error ? `• \`${c.name}\` (⚠️ No encontrado)` : `• **${c.name}**\n  └ \`${c.handle || c.id}\``)
        ), inline: false },
        { name: '🔴 Canal de Directos', value: liveChannel ? `<#${liveChannel}>` : '`No configurado`', inline: true },
        { name: '📹 Canal de Videos', value: videoChannel ? `<#${videoChannel}>` : '`No configurado`', inline: true },
        { name: '📱 Canal de Shorts', value: shortChannel ? `<#${shortChannel}>` : '`No configurado`', inline: true }
      )
      .setFooter({ text: `${users.length} canales en total` });

    await interaction.editReply({ embeds: [embed] });
  }
};