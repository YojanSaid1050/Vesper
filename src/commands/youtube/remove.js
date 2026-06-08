const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/guildManager');
const { getChannelInfo } = require('../../platforms/youtube/utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtube-remove')
    .setDescription('Elimina un canal de YouTube del monitoreo')
    .addStringOption(option => option.setName('canal').setDescription('URL, @handle o nombre del canal a eliminar').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('canal');
    const config = getGuildConfig(interaction.guildId);
    const currentUsers = config.youtube?.users || [];

    let foundChannelId = null;
    let foundChannelInfo = null;

    for (const userId of currentUsers) {
      const info = await getChannelInfo(userId);
      if (info && (info.handle === input.toLowerCase() || info.name.toLowerCase() === input.toLowerCase() || userId === input)) {
        foundChannelId = userId;
        foundChannelInfo = info;
        break;
      }
    }

    if (!foundChannelId) {
      return interaction.editReply({ content: `❌ No se encontró el canal \`${input}\` en la lista de monitoreo.\n\nUsa \`/youtube-list\` para ver los canales actuales.` });
    }

    const newUsers = currentUsers.filter(u => u !== foundChannelId);
    updateGuildSection(interaction.guildId, 'youtube', { ...config.youtube, users: newUsers });

    await interaction.editReply({ content: `✅ Se eliminó **${foundChannelInfo?.name || foundChannelId}** de la lista de monitoreo.\n\n📋 Canales restantes: ${newUsers.length}` });
  }
};