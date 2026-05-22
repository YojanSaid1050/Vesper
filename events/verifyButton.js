const {
  Events
} = require('discord.js');

module.exports = {

  name: Events.InteractionCreate,

  async execute(interaction) {

    if (
      !interaction.isButton()
    ) return;

    if (
      interaction.customId !==
      'verify_void'
    ) return;

    const roleId =
      '1506900567199449179';

    try {

      // SI YA TIENE EL ROL

      if (
        interaction.member.roles.cache.has(
          roleId
        )
      ) {

        return interaction.reply({

          content:
            '🌑 Ya abrazaste el vacío.',

          flags: 64

        });

      }

      // AGREGAR ROL

      await interaction.member.roles.add(
        roleId
      );

      await interaction.reply({

        content:
          '🌑 Has abrazado el vacío.',

        flags: 64

      });

    } catch (error) {

      console.error(error);

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {

        await interaction.reply({

          content:
            '❌ No pude verificarte.',

          flags: 64

        });

      }

    }

  }

};