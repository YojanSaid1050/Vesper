const fs = require('fs');
const path = require('path');

const checkUsers = require('./checkUsers');
const tiktokVideoEmbed = require('../Embeds/tiktokVideoEmbed');

const { sendBrandedMessage } = require('../../utils/webhookSender');
const { getAllGuilds } = require('../../utils/guildManager');

const videosPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'tiktok',
  'videos.json'
);

// =========================
// SAFE LOAD
// =========================
function loadVideos() {
  try {
    if (!fs.existsSync(videosPath)) {
      return {};
    }

    const raw = fs.readFileSync(
      videosPath,
      'utf8'
    );

    return raw.trim()
      ? JSON.parse(raw)
      : {};

  } catch (err) {

    console.error(
      '⚠️ videos.json corrupto:',
      err
    );

    return {};

  }
}

// =========================
// SAFE SAVE
// =========================
function saveVideos(videos) {

  try {

    const tmp =
      videosPath + '.tmp';

    fs.writeFileSync(
      tmp,
      JSON.stringify(
        videos,
        null,
        2
      ),
      'utf8'
    );

    fs.renameSync(
      tmp,
      videosPath
    );

  } catch (err) {

    console.error(
      '❌ Error guardando videos.json',
      err
    );

  }

}

// =========================
// NORMALIZE
// =========================
function norm(user) {

  return (user || '')
    .toLowerCase()
    .replace('@', '')
    .trim();

}

// =========================
// CLEAN GUILD USERS
// =========================
function cleanGuildVideos(
  guildVideos,
  validUsers
) {

  const validSet =
    new Set(
      validUsers.map(norm)
    );

  for (
    const savedUser of Object.keys(
      guildVideos
    )
  ) {

    if (
      !validSet.has(
        norm(savedUser)
      )
    ) {

      console.log(
        `🧹 Eliminando video guardado de ${savedUser}`
      );

      delete guildVideos[
        savedUser
      ];

    }

  }

  return guildVideos;

}

// =========================
// MONITOR
// =========================
module.exports = async (client) => {

  try {

    const guilds =
      getAllGuilds();

    if (
      !guilds ||
      guilds.length === 0
    ) {
      return;
    }

    const videos =
      loadVideos();

    for (
      const {
        guildId,
        tiktok
      }
      of guilds
    ) {

      try {

        const users =
          (tiktok?.users || [])
            .map(norm);

        const videoChannel =
          tiktok?.videoChannel;

        // =========================
        // NO USERS
        // =========================
        if (
          users.length === 0
        ) {

          if (
            videos[guildId]
          ) {

            console.log(
              `🧹 Eliminando historial TikTok Videos de ${guildId}`
            );

            delete videos[
              guildId
            ];

          }

          continue;

        }

        if (
          !videoChannel
        ) {
          continue;
        }

        const channel =
          await client.channels
            .fetch(
              videoChannel
            )
            .catch(
              () => null
            );

        if (!channel) {
          continue;
        }

        const guildVideos =
          videos[guildId] || {};

        // =========================
        // CLEAN USERS
        // =========================
        cleanGuildVideos(
          guildVideos,
          users
        );

        if (
          Object.keys(
            guildVideos
          ).length === 0 &&
          videos[guildId]
        ) {

          delete videos[
            guildId
          ];

          saveVideos(
            videos
          );

        }

        console.log(
          `🎬 [${guildId}] Revisando ${users.length} cuentas TikTok...`
        );

        const items =
          await checkUsers(
            users
          );

        if (
          !Array.isArray(
            items
          )
        ) {
          continue;
        }

        for (
          const item
          of items
        ) {

          try {

            const username =
              norm(
                item
                  ?.authorMeta
                  ?.name
              );

            if (
              !username
            ) {
              continue;
            }

            const videoId =
              item?.id
                ?.toString();

            if (
              !videoId
            ) {
              continue;
            }

            const lastVideo =
              guildVideos[
                username
              ];

            // =========================
            // FIRST VIDEO
            // =========================
            if (
              !lastVideo
            ) {

              guildVideos[
                username
              ] = videoId;

              continue;

            }

            // =========================
            // NEW VIDEO
            // =========================
            if (
              lastVideo !==
              videoId
            ) {

              console.log(
                `🆕 Nuevo video ${username}: ${videoId}`
              );

              await sendBrandedMessage(
                channel,

                tiktokVideoEmbed(
                  {
                    username,

                    nickname:
                      item
                        ?.authorMeta
                        ?.nickName,

                    avatar:
                      item
                        ?.authorMeta
                        ?.avatar,

                    videoId,

                    description:
                      item?.text ||
                      'Sin descripción',

                    url:
                      item?.webVideoUrl,

                    thumbnail:
                      item
                        ?.videoMeta
                        ?.coverUrl
                  },

                  item
                )
              );

              guildVideos[
                username
              ] = videoId;

            }

          } catch (
            errItem
          ) {

            console.error(
              '❌ Error video item',
              errItem
            );

          }

        }

        // =========================
        // SAVE GUILD
        // =========================
        if (
          Object.keys(
            guildVideos
          ).length === 0
        ) {

          delete videos[
            guildId
          ];

        } else {

          videos[
            guildId
          ] = guildVideos;

        }

      } catch (
        errGuild
      ) {

        console.error(
          `❌ Error guild videos (${guildId})`,
          errGuild
        );

      }

    }

    saveVideos(
      videos
    );

  } catch (err) {

    console.error(
      '❌ Error monitor videos',
      err
    );

  }

};