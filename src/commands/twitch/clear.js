const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const CacheManager = require('../../core/CacheManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');

const twitchCache = new CacheManager('./data/twitch');

function cleanTwitchGuild(guildId) {
  const data = twitchCache.load('status', {});
  for (const key of Object.keys(data)) {
    if (key.startsWith(`${guildId}_`)) {
      delete data[key];
    }
  }
  twitchCache.save('status', data);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitch-clear')
    .setDescription('Elimina TODOS los streamers de Twitch del monitoreo')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const config = await getGuildConfig(interaction.guildId);
      const currentUsers = config.twitch?.users || [];
      const currentCount = currentUsers.length;

      if (currentCount === 0) {
        return interaction.reply({ content: '📋 No hay streamers de Twitch configurados para eliminar.', flags: 64 });
      }

      const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Confirmar eliminación')
        .setDescription(`Estás a punto de eliminar **${currentCount}** streamers de la lista de monitoreo.\n\n${currentUsers.slice(0, 20).map(u => `• ${u}`).join('\n')}${currentCount > 20 ? `\n\n*... y ${currentCount - 20} más*` : ''}\n\nEsta acción no se puede deshacer.`)
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
        try {
          if (i.customId === 'twitch_clear_confirm') {
            await updateGuildSection(interaction.guildId, 'twitch', { ...config.twitch, users: [] });
            cleanTwitchGuild(interaction.guildId);
            await i.update({ content: `✅ Se eliminaron **${currentCount}** streamers del monitoreo de Twitch.`, embeds: [], components: [] });
            
            // Refrescar dashboard automáticamente
            const activePanel = await getActivePanel(interaction.guildId);
            await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
          } else {
            await i.update({ content: '❌ Operación cancelada.', embeds: [], components: [] });
          }
        } catch (error) {
          console.error('Error en confirmación twitch-clear:', error);
          await i.update({ content: `❌ Error al eliminar: ${error.message}`, embeds: [], components: [] });
        }
      });
      
    } catch (error) {
      console.error('Error en twitch-clear:', error);
      await interaction.reply({ content: `❌ Error al procesar la solicitud: ${error.message}`, flags: 64 });
    }
  }
};