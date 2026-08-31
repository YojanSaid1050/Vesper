const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const CacheManager = require('../../core/CacheManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');

const twitchCache = new CacheManager('./data/twitch');

function cleanTwitchStatus(guildId, username) {
  const data = twitchCache.load('status', {});
  const key = `${guildId}_${username}`;
  if (data[key] !== undefined) {
    delete data[key];
    twitchCache.save('status', data);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitch-remove')
    .setDescription('Elimina un streamer de Twitch del monitoreo')
    .addStringOption(option => option.setName('streamer').setDescription('Nombre del streamer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('streamer').toLowerCase();
    
    try {
      const config = await getGuildConfig(interaction.guildId);
      const currentUsers = config.twitch?.users || [];

      const existingUser = currentUsers.find(u => u.toLowerCase() === input);
      
      if (!existingUser) {
        return interaction.editReply({ content: `❌ El streamer \`${input}\` no está en la lista de monitoreo.\n\nUsa \`/twitch-list\` para ver los streamers actuales.` });
      }

      const newUsers = currentUsers.filter(u => u.toLowerCase() !== input);
      await updateGuildSection(interaction.guildId, 'twitch', { ...config.twitch, users: newUsers });

      cleanTwitchStatus(interaction.guildId, existingUser);

      await interaction.editReply({ content: `✅ Se eliminó **${existingUser}** de la lista de monitoreo.\n\n📋 Streamers restantes: ${newUsers.length}` });
      
      // Refrescar dashboard automáticamente
      const activePanel = await getActivePanel(interaction.guildId);
      await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
      
    } catch (error) {
      console.error('Error en twitch-remove:', error);
      await interaction.editReply({ content: `❌ Error al eliminar el streamer: ${error.message}` });
    }
  }
};