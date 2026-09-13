const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');
const { clearGuildCache } = require('../../platforms/tiktok/monitors');
const { CAPABILITIES, requireCapability } = require('../../core/PermissionService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tiktok-clear')
    .setDescription('Elimina TODOS los usuarios de TikTok del monitoreo')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const config = await getGuildConfig(interaction.guildId);
      const currentUsers = config.tiktok?.users || [];
      const currentCount = currentUsers.length;

      if (currentCount === 0) {
        return interaction.reply({ content: '📋 No hay usuarios de TikTok configurados para eliminar.', flags: 64 });
      }

      const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Confirmar eliminación')
        .setDescription(`Estás a punto de eliminar **${currentCount}** usuarios de la lista de monitoreo.\n\n${currentUsers.slice(0, 20).map(u => `• ${u}`).join('\n')}${currentCount > 20 ? `\n\n*... y ${currentCount - 20} más*` : ''}\n\nEsta acción no se puede deshacer.`)
        .setColor(0x000000);

      await interaction.reply({
        embeds: [confirmEmbed],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('tiktok_clear_confirm').setLabel('Sí, eliminar todo').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('tiktok_clear_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        )],
        flags: 64
      });

      const filter = i => i.user.id === interaction.user.id
        && ['tiktok_clear_confirm', 'tiktok_clear_cancel'].includes(i.customId);
      const response = await interaction.fetchReply();
      const collector = response.createMessageComponentCollector({ filter, time: 15000, max: 1 });

      collector.on('collect', async i => {
        try {
          if (!await requireCapability(i, CAPABILITIES.SOCIAL_MANAGE)) return;
          if (i.customId === 'tiktok_clear_confirm') {
            await updateGuildSection(interaction.guildId, 'tiktok', { users: [] });
            await clearGuildCache(interaction.guildId);
            await i.update({ content: `✅ Se eliminaron **${currentCount}** usuarios del monitoreo de TikTok.`, embeds: [], components: [] });
            
            // Refrescar dashboard automáticamente
            const activePanel = await getActivePanel(interaction.guildId);
            await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
          } else {
            await i.update({ content: '❌ Operación cancelada.', embeds: [], components: [] });
          }
        } catch (error) {
          console.error('Error en confirmación tiktok-clear:', error);
          await i.update({ content: `❌ Error al eliminar: ${error.message}`, embeds: [], components: [] });
        }
      });
      
    } catch (error) {
      console.error('Error en tiktok-clear:', error);
      await interaction.reply({ content: `❌ Error al procesar la solicitud: ${error.message}`, flags: 64 });
    }
  }
};
