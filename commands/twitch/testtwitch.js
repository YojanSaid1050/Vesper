const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const checkStreamer =
  require('../../functions/Twitch/checkStreamer');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('testtwitch')

    .setDescription(
      'Prueba Twitch'
    )

    .addStringOption(option =>
      option

        .setName('streamer')

        .setDescription(
          'Nombre del streamer'
        )

        .setRequired(true)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    await interaction.deferReply({
      flags: 64
    });

    const streamer =
      interaction.options.getString(
        'streamer'
      );

    const data =
  await checkStreamer(
    streamer
  );

if (!data) {

  return interaction.editReply(
    '❌ Error consultando Twitch.'
  );

}

if (!data.exists) {

  return interaction.editReply(
    '❌ Ese canal de Twitch no existe.'
  );

}

if (!data.online) {

  return interaction.editReply(
    `⚫ ${streamer} está offline.`
  );

}

    const embed =
      new EmbedBuilder()

        .setTitle(
          `🔴 ${data.streamer} está en directo`
        )

        .setDescription(
          data.title
        )

        .addFields(

          {
            name: '🎮 Categoría',
            value: data.game || 'Sin categoría',
            inline: true
          },

          {
            name: '👥 Viewers',
            value: `${data.viewers}`,
            inline: true
          }

        )

        .setImage(
          data.thumbnail
        )

        .setColor('#9146FF');

    await interaction.editReply({

      embeds: [embed]

    });

  }

};