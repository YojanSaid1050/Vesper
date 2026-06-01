const fs = require('fs');
const path = require('path');

const checkStreamer =
  require('./checkStreamer');

const configPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'twitchConfig.json'
);

const statusPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'twitchStatus.json'
);

module.exports = async (client) => {

  try {

    const config = JSON.parse(
      fs.readFileSync(
        configPath,
        'utf8'
      )
    );

    if (!config.alertChannel) {

      console.log(
        '⚠️ No hay canal de alertas configurado.'
      );

      return;

    }

    if (
      !config.streamers ||
      !config.streamers.length
    ) {

      console.log(
        '⚠️ No hay streamers configurados.'
      );

      return;

    }

    const channel =
      await client.channels.fetch(
        config.alertChannel
      );

    if (!channel) {

      console.log(
        '❌ No se encontró el canal de alertas.'
      );

      return;

    }

    let status = {};

    if (fs.existsSync(statusPath)) {

      status = JSON.parse(
        fs.readFileSync(
          statusPath,
          'utf8'
        )
      );

    }

    console.log(
      `📺 Revisando ${config.streamers.length} streamers...`
    );

    for (const streamer of config.streamers) {

      console.log(
        `🔍 Comprobando ${streamer}`
      );

      const data =
        await checkStreamer(
          streamer
        );

      if (!data) {

        console.log(
          `❌ No se pudo consultar ${streamer}`
        );

        continue;

      }

      if (!data.exists) {

        console.log(
          `⚠️ ${streamer} no existe en Twitch`
        );

        continue;

      }

      const wasOnline =
        status[streamer] || false;

      console.log(
        `${streamer}: ${
          data.online
            ? 'ONLINE'
            : 'OFFLINE'
        }`
      );

      // =====================================
      // OFFLINE -> ONLINE
      // =====================================

      if (
        data.online &&
        !wasOnline
      ) {

        console.log(
          `🔴 ${streamer} acaba de iniciar directo`
        );

        await channel.send({

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
'# ✧°.⋆༺ 𝐴𝑛 𝑒𝑐ℎ𝑜 𝑐𝑎𝑙𝑙𝑠 𝑓𝑟𝑜𝑚 𝑏𝑒𝑦𝑜𝑛𝑑 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 ༻⋆.°✧'

                },

                {

                  type: 14,

                  spacing: 1

                },

                {

                  type: 10,

                  content:
`## ｡ ﾟ ꒰ঌ ${data.streamer} 𝒉𝒂𝒔 𝒂𝒘𝒂𝒌𝒆𝒏𝒆𝒅

**${data.title}**

𓆰♕𓆪 𝑹𝒆𝒂𝒍𝒎: ${data.game || 'Unknown'}

𓆩ꨄ︎𓆪 𝑺𝒐𝒖𝒍𝒔 𝑾𝒂𝒕𝒄𝒉𝒊𝒏𝒈: ${data.viewers}

༺𓆩~~𝑎 𝑓𝑜𝑟𝑔𝑜𝑡𝑡𝑒𝑛 𝑒𝑚𝑏𝑒𝑟 𝑔𝑙𝑜𝑤𝑠 𝑜𝑛𝑐𝑒 𝑎𝑔𝑎𝑖𝑛~~𓆪༻`

                },

                {

                  type: 12,

                  items: [

                    {

                      media: {

                        url: data.thumbnail

                      }

                    }

                  ]

                },

                {

                  type: 1,

                  components: [

                    {

                      type: 2,

                      style: 5,

                      label:
                        '☾ 𝑬𝒏𝒕𝒆𝒓 𝒕𝒉𝒆 𝒂𝒃𝒚𝒔𝒔',

                      url:
                        `https://twitch.tv/${streamer}`

                    }

                  ]

                }

              ]

            }

          ]

        });

      }

      status[streamer] =
        data.online;

    }

    fs.writeFileSync(

      statusPath,

      JSON.stringify(
        status,
        null,
        2
      )

    );

  } catch (error) {

    console.error(
      '❌ Error monitor Twitch'
    );

    console.error(error);

  }

};