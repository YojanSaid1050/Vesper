const { getAllGuildConfigs } = require('../../database/mongoManager');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const CacheManager = require('../../core/CacheManager');
const { checkStreamers } = require('./checks');
const { liveEmbed } = require('./embeds');

const cache = new CacheManager('./data/twitch');

async function monitorStreams(client) {
  const streamStatus = cache.load('status', {});
  const guilds = await getAllGuildConfigs();

  for (const [guildId, config] of Object.entries(guilds)) {
    const twitchConfig = config.twitch || {};
    const users = twitchConfig.users || [];
    const liveChannelId = twitchConfig.liveChannel;

    if (users.length === 0 || !liveChannelId) continue;

    const channel = await client.channels.fetch(liveChannelId).catch(() => null);
    if (!channel) continue;

    if (!streamStatus[guildId]) {
      streamStatus[guildId] = {};
    }

    const guildStatus = streamStatus[guildId];
    
    const validUsersSet = new Set(users);
    for (const savedUser of Object.keys(guildStatus)) {
      if (!validUsersSet.has(savedUser)) {
        delete guildStatus[savedUser];
      }
    }

    const results = await checkStreamers(users);

    for (const streamer of results) {
      if (!streamer?.success) continue;

      const streamerLogin = streamer.login;
      const isLive = streamer.isLive === true;
      const wasLive = guildStatus[streamerLogin] === true;

      if (isLive && !wasLive) {
        await sendBrandedMessage(channel, liveEmbed({
          streamer: streamer.streamerName,
          title: streamer.title || 'Sin título',
          game: streamer.game || 'Sin categoría',
          viewers: streamer.viewers || 0,
          thumbnail: streamer.thumbnail,
          streamUrl: streamer.streamUrl || `https://twitch.tv/${streamerLogin}`
        }));
      }

      guildStatus[streamerLogin] = isLive;
    }

    streamStatus[guildId] = guildStatus;
  }

  cache.save('status', streamStatus);
}

module.exports = { monitorStreams };