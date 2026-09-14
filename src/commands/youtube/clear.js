const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const { getChannelInfo } = require('../../platforms/youtube/utils');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');
const { CAPABILITIES, requireCapability } = require('../../core/PermissionService');
const { clearGuildCache } = require('../../platforms/youtube/monitors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtube-clear')
    .setDescription('Elimina TODOS los canales de YouTube del monitoreo')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const config = await getGuildConfig(interaction.guildId);
      const currentUsers = config.youtube?.users || [];
      const currentCount = currentUsers.length;

      if (currentCount === 0) {
        return interaction.reply({ content: '📋 No hay canales de YouTube configurados para eliminar.', flags: 64 });
      }

      let channelNames = [];
      for (const userId of currentUsers.slice(0, 10)) {
        try {
          const info = await getChannelInfo(userId);
          channelNames.push(info?.name || userId);
        } catch (err) {
          channelNames.push(userId);
        }
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

      const filter = i => i.user.id === interaction.user.id
        && ['youtube_clear_confirm', 'youtube_clear_cancel'].includes(i.customId);
      const response = await interaction.fetchReply();
      const collector = response.createMessageComponentCollector({ filter, time: 15000, max: 1 });

      collector.on('collect', async i => {
        try {
          if (!await requireCapability(i, CAPABILITIES.SOCIAL_MANAGE)) return;
          if (i.customId === 'youtube_clear_confirm') {
            await updateGuildSection(interaction.guildId, 'youtube', { users: [] });
            await clearGuildCache(interaction.guildId);
            await i.update({ content: `✅ Se eliminaron **${currentCount}** canales del monitoreo de YouTube.`, embeds: [], components: [] });
            
            // Refrescar dashboard automáticamente
            const activePanel = await getActivePanel(interaction.guildId);
            await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
          } else {
            await i.update({ content: '❌ Operación cancelada.', embeds: [], components: [] });
          }
        } catch (error) {
          console.error('Error en confirmación youtube-clear:', error);
          // Si la confirmación ya se envió, `update` lanza
          // InteractionAlreadyReplied y el usuario no se entera de nada.
          const aviso = { content: `❌ Error al eliminar: ${error.message}`, embeds: [], components: [] };
          if (i.replied || i.deferred) await i.followUp({ content: aviso.content, flags: 64 }).catch(() => null);
          else await i.update(aviso).catch(() => null);
        }
      });

      // Sin esto, pasados los 15 segundos los botones seguían visibles y al
      // pulsarlos Discord mostraba «La interacción falló» sin explicar nada.
      collector.on('end', async collected => {
        if (collected.size) return;
        await interaction.editReply({
          content: '⌛ La confirmación caducó. Vuelve a ejecutar el comando si quieres continuar.',
          embeds: [],
          components: []
        }).catch(() => null);
      });

    } catch (error) {
      console.error('Error en youtube-clear:', error);
      await interaction.reply({ content: `❌ Error al procesar la solicitud: ${error.message}`, flags: 64 });
    }
  }
};
