const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const {
  getGuildConfig,
  updateGuildConfig
} = require('../../utils/guildManager');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('resetbranding')

    .setDescription(
      'Restablece el branding del servidor'
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

      config.branding = {

        name: null,
        avatar: null

      };

      updateGuildConfig(
        interaction.guild.id,
        config
      );

      await interaction.reply({

        content:
          '✅ Branding restablecido correctamente.',

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ Ocurrió un error al restablecer el branding.',

        flags: 64

      });

    }

  }

};