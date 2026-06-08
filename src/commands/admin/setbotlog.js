const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { updateGuildSection } = require('../../database/guildManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbotlog')
    .setDescription('Configura el canal de logs para bots')
    .addChannelOption(opt => opt.setName('canal').setDescription('Canal de logs para bots').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const canal = interaction.options.getChannel('canal');
    updateGuildSection(interaction.guild.id, 'general', { botLogChannel: canal.id });
    await interaction.reply({ content: `✅ Canal de logs para bots configurado: ${canal}`, flags: 64 });
  }
};