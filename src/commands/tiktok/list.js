const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tiktok-list')
    .setDescription('Muestra la lista de usuarios de TikTok monitoreados')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const config = await getGuildConfig(interaction.guildId);
    const users = config.tiktok?.users || [];
    const { liveChannel, videoChannel } = config.tiktok || {};

    if (users.length === 0) {
      return interaction.editReply({ content: '📋 No hay usuarios de TikTok configurados para monitorear.\n\nUsa `/tiktok-add` para agregar uno.' });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎵 Usuarios de TikTok monitoreados')
      .setColor(0x000000)
      .addFields(
        { name: '🎭 Usuarios vigilados', value: users.slice(0, 25).map(u => `• **${u}**`).join('\n') + (users.length > 25 ? `\n\n*... y ${users.length - 25} más*` : '') || 'Ninguno', inline: false },
        { name: '🔴 Canal de Directos', value: liveChannel ? `<#${liveChannel}>` : '`No configurado`', inline: true },
        { name: '🎬 Canal de Videos', value: videoChannel ? `<#${videoChannel}>` : '`No configurado`', inline: true }
      )
      .setFooter({ text: `${users.length} usuarios en total` });

    await interaction.editReply({ embeds: [embed] });
  }
};