const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/guildManager');
const { verifyChannel } = require('../../platforms/youtube/utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtube-add')
    .setDescription('Añade un canal de YouTube para monitorear')
    .addStringOption(option => option.setName('canal').setDescription('URL, @handle o nombre del canal').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('canal');
    const channel = await verifyChannel(input);
    
    if (!channel.exists) {
      return interaction.editReply({ content: `❌ No se encontró el canal \`${input}\` en YouTube.\n\nAsegúrate de que el nombre sea correcto o usa la URL completa.` });
    }

    const config = getGuildConfig(interaction.guildId);
    const currentUsers = config.youtube?.users || [];

    if (currentUsers.includes(channel.id)) {
      return interaction.editReply({ content: `⚠️ El canal **${channel.name}** ya está siendo monitoreado.` });
    }

    const newUsers = [...currentUsers, channel.id];
    updateGuildSection(interaction.guildId, 'youtube', { ...config.youtube, users: newUsers });

    await interaction.editReply({ content: `✅ Se añadió **${channel.name}** a la lista de monitoreo.\n\n📺 ID: \`${channel.id}\`\n👥 Suscriptores: ${channel.subscribers.toLocaleString()}\n📋 Total de canales: ${newUsers.length}` });
  }
};