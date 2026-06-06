const fs = require('fs');
const path = require('path');

const checkLiveUsers =
  require('./checkLiveUsers');

const tiktokLiveEmbed =
  require('../Embeds/tiktokLiveEmbed');

const {
  sendBrandedMessage
} = require('../../utils/webhookSender');

const {
  getAllGuildConfigs
} = require('../../utils/guildManager');

const statusPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'tiktok',
  'liveStatus.json'
);

// ==================================================
// CARGAR JSON SEGURO
// ==================================================

function loadStatus() {

  try {

    if (!fs.existsSync(statusPath)) {

      return {};

    }

    const raw =
      fs.readFileSync(
        statusPath,
        'utf8'
      );

    return raw.trim()
      ? JSON.parse(raw)
      : {};

  }

  catch {

    console.error(
      '⚠️ liveStatus.json corrupto, restaurando...'
    );

    return {};

  }

}

// ==================================================
// GUARDAR JSON SEGURO
// ==================================================

function saveStatus(status) {

  const tempPath =
    `${statusPath}.tmp`;

  fs.writeFileSync(

    tempPath,

    JSON.stringify(
      status,
      null,
      2
    )

  );

  fs.renameSync(
    tempPath,
    statusPath
  );

}

// ==================================================
// MONITOR
// ==================================================

module.exports = async (client) => {

  try {

    const liveStatus =
      loadStatus();

    const guilds =
      getAllGuildConfigs();

    for (const [guildId, config] of Object.entries(guilds)) {

      try {

        if (
          !config.tiktok?.liveChannel
        ) {

          continue;

        }

        if (
          !Array.isArray(
            config.tiktok?.users
          ) ||
          !config.tiktok.users.length
        ) {

          continue;

        }

        const channel =
          await client.channels.fetch(
            config.tiktok.liveChannel
          ).catch(() => null);

        if (!channel) {

          console.log(
            `⚠️ Canal TikTok Live inválido (${guildId})`
          );

          continue;

        }

        if (!liveStatus[guildId]) {

          liveStatus[guildId] = {};

        }

        const guildStatus =
          liveStatus[guildId];

        console.log(
          `🔴 [${guildId}] Revisando ${config.tiktok.users.length} cuentas TikTok Live...`
        );

        const users =
          await checkLiveUsers(
            config.tiktok.users
          );

        if (
          !Array.isArray(users)
        ) {

          continue;

        }

        for (const user of users) {

          try {

            if (
              !user?.success
            ) {

              continue;

            }

            const username =
              user.handle?.toLowerCase();

            if (!username) {

              continue;

            }

            const streamId =
              user.liveRoom?.streamId;

            const roomId =
              user.liveRoomUserInfo?.roomId ||
              user.liveRoom?.roomId;

            const status =
              user.liveRoomUserInfo?.status;

            const isLive =
              !!streamId &&
              !!roomId &&
              status !== 4;

            const wasLive =
              guildStatus[username] || false;

            console.log(

              `[${guildId}] ${username}: ${
                isLive
                  ? 'ONLINE'
                  : 'OFFLINE'
              }`

            );

            // =====================
            // OFFLINE -> ONLINE
            // =====================

            if (
              isLive &&
              !wasLive
            ) {

              console.log(
                `🔴 LIVE detectado: ${username} (${guildId})`
              );

              const nickname =
                user.liveRoomUserInfo
                  ?.nickname ||
                username;

              const viewers =
                user.liveRoom
                  ?.liveRoomStats
                  ?.userCount ||
                0;

              const title =
                user.liveRoom
                  ?.title ||
                'TikTok Live';

              const cover =
                user.liveRoom
                  ?.coverUrl;

              const liveUrl =
                `https://www.tiktok.com/@${username}/live`;

              try {

                await sendBrandedMessage(

                  channel,

                  tiktokLiveEmbed({

                    username,

                    nickname,

                    viewers,

                    title,

                    cover,

                    liveUrl

                  })

                );

              }

              catch (sendError) {

                console.error(
                  `❌ Error enviando alerta de ${username}`
                );

                console.error(
                  sendError
                );

              }

            }

            // =====================
            // ONLINE -> OFFLINE
            // =====================

            if (
              !isLive &&
              wasLive
            ) {

              console.log(
                `⚫ LIVE finalizado: ${username}`
              );

            }

            guildStatus[username] =
              isLive;

          }

          catch (error) {

            console.error(
              `❌ Error procesando ${user?.handle || 'usuario'}`
            );

            console.error(
              error
            );

          }

        }

        liveStatus[guildId] =
          guildStatus;

      }

      catch (guildError) {

        console.error(
          `❌ Error procesando servidor ${guildId}`
        );

        console.error(
          guildError
        );

      }

    }

    saveStatus(
      liveStatus
    );

  }

  catch (error) {

    console.error(
      '❌ Error monitor TikTok Lives'
    );

    console.error(
      error
    );

  }

};

