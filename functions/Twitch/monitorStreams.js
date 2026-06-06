const fs = require('fs');
const path = require('path');

const checkStreamer =
  require('./checkStreamer');

const twitchLiveEmbed =
  require('../Embeds/twitchLiveEmbed');

const {
  sendBrandedMessage
} = require('../../utils/webhookSender');

const {
  getAllGuilds
} = require('../../utils/guildManager');

const statusPath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'twitch',
  'status.json'
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
      '⚠️ status.json corrupto, restaurando...'
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

    const status =
      loadStatus();

    const guilds =
      getAllGuilds();

    if (!guilds.length) {

      console.log(
        '⚠️ No hay servidores configurados.'
      );

      return;

    }

    for (const guildConfig of guilds) {

      try {

        const {
          guildId,
          twitch
        } = guildConfig;

        if (!twitch) {

          continue;

        }

        if (
          !twitch.liveChannel
        ) {

          continue;

        }

        if (
          !Array.isArray(
            twitch.users
          ) ||
          !twitch.users.length
        ) {

          continue;

        }

        const channel =
          await client.channels.fetch(
            twitch.liveChannel
          ).catch(() => null);

        if (!channel) {

          console.log(
            `⚠️ Canal Twitch inválido (${guildId})`
          );

          continue;

        }

        console.log(
          `📺 [${guildId}] Revisando ${twitch.users.length} streamers...`
        );

        for (const streamer of twitch.users) {

          try {

            const data =
              await checkStreamer(
                streamer
              );

            if (!data) {

              console.log(
                `❌ Error consultando ${streamer}`
              );

              continue;

            }

            if (!data.exists) {

              console.log(
                `⚠️ ${streamer} no existe`
              );

              continue;

            }

            const statusKey =
              `${guildId}_${streamer}`;

            const wasOnline =
              status[statusKey] || false;

            console.log(

              `[${guildId}] ${streamer}: ${
                data.online
                  ? 'ONLINE'
                  : 'OFFLINE'
              }`

            );

            // =========================
            // OFFLINE -> ONLINE
            // =========================

            if (
              data.online &&
              !wasOnline
            ) {

              console.log(
                `🔴 ${streamer} inició directo (${guildId})`
              );

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
            // ACTUALIZAR ESTADO
            // =========================

            status[statusKey] =
              data.online;

          }

          catch (error) {

            console.error(
              `❌ Error procesando ${streamer}`
            );

            console.error(
              error
            );

          }

        }

      }

      catch (guildError) {

        console.error(
          `❌ Error procesando servidor ${guildConfig.guildId}`
        );

        console.error(
          guildError
        );

      }

    }

    saveStatus(
      status
    );

  }

  catch (error) {

    console.error(
      '❌ Error monitor Twitch'
    );

    console.error(
      error
    );

  }

};
