const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('clear')

    .setDescription('Borra mensajes del canal')

    .addIntegerOption(option =>
      option
        .setName('cantidad')
        .setDescription('Cantidad de mensajes a borrar')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  async execute(interaction) {

    const cantidad =
      interaction.options.getInteger(
        'cantidad'
      );

    const mensajes =
      await interaction.channel.bulkDelete(
        cantidad,
        true
      );

    const embed = new EmbedBuilder()

      .setTitle('🧹 Messages Cleared')

      .setDescription(
        `Se eliminaron **${mensajes.size}** mensajes.\n\n👮 Moderador: ${interaction.user}`
      )

      .setColor('#ffffff')

      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });

  }
};