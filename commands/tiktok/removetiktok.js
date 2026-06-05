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
  'tiktok',
  'config.json'
);

const videosPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'tiktok',
  'videos.json'
);

const liveStatusPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'tiktok',
  'liveStatus.json'
);

module.exports = {

  data: new SlashCommandBuilder()

    .setName('removetiktok')

    .setDescription(
      'Elimina una cuenta TikTok'
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
          .trim()
          .toLowerCase();

      const config = JSON.parse(
        fs.readFileSync(
          configPath,
          'utf8'
        )
      );

      const exists =
        config.users.includes(
          username
        );

      if (!exists) {

        return interaction.editReply(
          `❌ El usuario @${username} no está registrado.`
        );

      }

      // =====================
      // CONFIG.JSON
      // =====================

      config.users =
        config.users.filter(
          user =>
            user !== username
        );

      fs.writeFileSync(
        configPath,
        JSON.stringify(
          config,
          null,
          2
        )
      );

      // =====================
      // VIDEOS.JSON
      // =====================

      if (
        fs.existsSync(
          videosPath
        )
      ) {

        const videos =
          JSON.parse(
            fs.readFileSync(
              videosPath,
              'utf8'
            )
          );

        delete videos[
          username
        ];

        fs.writeFileSync(
          videosPath,
          JSON.stringify(
            videos,
            null,
            2
          )
        );

      }

      // =====================
      // LIVESTATUS.JSON
      // =====================

      if (
        fs.existsSync(
          liveStatusPath
        )
      ) {

        const liveStatus =
          JSON.parse(
            fs.readFileSync(
              liveStatusPath,
              'utf8'
            )
          );

        delete liveStatus[
          username
        ];

        fs.writeFileSync(
          liveStatusPath,
          JSON.stringify(
            liveStatus,
            null,
            2
          )
        );

      }

      await interaction.editReply(

        `✅ Usuario eliminado correctamente: @${username}`

      );

    } catch (error) {

      console.error(
        '❌ Error eliminando usuario TikTok'
      );

      console.error(error);

      await interaction.editReply(
        '❌ Error eliminando usuario.'
      );

    }

  }

};