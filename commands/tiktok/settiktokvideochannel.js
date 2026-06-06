const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const {
  getGuildConfig,
  updateGuildConfig
} = require('../../utils/guildManager');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('settiktokvideochannel')

    .setDescription(
      'Canal para videos TikTok'
    )

    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription('Canal')
        .setRequired(true)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    try {

      const channel =
        interaction.options.getChannel(
          'canal'
        );

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

      config.tiktok.videoChannel =
        channel.id;

      updateGuildConfig(
        interaction.guild.id,
        config
      );

      await interaction.reply({

        content:
          `✅ Canal TikTok Videos configurado: ${channel}`,

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ Error configurando el canal.',

        flags: 64

      });

    }

  }

};