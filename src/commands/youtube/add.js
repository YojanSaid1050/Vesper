const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, addGuildListItem } = require('../../database/mongoManager');
const { verifyChannel } = require('../../platforms/youtube/utils');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtube-add')
    .setDescription('Avisa cuando este canal de YouTube publique o entre en directo')
    .addStringOption(option => option.setName('canal').setDescription('Enlace, @usuario o nombre del canal').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('canal');
    const channel = await verifyChannel(input);
    
    if (!channel.exists) {
      return interaction.editReply({ content: `❌ No se encontró el canal \`${input}\` en YouTube.\n\nRevisa el nombre o pega el enlace del canal.` });
    }

    const config = await getGuildConfig(interaction.guildId);
    const currentUsers = config.youtube?.users || [];

    if (currentUsers.includes(channel.id)) {
      return interaction.editReply({ content: `⚠️ El canal **${channel.name}** ya lo sigue el bot.` });
    }

    const updated = await addGuildListItem(interaction.guildId, 'youtube', 'users', channel.id);
    const newUsers = updated.youtube?.users || [];

    await interaction.editReply({ content: `✅ Se añadió **${channel.name}** a las cuentas que sigue el bot.\n\n👥 Suscriptores: ${channel.subscribers.toLocaleString()}\n📋 Total de canales: ${newUsers.length}` });
// Refrescar dashboard automáticamente
    const activePanel = await getActivePanel(interaction.guildId);
    await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
  }
};
