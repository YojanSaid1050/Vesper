const fs = require('fs');
const path = require('path');

const checkStreamer =
  require('./checkStreamer');

const twitchLiveEmbed =
  require('../Embeds/twitchLiveEmbed');

const configPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'twitch',
  'config.json'
);

const statusPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'twitch',
  'status.json'
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

        await channel.send(

          twitchLiveEmbed({

            streamer:
              data.streamer,

            title:
              data.title,

            game:
              data.game,

            viewers:
              data.viewers,

            thumbnail:
              data.thumbnail,

            streamUrl:
              `https://twitch.tv/${streamer}`

          })

        );

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