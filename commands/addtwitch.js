const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const checkStreamer =
  require('../functions/twitch/checkStreamer');

const configPath = path.join(
  __dirname,
  '..',
  'data',
  'twitchConfig.json'
);

module.exports = {

  data: new SlashCommandBuilder()

    .setName('addtwitch')

    .setDescription(
      'Añade un streamer a la lista de seguimiento'
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

    try {

      const streamer =
        interaction.options
          .getString('streamer')
          .trim()
          .toLowerCase();

      // =====================================
      // VALIDAR EN TWITCH
      // =====================================

      const data =
        await checkStreamer(streamer);

      if (!data?.exists) {

  return interaction.editReply(
    '❌ Ese canal de Twitch no existe.'
  );

}

      // =====================================
      // CARGAR CONFIG
      // =====================================

      const config =
        JSON.parse(
          fs.readFileSync(
            configPath,
            'utf8'
          )
        );

      // =====================================
      // EVITAR DUPLICADOS
      // =====================================

      if (
        config.streamers.includes(
          streamer
        )
      ) {

        return interaction.editReply(
          '⚠️ Ese streamer ya está registrado.'
        );

      }

      // =====================================
      // GUARDAR
      // =====================================

      config.streamers.push(
        streamer
      );

      fs.writeFileSync(

        configPath,

        JSON.stringify(
          config,
          null,
          2
        )

      );

      await interaction.editReply(
        `✅ Streamer añadido: **${streamer}**`
      );

    } catch (error) {

      console.error(error);

      await interaction.editReply(
        '❌ Error añadiendo streamer.'
      );

    }

  }

};