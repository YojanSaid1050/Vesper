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

    .setName('streamers')

    .setDescription(
      'Muestra los streamers vigilados'
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    try {

      const guildConfig =
        getGuildConfig(
          interaction.guild.id
        );

      const streamers =
        guildConfig.twitch.users || [];

      if (!streamers.length) {

        return interaction.reply({

          content:
            '⚠️ No hay streamers registrados.',

          flags: 64

        });

      }

      const embed =
        new EmbedBuilder()

          .setTitle(
            '📺 Streamers Vigilados'
          )

          .setDescription(

            streamers
              .map(
                streamer =>
                  `• ${streamer}`
              )
              .join('\n')

          )

          .setColor('#9146FF');

      await interaction.reply({

        embeds: [embed],

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ Error leyendo la configuración.',

        flags: 64

      });

    }

  }

};