const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');

const {
  getGuildConfig,
  updateGuildConfig
} = require('../../utils/guildManager');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('setlog')

    .setDescription(
      'Configura el canal de logs'
    )

    .addChannelOption(option =>

      option

        .setName('canal')

        .setDescription(
          'Canal de logs'
        )

        .addChannelTypes(
          ChannelType.GuildText
        )

        .setRequired(true)

    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    try {

      const canal =
        interaction.options.getChannel(
          'canal'
        );

      const config =
        getGuildConfig(
          interaction.guild.id
        );

      config.general.logChannel =
        canal.id;

      updateGuildConfig(
        interaction.guild.id,
        config
      );

      await interaction.reply({

        content:
          `✅ Canal de logs configurado: ${canal}`,

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ Error configurando el canal de logs.',

        flags: 64

      });

    }

  }

};