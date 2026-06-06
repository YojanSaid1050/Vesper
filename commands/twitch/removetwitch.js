const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const {
  getGuildConfig,
  updateGuildSection
} = require('../../utils/guildManager');

const statusPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'twitch',
  'status.json'
);

module.exports = {

  data: new SlashCommandBuilder()

    .setName('removetwitch')

    .setDescription(
      'Elimina un streamer de la lista'
    )

    .addStringOption(option =>
      option
        .setName('streamer')
        .setDescription(
          'Nombre del streamer'
        )
        .setRequired(true)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    await interaction.deferReply({
      flags: 64
    });

    try {

      const streamer =
        interaction.options
          .getString('streamer')
          .trim()
          .toLowerCase();

      // =========================
      // CONFIG GUILD
      // =========================

      const guildConfig =
        getGuildConfig(
          interaction.guild.id
        );

      const users =
        guildConfig.twitch.users || [];

      if (
        !users.includes(streamer)
      ) {

        return interaction.editReply(
          '⚠️ Ese streamer no está registrado.'
        );

      }

      const updatedUsers =
        users.filter(
          s => s !== streamer
        );

      updateGuildSection(

        interaction.guild.id,

        'twitch',

        {
          users: updatedUsers
        }

      );

      // =========================
      // LIMPIAR STATUS
      // =========================

      if (
        fs.existsSync(statusPath)
      ) {

        const status =
          JSON.parse(
            fs.readFileSync(
              statusPath,
              'utf8'
            )
          );

        const statusKey =
          `${interaction.guild.id}_${streamer}`;

        delete status[statusKey];

        fs.writeFileSync(

          statusPath,

          JSON.stringify(
            status,
            null,
            2
          )

        );

      }

      await interaction.editReply(
        `✅ Streamer eliminado: **${streamer}**`
      );

    } catch (error) {

      console.error(error);

      await interaction.editReply(
        '❌ Error eliminando streamer.'
      );

    }

  }

};