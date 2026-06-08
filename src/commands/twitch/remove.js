const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/guildManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitch-remove')
    .setDescription('Elimina un streamer de Twitch del monitoreo')
    .addStringOption(option => option.setName('streamer').setDescription('Nombre del streamer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('streamer').toLowerCase();
    const config = getGuildConfig(interaction.guildId);
    const currentUsers = config.twitch?.users || [];

    if (!currentUsers.includes(input)) {
      return interaction.editReply({ content: `❌ El streamer \`${input}\` no está en la lista de monitoreo.\n\nUsa \`/twitch-list\` para ver los streamers actuales.` });
    }

    const newUsers = currentUsers.filter(u => u !== input);
    updateGuildSection(interaction.guildId, 'twitch', { ...config.twitch, users: newUsers });

    await interaction.editReply({ content: `✅ Se eliminó **${input}** de la lista de monitoreo.\n\n📋 Streamers restantes: ${newUsers.length}` });
  }
};