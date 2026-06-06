const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');

const {
  getGuildConfig,
  updateGuildConfig
} = require('../../utils/guildManager');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('setbotavatar')

    .setDescription(
      'Configura el avatar usado en los webhooks'
    )

    .addStringOption(option =>
      option

        .setName('url')

        .setDescription(
          'URL de la imagen'
        )

        .setRequired(true)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    try {

      const url =
        interaction.options.getString(
          'url'
        );

      let parsedUrl;

      try {

        parsedUrl =
          new URL(url);

      } catch {

        return interaction.reply({

          content:
            '❌ La URL proporcionada no es válida.',

          flags: 64

        });

      }

      const imageExtensions = [

        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.webp'

      ];

      const pathname =
        parsedUrl.pathname
          .toLowerCase();

      const isImageUrl =
        imageExtensions.some(
          ext =>
            pathname.endsWith(ext)
        );

      const isDiscordCdn =

        parsedUrl.hostname.includes(
          'discordapp.com'
        ) ||

        parsedUrl.hostname.includes(
          'discord.com'
        ) ||

        parsedUrl.hostname.includes(
          'discordapp.net'
        );

      if (
        !isImageUrl &&
        !isDiscordCdn
      ) {

        return interaction.reply({

          content:
            '❌ La URL debe apuntar a una imagen válida.',

          flags: 64

        });

      }

      const config =
        getGuildConfig(
          interaction.guild.id
        );

      config.branding.avatar =
        url;

      updateGuildConfig(
        interaction.guild.id,
        config
      );

      const embed =
        new EmbedBuilder()

          .setTitle(
            '✅ Avatar actualizado'
          )

          .setImage(url)

          .setColor('#ffffff')

          .setTimestamp();

      await interaction.reply({

        embeds: [embed],

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ No se pudo actualizar el avatar.',

        flags: 64

      });

    }

  }

};