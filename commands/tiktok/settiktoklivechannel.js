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

    .setName('settiktoklivechannel')

    .setDescription(
      'Canal para transmisiones en vivo de TikTok'
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

      config.tiktok.liveChannel =
        channel.id;

      updateGuildConfig(
        interaction.guild.id,
        config
      );

      await interaction.reply({

        content:
          `✅ Canal TikTok Live configurado: ${channel}`,

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