const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const checkUser =
  require('../../functions/TikTok/checkUser');

const {
  getGuildConfig,
  updateGuildConfig
} = require('../../utils/guildManager');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('addtiktok')

    .setDescription(
      'Añade una cuenta TikTok'
    )

    .addStringOption(option =>
      option
        .setName('usuario')
        .setDescription(
          'Usuario TikTok'
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

      const username =
        interaction.options
          .getString('usuario')
          .replace('@', '')
          .trim()
          .toLowerCase();

      const user =
        await checkUser(
          username
        );

      if (!user.exists) {

        return interaction.editReply(
          '❌ Esa cuenta de TikTok no existe.'
        );

      }

      const config =
        getGuildConfig(
          interaction.guild.id
        );

      if (!config.tiktok) {

        config.tiktok = {

          liveChannel: null,
          videoChannel: null,
          users: []

        };

      }

      const realUsername =
        user.username.toLowerCase();

      if (
        config.tiktok.users.includes(
          realUsername
        )
      ) {

        return interaction.editReply(
          '⚠️ Ese usuario ya está registrado.'
        );

      }

      config.tiktok.users.push(
        realUsername
      );

      updateGuildConfig(
        interaction.guild.id,
        config
      );

      await interaction.editReply(
        `✅ Usuario añadido: @${user.username}`
      );

    } catch (error) {

      console.error(error);

      await interaction.editReply(
        '❌ Error añadiendo usuario.'
      );

    }

  }

};