const {
  SlashCommandBuilder,
  EmbedBuilder,
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

module.exports = {

  data: new SlashCommandBuilder()

    .setName('tiktokusers')

    .setDescription(
      'Muestra los usuarios TikTok'
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    const config = JSON.parse(
      fs.readFileSync(
        configPath,
        'utf8'
      )
    );

    if (
      !config.users.length
    ) {

      return interaction.reply({

        content:
          '⚠️ No hay usuarios registrados.',

        flags: 64

      });

    }

    const embed =
      new EmbedBuilder()

        .setTitle(
          '🎵 Usuarios TikTok'
        )

        .setDescription(

          config.users
            .map(
              user =>
                `• @${user}`
            )
            .join('\n')

        );

    await interaction.reply({

      embeds: [embed],

      flags: 64

    });

  }

};