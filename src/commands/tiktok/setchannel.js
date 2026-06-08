const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');

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
      return interaction.editReply({ content: `✅ Canal de directos configurado: <#${channel.id}>` });
    }

    if (subcommand === 'videos') {
      const channel = interaction.options.getChannel('canal');
      await updateGuildSection(interaction.guildId, 'tiktok', { ...config.tiktok, videoChannel: channel.id });
      return interaction.editReply({ content: `✅ Canal de videos configurado: <#${channel.id}>` });
    }
  }
};