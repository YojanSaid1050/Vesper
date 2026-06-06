const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');

const mainPanel =
  require('../../functions/Embeds/dashboard/mainPanel');

const {
  getGuildConfig,
  updateGuildSection
} = require('../../utils/guildManager');

module.exports = {

  data:
    new SlashCommandBuilder()

      .setName(
        'config-dashboard'
      )

      .setDescription(
        'Crea o reinicia el dashboard de configuración.'
      )

      .setDefaultMemberPermissions(
        PermissionFlagsBits.Administrator
      ),

  async execute(
    interaction
  ) {

    const guildId =
      interaction.guild.id;

    const config =
      getGuildConfig(
        guildId
      );

    // =========================
    // ELIMINAR DASHBOARD ANTERIOR
    // =========================

    if (
      config.dashboard?.channel &&
      config.dashboard?.message
    ) {

      try {

        const oldChannel =
          await interaction.guild.channels.fetch(
            config.dashboard.channel
          );

        if (oldChannel) {

          const oldMessage =
            await oldChannel.messages.fetch(
              config.dashboard.message
            );

          if (oldMessage) {

            await oldMessage.delete();

          }

        }

      }

      catch {

        // Ignorar si ya no existe

      }

    }

    // =========================
    // CREAR NUEVO DASHBOARD
    // =========================

    const message =
      await interaction.channel.send(
        mainPanel()
      );

    // =========================
    // GUARDAR IDS
    // =========================

    updateGuildSection(

      guildId,

      'dashboard',

      {

        channel:
          interaction.channel.id,

        message:
          message.id,

        enabled:
          true

      }

    );

    // =========================
    // CONFIRMACIÓN
    // =========================

    await interaction.reply({

      content:
        '✅ Dashboard creado correctamente.',

      flags:
        MessageFlags.Ephemeral

    });

  }

};