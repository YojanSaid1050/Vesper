const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const checkUser =
  require('../../functions/TikTok/checkUser');

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

      // ==========================
      // VALIDAR USUARIO EN TIKTOK
      // ==========================

      const user =
        await checkUser(
          username
        );

      if (!user.exists) {

        return interaction.editReply(
          '❌ Esa cuenta de TikTok no existe.'
        );

      }

      // ==========================
      // LEER CONFIG
      // ==========================

      const config =
        JSON.parse(
          fs.readFileSync(
            configPath,
            'utf8'
          )
        );

      // ==========================
      // EVITAR DUPLICADOS
      // ==========================

      if (
        config.users.includes(
          username
        )
      ) {

        return interaction.editReply(
          '⚠️ Ese usuario ya está registrado.'
        );

      }

      // ==========================
      // GUARDAR
      // ==========================

      config.users.push(
  user.username.toLowerCase()
);

      fs.writeFileSync(

        configPath,

        JSON.stringify(
          config,
          null,
          2
        )

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