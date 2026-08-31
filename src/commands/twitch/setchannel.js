const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitch-setchannel')
    .setDescription('Configura el canal de notificaciones de Twitch')
    .addChannelOption(opt => opt.setName('canal').setDescription('Canal de texto').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const channel = interaction.options.getChannel('canal');
    const config = await getGuildConfig(interaction.guildId);

    await updateGuildSection(interaction.guildId, 'twitch', { ...config.twitch, liveChannel: channel.id });

    await interaction.editReply({ content: `✅ Canal de notificaciones de Twitch configurado: <#${channel.id}>` });
// Refrescar dashboard automáticamente
    const activePanel = await getActivePanel(interaction.guildId);
    await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
  }
};