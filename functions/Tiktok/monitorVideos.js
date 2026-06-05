const fs = require('fs');
const path = require('path');

const checkUsers =
require('./checkUsers');

const tiktokVideoEmbed =
require('../Embeds/tiktokVideoEmbed');

const configPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'tiktok',
  'config.json'
);

const videosPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'tiktok',
  'videos.json'
);

module.exports = async (client) => {

  try {

    const config = JSON.parse(

      fs.readFileSync(
        configPath,
        'utf8'
      )

    );

    if (!config.videoChannel) {

      console.log(
        '⚠️ No hay canal de videos configurado.'
      );

      return;

    }

    if (
      !config.users ||
      !config.users.length
    ) {

      console.log(
        '⚠️ No hay usuarios TikTok configurados.'
      );

      return;

    }

    const channel =
      await client.channels.fetch(
        config.videoChannel
      );

    if (!channel) {

      console.log(
        '❌ Canal TikTok no encontrado.'
      );

      return;

    }

    let videos = {};

    if (
      fs.existsSync(videosPath)
    ) {

      videos = JSON.parse(

        fs.readFileSync(
          videosPath,
          'utf8'
        )

      );

    }

    console.log(
      `🎬 Revisando ${config.users.length} cuentas TikTok...`
    );

    const items =
      await checkUsers(
        config.users
      );

    for (const item of items) {

      try {

        const username =
          item.authorMeta?.name;

        if (!username)
          continue;

        const data = {

          username,

          nickname:
            item.authorMeta?.nickName,

          avatar:
            item.authorMeta?.avatar,

          videoId:
            item.id,

          description:
            item.text ||
            'Sin descripción',

          url:
            item.webVideoUrl,

          thumbnail:
            item.videoMeta?.coverUrl

        };

        const lastVideo =
          videos[username];

        // ==========================
        // PRIMERA VEZ
        // ==========================

        if (!lastVideo) {

          videos[username] =
            data.videoId;

          console.log(
            `💾 Video inicial guardado para ${username}`
          );

          continue;

        }

        // ==========================
        // VIDEO NUEVO
        // ==========================

        if (
          lastVideo !==
          data.videoId
        ) {

          console.log(
            `🎬 Nuevo video: ${username}`
          );

          await channel.send(

            tiktokVideoEmbed(
              data,
              item
            )

          );

          videos[username] =
            data.videoId;

        }

      } catch (error) {

        console.error(
          `❌ Error procesando video TikTok`
        );

        console.error(error);

      }

    }

    fs.writeFileSync(

      videosPath,

      JSON.stringify(
        videos,
        null,
        2
      )

    );

  } catch (error) {

    console.error(
      '❌ Error monitor TikTok Videos'
    );

    console.error(error);

  }

};