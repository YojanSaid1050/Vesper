const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitch-list')
    .setDescription('Muestra la lista de streamers de Twitch monitoreados')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const config = await getGuildConfig(interaction.guildId);
    const users = config.twitch?.users || [];
    const liveChannel = config.twitch?.liveChannel;

    if (users.length === 0) {
      return interaction.editReply({ content: '📋 No hay streamers de Twitch configurados para monitorear.\n\nUsa `/twitch-add` para agregar uno.' });
    }

    const embed = new EmbedBuilder()
      .setTitle('📺 Streamers de Twitch monitoreados')
      .setColor(0x9146FF)
      .addFields(
        { name: '🎭 Streamers vigilados', value: users.map(u => `• **${u}**`).join('\n') || 'Ninguno', inline: false },
        { name: '🔴 Canal de Directos', value: liveChannel ? `<#${liveChannel}>` : '`No configurado`', inline: true }
      )
      .setFooter({ text: `${users.length} streamers en total` });

    await interaction.editReply({ embeds: [embed] });
  }
};