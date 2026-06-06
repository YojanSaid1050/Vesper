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

    .setName('setwelcome')

    .setDescription(
      'Configura el canal de bienvenida'
    )

    .addChannelOption(option =>

      option

        .setName('canal')

        .setDescription(
          'Canal de bienvenida'
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
          welcomeChannel:
            canal.id
        }

      );

      await interaction.reply({

        content:
          `✅ Canal de bienvenida configurado: ${canal}`,

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ Error configurando el canal de bienvenida.',

        flags: 64

      });

    }

  }

};