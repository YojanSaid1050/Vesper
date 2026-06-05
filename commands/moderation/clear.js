const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('clear')

    .setDescription(
      'Borra mensajes del canal'
    )

    .addIntegerOption(option =>
      option

        .setName('cantidad')

        .setDescription(
          'Cantidad de mensajes a borrar'
        )

        .setRequired(true)

        .setMinValue(1)

        .setMaxValue(100)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  async execute(interaction) {

    try {

      const cantidad =
        interaction.options.getInteger(
          'cantidad'
        );

      // ============================================
      // RESPUESTA INICIAL
      // ============================================

      await interaction.deferReply({

        flags: 64

      });

      // ============================================
      // BORRAR MENSAJES
      // ============================================

      const mensajes =
        await interaction.channel.bulkDelete(
          cantidad,
          true
        );

      // ============================================
      // EMBED
      // ============================================

      const embed =
        new EmbedBuilder()

          .setTitle(
            '🧹 Messages Cleared'
          )

          .setDescription(
            `Se eliminaron **${mensajes.size}** mensajes.\n\n👮 Moderador: ${interaction.user}`
          )

          .setColor('#ffffff')

          .setTimestamp();

      // ============================================
      // EDITAR RESPUESTA
      // ============================================

      await interaction.editReply({

        embeds: [embed]

      });

    } catch (error) {

      console.error(error);

      // ============================================
      // ERROR
      // ============================================

      if (
        interaction.deferred ||
        interaction.replied
      ) {

        await interaction.editReply({

          content:
            '❌ Ocurrió un error al borrar mensajes.'

        });

      } else {

        await interaction.reply({

          content:
            '❌ Ocurrió un error al borrar mensajes.',

          flags: 64

        });

      }

    }

  }

};