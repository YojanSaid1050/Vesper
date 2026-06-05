const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const checkUsers =
  require('../../functions/TikTok/checkUsers');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('testtiktok')

    .setDescription(
      'Prueba una cuenta TikTok'
    )

    .addStringOption(option =>
      option

        .setName('usuario')

        .setDescription(
          'Usuario TikTok'
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

    try {

      const username =
        interaction.options
          .getString('usuario')
          .replace('@', '')
          .trim();

      const items =
        await checkUsers([
          username
        ]);

      if (
        !items ||
        !items.length
      ) {

        return interaction.editReply(
          '❌ No se encontró la cuenta o no tiene videos.'
        );

      }

      const video = items[0];

      const embed =
        new EmbedBuilder()

          .setTitle(
            `🎬 @${video.authorMeta?.name}`
          )

          .setDescription(
            video.text ||
            'Sin descripción'
          )

          .setURL(
            video.webVideoUrl
          )

          .setImage(
            video.videoMeta?.coverUrl
          )

          .addFields(
            {
              name: '🆔 Video',
              value: video.id,
              inline: true
            }
          )

          .setColor('#FF0050');

      await interaction.editReply({

        embeds: [embed]

      });

    } catch (error) {

      console.error(error);

      await interaction.editReply(
        '❌ Error consultando TikTok.'
      );

    }

  }

};