const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const {
  updateGuildSection
} = require('../../utils/guildManager');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('settwitchchannel')

    .setDescription(
      'Configura el canal de alertas de Twitch'
    )

    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription(
          'Canal donde se enviarán las alertas'
        )
        .setRequired(true)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    const canal =
      interaction.options.getChannel(
        'canal'
      );

    try {

      updateGuildSection(

        interaction.guild.id,

        'twitch',

        {
          liveChannel: canal.id
        }

      );

      await interaction.reply({

        content:
          `✅ Canal de alertas Twitch configurado: ${canal}`,

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ Error guardando la configuración.',

        flags: 64

      });

    }

  }

};