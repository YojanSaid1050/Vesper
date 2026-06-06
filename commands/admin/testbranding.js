const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const {
  sendBrandedMessage
} = require('../../utils/webhookSender');

const {
  getGuildConfig
} = require('../../utils/guildManager');

const welcomeEmbed =
  require('../../functions/Embeds/welcomeEmbed');

const goodbyeEmbed =
  require('../../functions/Embeds/goodbyeEmbed');

const tiktokLiveEmbed =
  require('../../functions/Embeds/tiktokLiveEmbed');

const twitchLiveEmbed =
  require('../../functions/Embeds/twitchLiveEmbed');

const tiktokVideoEmbed =
  require('../../functions/Embeds/tiktokVideoEmbed');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('testbranding')

    .setDescription(
      'Prueba el branding configurado'
    )

    .addStringOption(option =>

      option

        .setName('tipo')

        .setDescription(
          'Tipo de mensaje de prueba'
        )

        .setRequired(true)

        .addChoices(

          {
            name: 'General',
            value: 'general'
          },

          {
            name: 'Welcome',
            value: 'welcome'
          },

          {
            name: 'Goodbye',
            value: 'goodbye'
          },

          {
            name: 'TikTok Live',
            value: 'tiktok'
          },

          {
            name: 'TikTok Video',
            value: 'tiktokvideo'
          },

          {
            name: 'Twitch Live',
            value: 'twitch'
          }

        )

    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    try {

      await interaction.deferReply({

        flags: 64

      });

      const tipo =
        interaction.options.getString(
          'tipo'
        );

      const config =
        getGuildConfig(
          interaction.guild.id
        );

      const branding =
        config.branding || {};

      let payload;

      switch (tipo) {

        case 'welcome':

          payload =
            welcomeEmbed.buildWelcomePayload(
              interaction.user
            );

          break;

        case 'goodbye':

          payload =
            goodbyeEmbed.buildGoodbyePayload({

              user: {

                username:
                  interaction.user.username

              }

            });

          break;

        case 'tiktok':

          payload =
            tiktokLiveEmbed({

              username:
                'streamer_demo',

              nickname:
                'Streamer Demo',

              viewers:
                1234,

              title:
                'Probando branding de TikTok',

              cover:
                'https://picsum.photos/1280/720',

              liveUrl:
                'https://www.tiktok.com'

            });

          break;

        case 'tiktokvideo':

          payload =
            tiktokVideoEmbed(

              {

                username:
                  'streamer_demo',

                nickname:
                  'Streamer Demo',

                description:
                  'Probando branding para alertas de videos TikTok.',

                url:
                  'https://www.tiktok.com',

                thumbnail:
                  'https://picsum.photos/1280/720'

              },

              {

                playCount:
                  123456,

                commentCount:
                  789

              }

            );

          break;

        case 'twitch':

          payload =
            twitchLiveEmbed({

              streamer:
                'streamer_demo',

              title:
                'Probando branding de Twitch',

              game:
                'Just Chatting',

              viewers:
                567,

              thumbnail:
                'https://picsum.photos/1280/720',

              streamUrl:
                'https://twitch.tv'

            });

          break;

        default:

          payload = {

            flags: 32768,

            components: [

              {

                type: 17,

                accent_color: 16777215,

                spoiler: false,

                components: [

                  {

                    type: 10,

                    content:
'# 🎨 Branding Test'

                  },

                  {

                    type: 14,

                    spacing: 1

                  },

                  {

                    type: 10,

                    content:
`### Configuración actual

**Nombre**
${branding.name || 'Sin configurar'}

**Avatar**
${branding.avatar || 'Sin configurar'}

**Servidor**
${interaction.guild.name}

✅ El branding funciona correctamente.`

                  }

                ]

              }

            ]

          };

      }

      await sendBrandedMessage(

        interaction.channel,

        payload

      );

      await interaction.editReply({

        content:
          `✅ Prueba de **${tipo}** enviada correctamente.`

      });

    } catch (error) {

      console.error(error);

      await interaction.editReply({

        content:
          '❌ Error enviando la prueba de branding.'

      });

    }

  }

};