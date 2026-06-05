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
  'twitch',
  'config.json'
);

module.exports = {

  data: new SlashCommandBuilder()

    .setName('streamers')

    .setDescription(
      'Muestra los streamers vigilados'
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    try {

      const config =
        JSON.parse(
          fs.readFileSync(
            configPath,
            'utf8'
          )
        );

      if (
        !config.streamers ||
        !config.streamers.length
      ) {

        return interaction.reply({

          content:
            '⚠️ No hay streamers registrados.',

          flags: 64

        });

      }

      const embed =
        new EmbedBuilder()

          .setTitle(
            '📺 Streamers Vigilados'
          )

          .setDescription(

            config.streamers
              .map(
                streamer =>
                  `• ${streamer}`
              )
              .join('\n')

          )

          .setColor('#9146FF');

      await interaction.reply({

        embeds: [embed],

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ Error leyendo la configuración.',

        flags: 64

      });

    }

  }

};