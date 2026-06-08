const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/guildManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tiktok-remove')
    .setDescription('Elimina un usuario de TikTok del monitoreo')
    .addStringOption(option => option.setName('usuario').setDescription('Usuario de TikTok').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('usuario').replace('@', '').toLowerCase();
    const config = getGuildConfig(interaction.guildId);
    const currentUsers = config.tiktok?.users || [];

    if (!currentUsers.includes(input)) {
      return interaction.editReply({ content: `❌ El usuario \`${input}\` no está en la lista de monitoreo.\n\nUsa \`/tiktok-list\` para ver los usuarios actuales.` });
    }

    const newUsers = currentUsers.filter(u => u !== input);
    updateGuildSection(interaction.guildId, 'tiktok', { ...config.tiktok, users: newUsers });

    await interaction.editReply({ content: `✅ Se eliminó **${input}** de la lista de monitoreo.\n\n📋 Usuarios restantes: ${newUsers.length}` });
  }
};