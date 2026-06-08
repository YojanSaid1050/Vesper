const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { updateGuildSection } = require('../../database/guildManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbotname')
    .setDescription('Configura el nombre usado en los webhooks')
    .addStringOption(opt => opt.setName('nombre').setDescription('Nombre a mostrar').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const nombre = interaction.options.getString('nombre');
    updateGuildSection(interaction.guild.id, 'branding', { name: nombre });

    const embed = new EmbedBuilder()
      .setTitle('✅ Branding actualizado')
      .setDescription(`Nuevo nombre:\n**${nombre}**`)
      .setColor('#ffffff')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};