const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { updateGuildSection } = require('../../database/mongoManager'); // Cambiado a mongoManager

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Configura el canal de bienvenida')
    .addChannelOption(opt => opt.setName('canal').setDescription('Canal de bienvenida').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const canal = interaction.options.getChannel('canal');
    await updateGuildSection(interaction.guild.id, 'general', { welcomeChannel: canal.id }); // Añadir await
    await interaction.reply({ content: `✅ Canal de bienvenida configurado: ${canal}`, flags: 64 });
  }
};