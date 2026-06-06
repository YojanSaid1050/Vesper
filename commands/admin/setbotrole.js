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

    .setName('setbotrole')

    .setDescription(
      'Configura el rol automático para bots'
    )

    .addRoleOption(option =>

      option

        .setName('rol')

        .setDescription(
          'Rol para bots'
        )

        .setRequired(true)

    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    try {

      const rol =
        interaction.options.getRole(
          'rol'
        );

      const config =
        getGuildConfig(
          interaction.guild.id
        );

      config.general.botRole =
        rol.id;

      updateGuildConfig(
        interaction.guild.id,
        config
      );

      await interaction.reply({

        content:
          `✅ Rol para bots configurado: ${rol}`,

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ Error configurando el rol.',

        flags: 64

      });

    }

  }

};