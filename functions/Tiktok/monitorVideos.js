const fs = require('fs');
const path = require('path');

const checkUsers =
  require('./checkUsers');

const tiktokVideoEmbed =
  require('../Embeds/tiktokVideoEmbed');

const {
  sendBrandedMessage
} = require('../../utils/webhookSender');

const {
  getAllGuilds
} = require('../../utils/guildManager');

const videosPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'tiktok',
  'videos.json'
);

// ==================================================
// CARGAR JSON SEGURO
// ==================================================

function loadVideos() {

  try {

    if (!fs.existsSync(videosPath)) {

      return {};

    }

    const raw =
      fs.readFileSync(
        videosPath,
        'utf8'
      );

    return raw.trim()
      ? JSON.parse(raw)
      : {};

  }

  catch {

    console.error(
      '⚠️ videos.json corrupto, restaurando...'
    );

    return {};

  }

}

// ==================================================
// GUARDAR JSON SEGURO
// ==================================================

function saveVideos(videos) {

  const tempPath =
    `${videosPath}.tmp`;

  fs.writeFileSync(

    tempPath,

    JSON.stringify(
      videos,
      null,
      2
    )

  );

  fs.renameSync(
    tempPath,
    videosPath
  );

}

// ==================================================
// MONITOR
// ==================================================

module.exports = async (client) => {

  try {

    const guilds =
      getAllGuilds();

    if (!guilds.length) {

      console.log(
        '⚠️ No hay servidores configurados.'
      );

      return;

    }

    const videos =
      loadVideos();

    for (const guildConfig of guilds) {

      try {

        const {
          guildId,
          tiktok
        } = guildConfig;

        if (!tiktok) {

          continue;

        }

        const users =
          tiktok.users || [];

        const videoChannelId =
          tiktok.videoChannel;

        if (
          !videoChannelId ||
          !Array.isArray(users) ||
          !users.length
        ) {

          continue;

        }

        const channel =
          await client.channels.fetch(
            videoChannelId
          ).catch(() => null);

        if (!channel) {

          console.log(
            `⚠️ Canal TikTok Videos inválido (${guildId})`
          );

          continue;

        }

        console.log(
          `🎬 [${guildId}] Revisando ${users.length} cuentas TikTok...`
        );

        const items =
          await checkUsers(
            users
          );

        if (
          !Array.isArray(items)
        ) {

          continue;

        }

        for (const item of items) {

          try {

            const username =
              item.authorMeta?.name
                ?.toLowerCase();

            if (!username) {

              continue;

            }

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

            if (!videos[guildId]) {

              videos[guildId] = {};

            }

            const lastVideo =
              videos[guildId][username];

            // ==========================
            // PRIMER VIDEO
            // ==========================

            if (!lastVideo) {

              videos[guildId][username] =
                data.videoId;

              console.log(
                `💾 [${guildId}] Video inicial guardado para ${username}`
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
                `🎬 [${guildId}] Nuevo video detectado: ${username}`
              );

              await sendBrandedMessage(

                channel,

                tiktokVideoEmbed(
                  data,
                  item
                )

              );

              videos[guildId][username] =
                data.videoId;

            }

          }

          catch (error) {

            console.error(
              `❌ Error procesando video TikTok`
            );

            console.error(
              error
            );

          }

        }

      }

      catch (guildError) {

        console.error(
          '❌ Error procesando servidor TikTok'
        );

        console.error(
          guildError
        );

      }

    }

    saveVideos(videos);

  }

  catch (error) {

    console.error(
      '❌ Error monitor TikTok Videos'
    );

    console.error(
      error
    );

  }

};

