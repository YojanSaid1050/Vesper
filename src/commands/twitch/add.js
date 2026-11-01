const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, addGuildListItem } = require('../../database/mongoManager');
const { verifyStreamer } = require('../../platforms/twitch/utils');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');
const { friendlyError } = require('../../utils/userMessage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitch-add')
    .setDescription('Avisa cuando este canal de Twitch entre en directo')
    .addStringOption(option => option.setName('canal').setDescription('Nombre del canal de Twitch').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('canal').toLowerCase();
    
    try {
      const streamer = await verifyStreamer(input);

      if (!streamer.exists) {
        return interaction.editReply({ content: `❌ No se encontró el canal \`${input}\` en Twitch.` });
      }

      const config = await getGuildConfig(interaction.guildId);
      const currentUsers = config.twitch?.users || [];

      if (currentUsers.includes(streamer.login)) {
        return interaction.editReply({ content: `⚠️ El canal **${streamer.name}** ya lo sigue el bot.` });
      }

      const updated = await addGuildListItem(interaction.guildId, 'twitch', 'users', streamer.login);
      const newUsers = updated.twitch?.users || [];

      await interaction.editReply({ content: `✅ Se añadió **${streamer.name}** a las cuentas que sigue el bot.\n\n📋 Total de canales: ${newUsers.length}` });
      
      // Refrescar dashboard automáticamente
      const activePanel = await getActivePanel(interaction.guildId);
      await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
      
    } catch (error) {
      console.error('Error en twitch-add:', error);
      await interaction.editReply({ content: `❌ No pude comprobar ese canal. ${friendlyError(error, 'Inténtalo de nuevo en un momento.')}` });
    }
  }
};
