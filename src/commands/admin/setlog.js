const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { updateGuildSection } = require('../../database/mongoManager'); // Cambiado a mongoManager

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('Configura el canal de logs')
    .addChannelOption(opt => opt.setName('canal').setDescription('Canal de logs').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const canal = interaction.options.getChannel('canal');
    await updateGuildSection(interaction.guild.id, 'general', { logChannel: canal.id }); // Añadir await
    await interaction.reply({ content: `✅ Canal de logs configurado: ${canal}`, flags: 64 });
  }
};