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

    .setName('setbotname')

    .setDescription(
      'Configura el nombre usado en los webhooks'
    )

    .addStringOption(option =>
      option

        .setName('nombre')

        .setDescription(
          'Nombre a mostrar'
        )

        .setRequired(true)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    try {

      const nombre =
        interaction.options.getString(
          'nombre'
        );

      const config =
        getGuildConfig(
          interaction.guild.id
        );

      config.branding.name =
        nombre;

      updateGuildConfig(
        interaction.guild.id,
        config
      );

      const embed =
        new EmbedBuilder()

          .setTitle(
            '✅ Branding actualizado'
          )

          .setDescription(
            `Nuevo nombre:\n**${nombre}**`
          )

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
          '❌ No se pudo actualizar el nombre.',

        flags: 64

      });

    }

  }

};