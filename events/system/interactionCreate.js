const verifyButton = require('../../handlers/verifyButton');
const dashboardButtons = require('../../handlers/dashboardButtons');
const dashboardSelects = require('../../handlers/dashboardSelects');
const dashboardModals = require('../../handlers/dashboardModals');

const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction, client) {

    try {

      // ==================================================
      // SLASH COMMANDS
      // ==================================================
      if (interaction.isChatInputCommand()) {

        const command = client.commands.get(interaction.commandName);

        if (!command) {
          console.log('⚠️ Comando no encontrado:', interaction.commandName);
          return;
        }

        try {
          return await command.execute(interaction, client);
        } catch (err) {
          console.error('❌ Slash command error:', err);

          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ Error ejecutando el comando.',
              ephemeral: true
            });
          }
        }

        return;
      }

      // ==================================================
      // BOTONES
      // ==================================================
      if (interaction.isButton()) {

        try {
          // VERIFY BUTTON
          if (interaction.customId === 'verify_void') {
            return await verifyButton(interaction);
          }

          // BOTONES DE CONFIRMACIÓN (cancel_action, confirm_*)
          if (interaction.customId === 'cancel_action' || 
              interaction.customId.startsWith('confirm_')) {
            return await dashboardModals(interaction);
          }

          // DASHBOARD BUTTONS (navegación y acciones)
          if (
            interaction.customId.startsWith('dashboard_') ||
            interaction.customId.startsWith('branding_') ||
            interaction.customId.startsWith('tiktok_') ||
            interaction.customId.startsWith('twitch_') ||
            interaction.customId.startsWith('bot_') ||
            interaction.customId.startsWith('test_')
          ) {
            return await dashboardButtons(interaction);
          }

        } catch (err) {
          console.error('❌ Button error:', err);

          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ Error procesando botón.',
              ephemeral: true
            });
          }
        }

        return;
      }

      // ==================================================
      // SELECT MENUS
      // ==================================================
      if (
        interaction.isChannelSelectMenu() ||
        interaction.isStringSelectMenu() ||
        interaction.isRoleSelectMenu()
      ) {

        try {
          return await dashboardSelects(interaction);
        } catch (err) {
          console.error('❌ Select error:', err);

          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ Error en selección.',
              ephemeral: true
            });
          }
        }

        return;
      }

      // ==================================================
      // MODALS
      // ==================================================
      if (interaction.isModalSubmit()) {

        try {
          return await dashboardModals(interaction);
        } catch (err) {
          console.error('❌ Modal error:', err);

          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ Error procesando formulario.',
              ephemeral: true
            });
          }
        }

        return;
      }

    } catch (error) {

      console.error('❌ Error InteractionCreate global:', error);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Ocurrió un error inesperado.',
            ephemeral: true
          });
        }
      } catch {}

    }
  }
};