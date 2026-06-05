const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const configPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'tiktok',
  'config.json'
);

module.exports = {

  data: new SlashCommandBuilder()

    .setName(
      'settiktokvideochannel'
    )

    .setDescription(
      'Canal para videos TikTok'
    )

    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription(
          'Canal'
        )
        .setRequired(true)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    const channel =
      interaction.options.getChannel(
        'canal'
      );

    const config = JSON.parse(
      fs.readFileSync(
        configPath,
        'utf8'
      )
    );

    config.videoChannel =
      channel.id;

    fs.writeFileSync(
      configPath,
      JSON.stringify(
        config,
        null,
        2
      )
    );

    await interaction.reply({

      content:
        `✅ Canal de videos configurado: ${channel}`,

      flags: 64

    });

  }

};