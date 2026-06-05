const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const configPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'twitch',
  'config.json'
);

const statusPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'twitch',
  'status.json'
);

module.exports = {

  data: new SlashCommandBuilder()

    .setName('removetwitch')

    .setDescription(
      'Elimina un streamer de la lista'
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

      // ============================
      // CONFIG
      // ============================

      const config =
        JSON.parse(
          fs.readFileSync(
            configPath,
            'utf8'
          )
        );

      if (
        !config.streamers.includes(
          streamer
        )
      ) {

        return interaction.editReply(
          '⚠️ Ese streamer no está registrado.'
        );

      }

      config.streamers =
        config.streamers.filter(
          s => s !== streamer
        );

      fs.writeFileSync(

        configPath,

        JSON.stringify(
          config,
          null,
          2
        )

      );

      // ============================
      // STATUS
      // ============================

      if (
        fs.existsSync(statusPath)
      ) {

        const status =
          JSON.parse(
            fs.readFileSync(
              statusPath,
              'utf8'
            )
          );

        delete status[streamer];

        fs.writeFileSync(

          statusPath,

          JSON.stringify(
            status,
            null,
            2
          )

        );

      }

      await interaction.editReply(
        `✅ Streamer eliminado: **${streamer}**`
      );

    } catch (error) {

      console.error(error);

      await interaction.editReply(
        '❌ Error eliminando streamer.'
      );

    }

  }

};