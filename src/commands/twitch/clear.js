const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/guildManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitch-clear')
    .setDescription('Elimina TODOS los streamers de Twitch del monitoreo')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = getGuildConfig(interaction.guildId);
    const currentUsers = config.twitch?.users || [];
    const currentCount = currentUsers.length;

    if (currentCount === 0) {
      return interaction.reply({ content: '📋 No hay streamers de Twitch configurados para eliminar.', flags: 64 });
    }

    const confirmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Confirmar eliminación')
      .setDescription(`Estás a punto de eliminar **${currentCount}** streamers de la lista de monitoreo.\n\n${currentUsers.map(u => `• ${u}`).join('\n')}\n\nEsta acción no se puede deshacer.`)
      .setColor(0x9146FF);

    await interaction.reply({
      embeds: [confirmEmbed],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('twitch_clear_confirm').setLabel('Sí, eliminar todo').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('twitch_clear_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
      )],
      flags: 64
    });

    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000, max: 1 });

    collector.on('collect', async i => {
      if (i.customId === 'twitch_clear_confirm') {
        updateGuildSection(interaction.guildId, 'twitch', { ...config.twitch, users: [] });
        await i.update({ content: `✅ Se eliminaron **${currentCount}** streamers del monitoreo de Twitch.`, embeds: [], components: [] });
      } else {
        await i.update({ content: '❌ Operación cancelada.', embeds: [], components: [] });
      }
    });
  }
};