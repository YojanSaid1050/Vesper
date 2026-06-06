const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const {
  getGuildConfig
} = require('../../utils/guildManager');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('serverconfig')

    .setDescription(
      'Muestra toda la configuración del servidor'
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    try {

      const config =
        getGuildConfig(
          interaction.guild.id
        );

      const formatChannel = id =>
        id
          ? `<#${id}>`
          : '❌ No configurado';

      const formatRole = id =>
        id
          ? `<@&${id}>`
          : '❌ No configurado';

      const embed =
        new EmbedBuilder()

          .setTitle(
            `⚙️ Configuración de ${interaction.guild.name}`
          )

          .setColor('#ffffff')

          .addFields(

            {
              name: '👋 General',

              value:

`📥 Welcome
${formatChannel(
  config.general?.welcomeChannel
)}

📤 Goodbye
${formatChannel(
  config.general?.goodbyeChannel
)}

📋 Logs
${formatChannel(
  config.general?.logChannel
)}

🤖 Bot Logs
${formatChannel(
  config.general?.botLogChannel
)}

🎭 Bot Role
${formatRole(
  config.general?.botRole
)}`

            },

            {
              name: '🎵 TikTok',

              value:

`🎬 Videos
${formatChannel(
  config.tiktok?.videoChannel
)}

🔴 Lives
${formatChannel(
  config.tiktok?.liveChannel
)}

👤 Usuarios
${config.tiktok?.users?.length || 0}`

            },

            {
              name: '📺 Twitch',

              value:

`📡 Canal Live
${formatChannel(
  config.twitch?.liveChannel
)}

👤 Usuarios
${config.twitch?.users?.length || 0}`

            },

            {
              name: '🎨 Branding',

              value:

`🏷️ Nombre
${config.branding?.name || '❌ Sin configurar'}

🖼️ Avatar
${config.branding?.avatar
  ? '✅ Configurado'
  : '❌ Sin configurar'
}`

            }

          )

          .setThumbnail(
            interaction.guild.iconURL({
              dynamic: true
            })
          )

          .setTimestamp();

      await interaction.reply({

        embeds: [embed],

        flags: 64

      });

    } catch (error) {

      console.error(error);

      await interaction.reply({

        content:
          '❌ Error obteniendo la configuración del servidor.',

        flags: 64

      });

    }

  }

};