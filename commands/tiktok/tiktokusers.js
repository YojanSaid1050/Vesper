const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const {
  getGuildConfig
} = require('../../utils/guildManager');

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

    try {

      const config =
        getGuildConfig(
          interaction.guild.id
        );

      const users =
        config.tiktok?.users || [];

      if (!users.length) {

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

            users
              .map(
                user =>
                  `• @${user}`
              )
              .join('\n')

          )

          .setColor(
            '#FF0050'
          )

          .setFooter({

            text:
              `${users.length} usuario(s) registrados`

          });

      await interaction.reply({

        embeds: [embed],

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ Error obteniendo usuarios TikTok.',

        flags: 64

      });

    }

  }

};