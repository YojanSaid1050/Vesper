const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const checkStreamer =
  require('../../functions/Twitch/checkStreamer');

const {
  getGuildConfig,
  updateGuildSection
} = require('../../utils/guildManager');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('addtwitch')

    .setDescription(
      'Añade un streamer a la lista de seguimiento'
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
      // VALIDAR TWITCH
      // =========================

      const data =
        await checkStreamer(
          streamer
        );

      if (!data?.exists) {

        return interaction.editReply(
          '❌ Ese canal de Twitch no existe.'
        );

      }

      // =========================
      // CONFIG GUILD
      // =========================

      const guildConfig =
        getGuildConfig(
          interaction.guild.id
        );

      const users =
        guildConfig.twitch.users || [];

      // =========================
      // DUPLICADO
      // =========================

      if (
        users.includes(streamer)
      ) {

        return interaction.editReply(
          '⚠️ Ese streamer ya está registrado.'
        );

      }

      users.push(streamer);

      updateGuildSection(

        interaction.guild.id,

        'twitch',

        {
          users
        }

      );

      await interaction.editReply(
        `✅ Streamer añadido: **${streamer}**`
      );

    } catch (error) {

      console.error(error);

      await interaction.editReply(
        '❌ Error añadiendo streamer.'
      );

    }

  }

};