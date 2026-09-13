const { SlashCommandBuilder } = require('discord.js');
const CommunityTicket = require('../../database/models/CommunityTicket');
const { closeTicket, createTicket } = require('../../core/CommunityService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Abre, consulta o cierra tus tickets.')
    .addSubcommand(command => command.setName('abrir').setDescription('Abre un ticket privado.')
      .addStringOption(option => option.setName('asunto').setDescription('Explica brevemente lo que necesitas').setMinLength(5).setMaxLength(200).setRequired(true)))
    .addSubcommand(command => command.setName('estado').setDescription('Muestra tus tickets abiertos.'))
    .addSubcommand(command => command.setName('cerrar').setDescription('Cierra el ticket de este canal.')
      .addStringOption(option => option.setName('motivo').setDescription('Motivo del cierre').setMaxLength(500))),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'abrir') return createTicket(interaction, interaction.options.getString('asunto'));
    if (subcommand === 'estado') {
      const tickets = await CommunityTicket.find({ guildId: interaction.guildId, userId: interaction.user.id, status: 'open' }).sort({ createdAt: -1 }).limit(10);
      return interaction.reply({
        content: tickets.length
          ? tickets.map(ticket => `• **${ticket.ticketId}** · <#${ticket.channelId}> · ${ticket.subject}`).join('\n')
          : 'No tienes tickets abiertos.',
        flags: 64,
        allowedMentions: { parse: [] }
      });
    }
    const ticket = await CommunityTicket.findOne({ guildId: interaction.guildId, channelId: interaction.channelId, status: 'open' });
    if (!ticket) return interaction.reply({ content: 'Este canal no corresponde a un ticket abierto.', flags: 64 });
    return closeTicket(interaction, ticket.ticketId, interaction.options.getString('motivo') || 'Cerrado mediante comando');
  }
};
