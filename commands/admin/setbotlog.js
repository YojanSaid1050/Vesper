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

    .setName('setbotlog')

    .setDescription(
      'Configura el canal de logs para bots'
    )

    .addChannelOption(option =>

      option

        .setName('canal')

        .setDescription(
          'Canal donde se enviarán los logs de bots'
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
          botLogChannel:
            canal.id
        }

      );

      await interaction.reply({

        content:
          `✅ Canal de logs para bots configurado: ${canal}`,

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ Error configurando el canal.',

        flags: 64

      });

    }

  }

};