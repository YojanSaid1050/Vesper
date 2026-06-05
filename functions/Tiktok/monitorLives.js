const fs = require('fs');
const path = require('path');

const checkLiveUsers =
  require('./checkLiveUsers');

const tiktokLiveEmbed =
  require('../Embeds/tiktokLiveEmbed');

const configPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'tiktok',
  'config.json'
);

const statusPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'tiktok',
  'liveStatus.json'
);

module.exports = async (client) => {

  try {

    const config = JSON.parse(
      fs.readFileSync(
        configPath,
        'utf8'
      )
    );

    if (!config.liveChannel) {

      console.log(
        '⚠️ No hay canal de lives configurado.'
      );

      return;

    }

    if (
      !Array.isArray(config.users) ||
      !config.users.length
    ) {

      console.log(
        '⚠️ No hay usuarios TikTok configurados.'
      );

      return;

    }

    const channel =
      await client.channels.fetch(
        config.liveChannel
      );

    if (!channel) {

      console.log(
        '❌ Canal TikTok Live no encontrado.'
      );

      return;

    }

    let liveStatus = {};

    try {

      if (
        fs.existsSync(statusPath)
      ) {

        liveStatus = JSON.parse(
          fs.readFileSync(
            statusPath,
            'utf8'
          )
        );

      }

    } catch {

      liveStatus = {};

    }

    console.log(
      `🔴 Revisando ${config.users.length} cuentas TikTok Live...`
    );

    const users =
      await checkLiveUsers(
        config.users
      );

    for (const user of users) {

      try {

        if (!user?.success)
          continue;

        const username =
          user.handle?.toLowerCase();

        if (!username)
          continue;

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
          liveStatus[username] || false;

        console.log({
          username,
          streamId,
          roomId,
          status,
          wasLive,
          isLive
        });

        console.log(
          `${username}: ${
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
            `🔴 LIVE detectado: ${username}`
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

            await channel.send(

              tiktokLiveEmbed({

                username,

                nickname,

                viewers,

                title,

                cover,

                liveUrl

              })

            );

          } catch (sendError) {

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

        liveStatus[username] =
          isLive;

      } catch (error) {

        console.error(
          `❌ Error procesando usuario`
        );

        console.error(error);

      }

    }

    fs.writeFileSync(

      statusPath,

      JSON.stringify(
        liveStatus,
        null,
        2
      )

    );

  } catch (error) {

    console.error(
      '❌ Error monitor TikTok Lives'
    );

    console.error(error);

  }

};