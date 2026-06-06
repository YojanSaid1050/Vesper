const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');

const {
  updateGuildSection
} = require('../../utils/guildManager');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('setgoodbye')

    .setDescription(
      'Configura el canal de despedida'
    )

    .addChannelOption(option =>

      option

        .setName('canal')

        .setDescription(
          'Canal de despedida'
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

      updateGuildSection(

        interaction.guild.id,

        'general',

        {
          goodbyeChannel:
            canal.id
        }

      );

      await interaction.reply({

        content:
          `✅ Canal de despedida configurado: ${canal}`,

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ Error configurando el canal de despedida.',

        flags: 64

      });

    }

  }

};