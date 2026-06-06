const verifyButton =
  require('../../handlers/verifyButton');

const dashboardButtons =
  require('../../handlers/dashboardButtons');

const dashboardSelects =
  require('../../handlers/dashboardSelects');

const dashboardModals =
  require('../../handlers/dashboardModals');

const {
  Events
} = require('discord.js');

module.exports = {

  name:
    Events.InteractionCreate,

  async execute(
    interaction,
    client
  ) {

    console.log(

      '[ROUTER]',

      interaction.type,

      interaction.customId ||

      interaction.commandName

    );

    try {

      // =====================================
      // SLASH COMMANDS
      // =====================================

      if (
        interaction.isChatInputCommand()
      ) {

        const command =
          client.commands.get(
            interaction.commandName
          );

        if (!command) {

          console.log(
            '⚠️ Comando no encontrado:',
            interaction.commandName
          );

          return;

        }

        await command.execute(
          interaction,
          client
        );

        return;

      }

      // =====================================
      // BOTONES
      // =====================================

      if (
        interaction.isButton()
      ) {

        // ==========================
        // VERIFY
        // ==========================

        if (
          interaction.customId ===
          'verify_void'
        ) {

          return verifyButton(
            interaction
          );

        }

        // ==========================
        // DASHBOARD
        // ==========================

        if (

          interaction.customId.startsWith(
            'dashboard_'
          )

          ||

          interaction.customId.startsWith(
            'branding_'
          )

          ||

          interaction.customId.startsWith(
            'tiktok_'
          )

          ||

          interaction.customId.startsWith(
            'twitch_'
          )

          ||

          interaction.customId.startsWith(
            'bot_'
          )

          ||

          interaction.customId.startsWith(
            'test_'
          )

        ) {

          return dashboardButtons(
            interaction
          );

        }

      }

      // =====================================
      // SELECT MENUS
      // =====================================

      if (

        interaction.isChannelSelectMenu()

        ||

        interaction.isStringSelectMenu()

        ||

        interaction.isRoleSelectMenu()

      ) {

        return dashboardSelects(
          interaction
        );

      }

      // =====================================
      // MODALS
      // =====================================

      if (
        interaction.isModalSubmit()
      ) {

        return dashboardModals(
          interaction
        );

      }

    }

    catch (error) {

      console.error(
        '❌ Error InteractionCreate'
      );

      console.error(
        error
      );

      try {

        if (

          !interaction.replied &&

          !interaction.deferred

        ) {

          await interaction.reply({

            content:
              '❌ Ocurrió un error inesperado.',

            ephemeral:
              true

          });

        }

      }

      catch {}

    }

  }

};