const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { updateGuildSection } = require('../../database/mongoManager'); // Cambiado a mongoManager

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbotlog')
    .setDescription('Elige el canal de registros de bots')
    .addChannelOption(opt => opt.setName('canal').setDescription('Canal de registros de bots').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const canal = interaction.options.getChannel('canal');
    await updateGuildSection(interaction.guild.id, 'general', { botLogChannel: canal.id }); // Añadir await
    await interaction.reply({ content: `✅ Los registros de bots saldrán en ${canal}.`, flags: 64 });
  }
};