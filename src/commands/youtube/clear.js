const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/guildManager');
const { getChannelInfo } = require('../../platforms/youtube/utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtube-clear')
    .setDescription('Elimina TODOS los canales de YouTube del monitoreo')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = getGuildConfig(interaction.guildId);
    const currentUsers = config.youtube?.users || [];
    const currentCount = currentUsers.length;

    if (currentCount === 0) {
      return interaction.reply({ content: '📋 No hay canales de YouTube configurados para eliminar.', flags: 64 });
    }

    let channelNames = [];
    for (const userId of currentUsers.slice(0, 10)) {
      const info = await getChannelInfo(userId);
      channelNames.push(info?.channelName || userId);
    }

    const confirmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Confirmar eliminación')
      .setDescription(`Estás a punto de eliminar **${currentCount}** canales de la lista de monitoreo.\n\n${channelNames.map(n => `• ${n}`).join('\n')}${currentCount > 10 ? `\n\n*... y ${currentCount - 10} más*` : ''}\n\nEsta acción no se puede deshacer.`)
      .setColor(0xFF0000);

    await interaction.reply({
      embeds: [confirmEmbed],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('youtube_clear_confirm').setLabel('Sí, eliminar todo').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('youtube_clear_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
      )],
      flags: 64
    });

    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000, max: 1 });

    collector.on('collect', async i => {
      if (i.customId === 'youtube_clear_confirm') {
        updateGuildSection(interaction.guildId, 'youtube', { ...config.youtube, users: [] });
        await i.update({ content: `✅ Se eliminaron **${currentCount}** canales del monitoreo de YouTube.`, embeds: [], components: [] });
      } else {
        await i.update({ content: '❌ Operación cancelada.', embeds: [], components: [] });
      }
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        await interaction.editReply({ content: '⏰ Tiempo de espera agotado. Operación cancelada.', embeds: [], components: [] }).catch(() => {});
      }
    });
  }
};