const { getAllGuildConfigs } = require('../../database/mongoManager');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const CacheManager = require('../../core/CacheManager');
const { checkLiveUsers, checkVideos, checkShorts } = require('./checks');
const { liveEmbed, videoEmbed, shortEmbed } = require('./embeds');

const cache = new CacheManager('./data/youtube');

async function monitorLives(client) {
  const liveStatus = cache.load('liveStatus', {});
  const guilds = await getAllGuildConfigs();

  for (const [guildId, config] of Object.entries(guilds)) {
    const youtubeConfig = config.youtube || {};
    const users = youtubeConfig.users || [];
    const liveChannelId = youtubeConfig.liveChannel;

    if (users.length === 0 || !liveChannelId) continue;

    const channel = await client.channels.fetch(liveChannelId).catch(() => null);
    if (!channel) continue;

    if (!liveStatus[guildId]) liveStatus[guildId] = {};

    const guildStatus = liveStatus[guildId];
    
    const validUsersSet = new Set(users);
    for (const savedUser of Object.keys(guildStatus)) {
      if (!validUsersSet.has(savedUser)) delete guildStatus[savedUser];
    }

    const results = await checkLiveUsers(users);

    for (const user of results) {
      if (!user?.success) continue;

      const channelId = user.channelId;
      const isLive = user.isLive === true;
      const wasLive = guildStatus[channelId] === true;

      if (isLive && !wasLive) {
        await sendBrandedMessage(channel, liveEmbed({
          channelName: user.channelName,
          handle: user.handle,
          title: user.title,
          viewers: user.viewers,
          thumbnail: user.thumbnail,
          liveUrl: user.liveUrl
        }));
      }

      guildStatus[channelId] = isLive;
    }

    liveStatus[guildId] = guildStatus;
  }

  cache.save('liveStatus', liveStatus);
}

async function monitorVideos(client) {
  const videos = cache.load('videos', {});
  const guilds = await getAllGuildConfigs();

  for (const [guildId, config] of Object.entries(guilds)) {
    const youtubeConfig = config.youtube || {};
    const users = youtubeConfig.users || [];
    const videoChannelId = youtubeConfig.videoChannel;

    if (users.length === 0 || !videoChannelId) continue;

    const channel = await client.channels.fetch(videoChannelId).catch(() => null);
    if (!channel) continue;

    const guildVideos = videos[guildId] || {};
    
    const validUsersSet = new Set(users);
    for (const savedUser of Object.keys(guildVideos)) {
      if (!validUsersSet.has(savedUser)) delete guildVideos[savedUser];
    }

    const results = await checkVideos(users);

    for (const user of results) {
      if (!user?.success) continue;

      const channelId = user.channelId;
      const lastVideoId = guildVideos[channelId];
      const latestVideo = user.latestVideo;

      if (!latestVideo) continue;

      if (!lastVideoId) {
        guildVideos[channelId] = latestVideo.videoId;
        continue;
      }

      if (lastVideoId !== latestVideo.videoId) {
        await sendBrandedMessage(channel, videoEmbed(
          { channelName: user.channelName, handle: user.handle },
          latestVideo
        ));
        guildVideos[channelId] = latestVideo.videoId;
      }
    }

    if (Object.keys(guildVideos).length === 0) {
      delete videos[guildId];
    } else {
      videos[guildId] = guildVideos;
    }
  }

  cache.save('videos', videos);
}

async function monitorShorts(client) {
  const shorts = cache.load('shorts', {});
  const guilds = await getAllGuildConfigs();

  for (const [guildId, config] of Object.entries(guilds)) {
    const youtubeConfig = config.youtube || {};
    const users = youtubeConfig.users || [];
    const shortChannelId = youtubeConfig.shortChannel;

    if (users.length === 0 || !shortChannelId) continue;

    const channel = await client.channels.fetch(shortChannelId).catch(() => null);
    if (!channel) continue;

    const guildShorts = shorts[guildId] || {};
    
    const validUsersSet = new Set(users);
    for (const savedUser of Object.keys(guildShorts)) {
      if (!validUsersSet.has(savedUser)) delete guildShorts[savedUser];
    }

    const results = await checkShorts(users);

    for (const user of results) {
      if (!user?.success) continue;

      const channelId = user.channelId;
      const lastShortId = guildShorts[channelId];
      const latestShort = user.latestShort;

      if (!latestShort) continue;

      if (!lastShortId) {
        guildShorts[channelId] = latestShort.videoId;
        continue;
      }

      if (lastShortId !== latestShort.videoId) {
        await sendBrandedMessage(channel, shortEmbed(
          { channelName: user.channelName, handle: user.handle },
          latestShort
        ));
        guildShorts[channelId] = latestShort.videoId;
      }
    }

    if (Object.keys(guildShorts).length === 0) {
      delete shorts[guildId];
    } else {
      shorts[guildId] = guildShorts;
    }
  }

  cache.save('shorts', shorts);
}

module.exports = { monitorLives, monitorVideos, monitorShorts };