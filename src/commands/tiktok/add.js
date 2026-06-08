const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/guildManager');
const { checkUser } = require('../../platforms/tiktok/checks');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tiktok-add')
    .setDescription('Añade un usuario de TikTok para monitorear')
    .addStringOption(option => option.setName('usuario').setDescription('Usuario de TikTok').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('usuario').replace('@', '').toLowerCase();
    const user = await checkUser(input);

    if (!user.exists) {
      return interaction.editReply({ content: `❌ No se encontró el usuario \`${input}\` en TikTok.` });
    }

    const config = getGuildConfig(interaction.guildId);
    const currentUsers = config.tiktok?.users || [];

    if (currentUsers.includes(user.username)) {
      return interaction.editReply({ content: `⚠️ El usuario **${user.username}** ya está siendo monitoreado.` });
    }

    const newUsers = [...currentUsers, user.username];
    updateGuildSection(interaction.guildId, 'tiktok', { ...config.tiktok, users: newUsers });

    await interaction.editReply({ content: `✅ Se añadió **${user.username}** a la lista de monitoreo.\n\n📋 Total de usuarios: ${newUsers.length}` });
  }
};