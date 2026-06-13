const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtube-setchannel')
    .setDescription('Configura los canales de notificaciones de YouTube')
    .addSubcommand(sub => sub.setName('live').setDescription('Canal para notificaciones de directos').addChannelOption(opt => opt.setName('canal').setDescription('Canal de texto').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('videos').setDescription('Canal para notificaciones de videos').addChannelOption(opt => opt.setName('canal').setDescription('Canal de texto').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('shorts').setDescription('Canal para notificaciones de shorts').addChannelOption(opt => opt.setName('canal').setDescription('Canal de texto').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName('clear').setDescription('Elimina la configuración de un canal').addStringOption(opt => opt.setName('tipo').setDescription('Tipo de canal a limpiar').setRequired(true).addChoices(
      { name: 'Directos', value: 'live' }, { name: 'Videos', value: 'videos' }, { name: 'Shorts', value: 'shorts' }, { name: 'Todos', value: 'all' }
    )))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const subcommand = interaction.options.getSubcommand();
    const config = await getGuildConfig(interaction.guildId);
    const current = { ...config.youtube, users: config.youtube?.users || [] };

    if (subcommand === 'live') {
      const channel = interaction.options.getChannel('canal');
      await updateGuildSection(interaction.guildId, 'youtube', { ...current, liveChannel: channel.id });
      return interaction.editReply({ content: `✅ Canal de directos configurado: <#${channel.id}>` });
    }

    if (subcommand === 'videos') {
      const channel = interaction.options.getChannel('canal');
      await updateGuildSection(interaction.guildId, 'youtube', { ...current, videoChannel: channel.id });
      return interaction.editReply({ content: `✅ Canal de videos configurado: <#${channel.id}>` });
    }

    if (subcommand === 'shorts') {
      const channel = interaction.options.getChannel('canal');
      await updateGuildSection(interaction.guildId, 'youtube', { ...current, shortChannel: channel.id });
      return interaction.editReply({ content: `✅ Canal de shorts configurado: <#${channel.id}>` });
    }

    if (subcommand === 'clear') {
      const tipo = interaction.options.getString('tipo');
      const newConfig = { ...current };
      let mensaje = '';
      
      switch (tipo) {
        case 'live':
          newConfig.liveChannel = null;
          mensaje = '✅ Canal de directos eliminado.';
          break;
        case 'videos':
          newConfig.videoChannel = null;
          mensaje = '✅ Canal de videos eliminado.';
          break;
        case 'shorts':
          newConfig.shortChannel = null;
          mensaje = '✅ Canal de shorts eliminado.';
          break;
        case 'all':
          newConfig.liveChannel = null;
          newConfig.videoChannel = null;
          newConfig.shortChannel = null;
          mensaje = '✅ Todos los canales de notificación fueron eliminados.';
          break;
      }
      
      await updateGuildSection(interaction.guildId, 'youtube', newConfig);
      return interaction.editReply({ content: mensaje });
    }
// Refrescar dashboard automáticamente
    const activePanel = await getActivePanel(interaction.guildId);
    await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
  }
};