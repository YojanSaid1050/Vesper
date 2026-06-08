const { getAllGuildConfigs } = require('../../database/mongoManager');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const CacheManager = require('../../core/CacheManager');
const { checkLiveUsers, checkUsers } = require('./checks');
const { liveEmbed, videoEmbed } = require('./embeds');

const cache = new CacheManager('./data/tiktok');

function normalize(username) {
  return (username || '').toLowerCase().replace('@', '').trim();
}

async function monitorLives(client) {
  const liveStatus = cache.load('liveStatus', {});
  const guilds = await getAllGuildConfigs();

  for (const [guildId, config] of Object.entries(guilds)) {
    const tiktokConfig = config.tiktok || {};
    const users = tiktokConfig.users || [];
    const liveChannelId = tiktokConfig.liveChannel;

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

      const username = normalize(user.handle);
      const isLive = Boolean(user.liveRoom?.streamId && user.liveRoomUserInfo?.status !== 4);
      const wasLive = guildStatus[username] === true;

      if (isLive && !wasLive) {
        await sendBrandedMessage(channel, liveEmbed({
          username: username,
          nickname: user.liveRoomUserInfo?.nickname || username,
          viewers: user.liveRoom?.liveRoomStats?.userCount || 0,
          title: user.liveRoom?.title || 'TikTok Live',
          cover: user.liveRoom?.coverUrl,
          liveUrl: `https://www.tiktok.com/@${username}/live`
        }));
      }

      guildStatus[username] = isLive;
    }

    liveStatus[guildId] = guildStatus;
  }

  cache.save('liveStatus', liveStatus);
}

async function monitorVideos(client) {
  const videos = cache.load('videos', {});
  const guilds = await getAllGuildConfigs();

  for (const [guildId, config] of Object.entries(guilds)) {
    const tiktokConfig = config.tiktok || {};
    const users = tiktokConfig.users || [];
    const videoChannelId = tiktokConfig.videoChannel;

    if (users.length === 0 || !videoChannelId) continue;

    const channel = await client.channels.fetch(videoChannelId).catch(() => null);
    if (!channel) continue;

    const guildVideos = videos[guildId] || {};
    
    const validUsersSet = new Set(users);
    for (const savedUser of Object.keys(guildVideos)) {
      if (!validUsersSet.has(savedUser)) delete guildVideos[savedUser];
    }

    const items = await checkUsers(users);

    for (const item of items) {
      const username = normalize(item?.authorMeta?.name);
      if (!username) continue;

      const videoId = item?.id?.toString();
      if (!videoId) continue;

      const lastVideo = guildVideos[username];

      if (!lastVideo) {
        guildVideos[username] = videoId;
        continue;
      }

      if (lastVideo !== videoId) {
        await sendBrandedMessage(channel, videoEmbed({
          username: username,
          nickname: item?.authorMeta?.nickName,
          description: item?.text,
          thumbnail: item?.videoMeta?.coverUrl,
          url: item?.webVideoUrl,
          playCount: item?.playCount,
          commentCount: item?.commentCount
        }));
        guildVideos[username] = videoId;
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

module.exports = { monitorLives, monitorVideos };