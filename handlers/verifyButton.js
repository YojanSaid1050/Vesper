module.exports =
  async function verifyButton(
    interaction
  ) {

    try {

      const role =
        interaction.guild.roles.cache.get(
          '1506900567199449179'
        );

      if (!role) {

        return interaction.reply({

          content:
            '❌ No se encontró el rol.',

          flags: 64

        });

      }

      if (

        interaction.member.roles.cache.has(
          role.id
        )

      ) {

        return interaction.reply({

          content:
            '🌑 Ya has abrazado el vacío.',

          flags: 64

        });

      }

      await interaction.member.roles.add(
        role
      );

      return interaction.reply({

        content:
          '🌑 Has abrazado el vacío.',

        flags: 64

      });

    }

    catch (error) {

      console.error(
        '❌ Error verifyButton'
      );

      console.error(error);

    }

  };