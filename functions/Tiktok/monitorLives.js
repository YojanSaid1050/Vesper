const fs = require('fs');
const path = require('path');

const checkLiveUsers = require('./checkLiveUsers');
const tiktokLiveEmbed = require('../Embeds/tiktokLiveEmbed');

const { sendBrandedMessage } = require('../../utils/webhookSender');
const { getAllGuildConfigs } = require('../../utils/guildManager');

const statusPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'tiktok',
  'liveStatus.json'
);

// =========================
// SAFE LOAD
// =========================
function loadStatus() {
  try {
    if (!fs.existsSync(statusPath)) return {};

    const raw = fs.readFileSync(
      statusPath,
      'utf8'
    );

    return raw.trim()
      ? JSON.parse(raw)
      : {};

  } catch {

    console.error(
      '⚠️ liveStatus.json corrupto, restaurando...'
    );

    return {};
  }
}

// =========================
// SAFE SAVE
// =========================
function saveStatus(status) {
  try {

    const tmp =
      statusPath + '.tmp';

    fs.writeFileSync(
      tmp,
      JSON.stringify(
        status,
        null,
        2
      ),
      'utf8'
    );

    fs.renameSync(
      tmp,
      statusPath
    );

  } catch (err) {

    console.error(
      '❌ Error guardando liveStatus.json',
      err
    );

  }
}

// =========================
// NORMALIZE
// =========================
function norm(user) {

  return (
    user || ''
  )
    .toLowerCase()
    .replace('@', '')
    .trim();

}

// =========================
// CLEAN GUILD STATUS
// =========================
function cleanGuildStatus(
  guildStatus,
  validUsers
) {

  const validSet =
    new Set(
      validUsers.map(norm)
    );

  for (
    const savedUser of Object.keys(
      guildStatus
    )
  ) {

    if (
      !validSet.has(
        norm(savedUser)
      )
    ) {

      console.log(
        `🧹 Eliminando estado antiguo: ${savedUser}`
      );

      delete guildStatus[
        savedUser
      ];

    }

  }

  return guildStatus;

}

// =========================
// MONITOR
// =========================
module.exports = async (client) => {

  try {

    const liveStatus =
      loadStatus();

    const guilds =
      getAllGuildConfigs();

    if (
      !guilds ||
      Object.keys(guilds).length === 0
    ) {

      console.log(
        '⚠️ No hay servidores configurados.'
      );

      return;

    }

    for (
      const [guildId, config]
      of Object.entries(guilds)
    ) {

      try {

        const usersConfig =
          (config.tiktok?.users || [])
            .map(norm);

        const liveChannelId =
          config.tiktok?.liveChannel;

        // =========================
        // NO USERS -> DELETE CACHE
        // =========================
        if (
          usersConfig.length === 0
        ) {

          if (
            liveStatus[guildId]
          ) {

            console.log(
              `🧹 Eliminando estado TikTok completo de ${guildId}`
            );

            delete liveStatus[
              guildId
            ];

          }

          continue;

        }

        if (!liveChannelId) {
          continue;
        }

        const channel =
          await client.channels
            .fetch(
              liveChannelId
            )
            .catch(
              () => null
            );

        if (!channel) {

          console.log(
            `⚠️ Canal TikTok Live inválido (${guildId})`
          );

          continue;

        }

        if (
          !liveStatus[guildId]
        ) {

          liveStatus[guildId] = {};

        }

        const guildStatus =
          liveStatus[guildId];

        // =========================
        // CLEAN REMOVED USERS
        // =========================
        cleanGuildStatus(
          guildStatus,
          usersConfig
        );

        console.log(
          `🔴 [${guildId}] Revisando ${usersConfig.length} cuentas TikTok Live...`
        );

        const results =
          await checkLiveUsers(
            usersConfig
          );

        if (
          !Array.isArray(results)
        ) {
          continue;
        }

        for (
          const user of results
        ) {

          try {

            if (
              !user?.success
            ) {
              continue;
            }

            const username =
              norm(
                user.handle
              );

            if (!username) {
              continue;
            }

            const streamId =
              user.liveRoom?.streamId;

            const roomId =
              user.liveRoomUserInfo?.roomId ||
              user.liveRoom?.roomId;

            const statusCode =
              user.liveRoomUserInfo?.status;

            const isLive =
              Boolean(
                streamId &&
                roomId &&
                statusCode !== 4
              );

            const wasLive =
              Boolean(
                guildStatus[
                  username
                ]
              );

            console.log(
              `[${guildId}] ${username}: ${
                isLive
                  ? 'ONLINE'
                  : 'OFFLINE'
              }`
            );

            // =========================
            // LIVE START
            // =========================
            if (
              isLive &&
              !wasLive
            ) {

              await sendBrandedMessage(
                channel,
                tiktokLiveEmbed({
                  username,
                  nickname:
                    user.liveRoomUserInfo?.nickname ||
                    username,
                  viewers:
                    user.liveRoom?.liveRoomStats?.userCount ||
                    0,
                  title:
                    user.liveRoom?.title ||
                    'TikTok Live',
                  cover:
                    user.liveRoom?.coverUrl,
                  liveUrl:
                    `https://www.tiktok.com/@${username}/live`
                })
              );

            }

            // =========================
            // UPDATE STATUS
            // =========================
            guildStatus[
              username
            ] = isLive;

          } catch (errUser) {

            console.error(
              `❌ Error usuario ${user?.handle}`,
              errUser
            );

          }
        }

        // =========================
        // SAVE GUILD STATUS
        // =========================
        liveStatus[guildId] =
          guildStatus;

      } catch (errGuild) {

        console.error(
          `❌ Error guild ${guildId}`,
          errGuild
        );

      }
    }

    saveStatus(
      liveStatus
    );

  } catch (error) {

    console.error(
      '❌ Error monitor TikTok Lives',
      error
    );

  }
};