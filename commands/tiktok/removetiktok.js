const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const {
  getGuildConfig,
  updateGuildConfig
} = require('../../utils/guildManager');

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

      const config =
        getGuildConfig(
          interaction.guild.id
        );

      const users =
        config.tiktok?.users || [];

      if (
        !users.includes(
          username
        )
      ) {

        return interaction.editReply(
          `❌ El usuario @${username} no está registrado.`
        );

      }

      config.tiktok.users =
        users.filter(
          user =>
            user !== username
        );

      updateGuildConfig(
        interaction.guild.id,
        config
      );

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