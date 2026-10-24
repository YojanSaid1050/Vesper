const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');

// La interfaz fija de las salas de voz temporales: 15 botones dentro del
// bloque para cambiar nombre, límite, privacidad y quién puede entrar.
module.exports = {
  capability: CAPABILITIES.GUILD_ADMIN,
  data: new SlashCommandBuilder()
    .setName('salas')
    .setDescription('Salas de voz temporales.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(command => command.setName('interfaz').setDescription('Publica la interfaz con los botones para gestionar las salas')
      .addChannelOption(option => option.setName('canal').setDescription('Canal de texto; por defecto, este').addChannelTypes(ChannelType.GuildText))),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });
    try {
      const { publishInterface } = require('../../core/TempVoiceService');
      const channel = interaction.options.getChannel('canal') || interaction.channel;
      const result = await publishInterface(client, interaction.guildId, channel.id);
      return interaction.editReply(`✅ Interfaz de salas publicada en <#${result.channelId}>. Los botones actúan sobre la sala en la que esté cada persona.`);
    } catch (error) {
      return interaction.editReply(`❌ ${String(error.message || error).slice(0, 400)}`);
    }
  }
};
