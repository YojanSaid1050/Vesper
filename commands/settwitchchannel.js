const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const configPath = path.join(
  __dirname,
  '..',
  'data',
  'twitchConfig.json'
);

module.exports = {

  data: new SlashCommandBuilder()

    .setName('settwitchchannel')

    .setDescription(
      'Configura el canal de alertas de Twitch'
    )

    .addChannelOption(option =>
      option

        .setName('canal')

        .setDescription(
          'Canal donde se enviarán las alertas'
        )

        .setRequired(true)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    const canal =
      interaction.options.getChannel(
        'canal'
      );

    try {

      const config =
        JSON.parse(
          fs.readFileSync(
            configPath,
            'utf8'
          )
        );

      config.alertChannel =
        canal.id;

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
          `✅ Canal de alertas configurado: ${canal}`,

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ Error guardando la configuración.',

        flags: 64

      });

    }

  }

};