const fs = require('fs');
const path = require('path');

const checkStreamer = require('./checkStreamer');
const twitchLiveEmbed = require('../Embeds/twitchLiveEmbed');

const { sendBrandedMessage } = require('../../utils/webhookSender');
const { getAllGuilds } = require('../../utils/guildManager');

const statusPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'twitch',
  'status.json'
);

// =========================
// SAFE LOAD
// =========================
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

  } catch {

    console.error(
      '⚠️ status.json corrupto, restaurando...'
    );

    return {};

  }

}

// =========================
// SAFE SAVE
// =========================
function saveStatus(status) {

  try {

    fs.mkdirSync(
      path.dirname(statusPath),
      { recursive: true }
    );

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
      '❌ Error guardando status.json',
      err
    );

  }

}

// =========================
// NORMALIZE
// =========================
function normalize(username) {

  return (
    username || ''
  )
    .toLowerCase()
    .replace('@', '')
    .trim();

}

// =========================
// CLEAN GUILD STATUS
// =========================
function cleanGuildStatus(
  status,
  guildId,
  validUsers
) {

  const validSet =
    new Set(
      validUsers.map(
        normalize
      )
    );

  for (
    const key of Object.keys(
      status
    )
  ) {

    if (
      !key.startsWith(
        `${guildId}_`
      )
    ) {
      continue;
    }

    const username =
      normalize(
        key.substring(
          guildId.length + 1
        )
      );

    if (
      !validSet.has(
        username
      )
    ) {

      console.log(
        `🧹 Eliminando estado Twitch: ${username}`
      );

      delete status[key];

    }

  }

}

// =========================
// MONITOR
// =========================
module.exports = async (client) => {

  try {

    const status =
      loadStatus();

    const guilds =
      getAllGuilds();

    if (!guilds.length) {
      return;
    }

    for (
      const guildConfig of guilds
    ) {

      try {

        const {
          guildId,
          twitch
        } = guildConfig;

        const users =
          (twitch?.users || [])
            .map(
              normalize
            );

        const liveChannel =
          twitch?.liveChannel;

        // =========================
        // NO USERS -> DELETE CACHE
        // =========================
        if (
          users.length === 0
        ) {

          let removed =
            false;

          for (
            const key of Object.keys(
              status
            )
          ) {

            if (
              key.startsWith(
                `${guildId}_`
              )
            ) {

              delete status[
                key
              ];

              removed =
                true;

            }

          }

          if (removed) {

            console.log(
              `🧹 Eliminando historial Twitch de ${guildId}`
            );

          }

          continue;

        }

        if (!liveChannel) {

          console.log(
            `⚠️ Twitch sin canal configurado (${guildId})`
          );

          continue;

        }

        const channel =
          await client.channels
            .fetch(
              liveChannel
            )
            .catch(
              () => null
            );

        if (!channel) {

          console.log(
            `⚠️ Canal Twitch inválido (${guildId})`
          );

          continue;

        }

        // =========================
        // CLEAN REMOVED USERS
        // =========================
        cleanGuildStatus(
          status,
          guildId,
          users
        );

        console.log(
          `📺 [${guildId}] Revisando ${users.length} streamers`
        );

        // =========================
        // CHECK STREAMERS
        // =========================
        for (
          const streamer of users
        ) {

          try {

            const data =
              await checkStreamer(
                streamer
              );

            if (
              !data?.exists
            ) {
              continue;
            }

            const key =
              `${guildId}_${streamer}`;

            const wasOnline =
              status[key] === true;

            const isOnline =
              Boolean(
                data.online
              );

            console.log(
              `[${guildId}] ${streamer}: ${
                isOnline
                  ? 'ONLINE'
                  : 'OFFLINE'
              }`
            );

            // =========================
            // STREAM START
            // =========================
            if (
              isOnline &&
              !wasOnline
            ) {

              await sendBrandedMessage(
                channel,
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
                }),
                guildId
              );

            }

            // =========================
            // UPDATE STATUS
            // =========================
            status[key] =
              isOnline;

          } catch (errStreamer) {

            console.error(
              `❌ Error streamer ${streamer}`,
              errStreamer
            );

          }

        }

      } catch (errGuild) {

        console.error(
          `❌ Error guild ${guildConfig.guildId}`,
          errGuild
        );

      }

    }

    saveStatus(
      status
    );

  } catch (err) {

    console.error(
      '❌ Error monitor Twitch',
      err
    );

  }

};