const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');

// El refresco del panel estaba escrito después de los `return`, así que nunca
// llegaba a ejecutarse y el panel seguía mostrando la configuración vieja.
async function refreshDashboard(interaction) {
  try {
    const activePanel = await getActivePanel(interaction.guildId);
    await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
  } catch {
    // Que el panel no se refresque no debe hacer fallar el comando.
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tiktok-setchannel')
    .setDescription('Configura los canales de notificaciones de TikTok')
    .addSubcommand(sub => sub.setName('live').setDescription('Canal para notificaciones de directos').addChannelOption(opt => opt.setName('canal').setDescription('Canal de texto').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('videos').setDescription('Canal para notificaciones de videos').addChannelOption(opt => opt.setName('canal').setDescription('Canal de texto').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const subcommand = interaction.options.getSubcommand();
    const config = await getGuildConfig(interaction.guildId);

    if (subcommand === 'live') {
      const channel = interaction.options.getChannel('canal');
      await updateGuildSection(interaction.guildId, 'tiktok', { ...config.tiktok, liveChannel: channel.id });
      await refreshDashboard(interaction);
      return interaction.editReply({ content: `✅ Canal de directos configurado: <#${channel.id}>` });
    }

    if (subcommand === 'videos') {
      const channel = interaction.options.getChannel('canal');
      await updateGuildSection(interaction.guildId, 'tiktok', { ...config.tiktok, videoChannel: channel.id });
      await refreshDashboard(interaction);
      return interaction.editReply({ content: `✅ Canal de videos configurado: <#${channel.id}>` });
    }
  }
};