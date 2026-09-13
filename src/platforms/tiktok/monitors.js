const { getAllGuildConfigs } = require('../../database/mongoManager');
const { sendNotification, completeActiveLive } = require('../../core/NotificationService');
const PersistentStateStore = require('../../core/PersistentStateStore');
const { checkLiveUsers, checkUsers, getCacheStats } = require('./checks');
const { tiktokLive, tiktokVideo } = require('../messageFactory');
const { monitor, monitorError } = require('../../utils/logger');
const { normalizeUsername } = require('./utils');
const { isModuleEnabledConfig } = require('../../config/guildPolicy');

const stateStore = new PersistentStateStore('tiktok');
const runningMonitors = new Set();
const guildErrors = new Map();

function uniqueUsernames(users = []) {
  return [...new Set(users.map(normalizeUsername).filter(Boolean))].sort();
}

function recordError(guildId, kind, error) {
  const key = `${guildId}_${kind}`;
  const current = guildErrors.get(key) || { count: 0, lastError: 0, message: null };
  current.count++;
  current.lastError = Date.now();
  current.message = error.message;
  guildErrors.set(key, current);
  monitorError('TikTok', kind, guildId, error);
}

function resetErrors(guildId, kind) {
  guildErrors.delete(`${guildId}_${kind}`);
}

function collectEligibleGuilds(guilds, kind) {
  const channelKey = kind === 'live' ? 'liveChannel' : 'videoChannel';
  const eligible = [];
  for (const [guildId, config] of Object.entries(guilds)) {
    if (!isModuleEnabledConfig(config, 'tiktok')) continue;
    const tiktok = config.tiktok || {};
    const users = uniqueUsernames(tiktok.users || []);
    if (users.length === 0 || !tiktok[channelKey]) continue;
    eligible.push({
      guildId,
      users,
      channelId: tiktok[channelKey],
      pingRole: tiktok.pingRole || null
    });
  }
  return eligible;
}

async function resolveChannel(client, guildData, kind) {
  const channel = await client.channels.fetch(guildData.channelId).catch(() => null);
  if (!channel) throw new Error(`Canal ${guildData.channelId} no encontrado`);

  const botMember = channel.guild?.members?.me;
  if (!botMember) return false;
  const permissions = channel.permissionsFor(botMember);
  if (!permissions?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
    throw new Error('Faltan permisos ViewChannel, SendMessages o EmbedLinks');
  }
  resetErrors(guildData.guildId, kind);
  return channel;
}

function pruneGuildState(state, guildId, users) {
  const guildState = state[guildId] || {};
  const allowed = new Set(users);
  for (const username of Object.keys(guildState)) {
    if (!allowed.has(username)) delete guildState[username];
  }
  state[guildId] = guildState;
  return guildState;
}

async function monitorLives(client) {
  if (runningMonitors.has('lives')) return { success: false, reason: 'already_running' };
  runningMonitors.add('lives');

  try {
    const startedAt = Date.now();
    const guilds = await getAllGuildConfigs({ approvedOnly: true });
    const eligible = collectEligibleGuilds(guilds, 'live');
    if (eligible.length === 0) {
      return { success: true, guilds: 0, users: 0, lives: 0, requests: 0, skipped: 'not_configured' };
    }

    const usernames = uniqueUsernames(eligible.flatMap(guild => guild.users));
    const results = await checkLiveUsers(usernames);
    const byUsername = new Map(results.map(result => [normalizeUsername(result.username), result]));
    const liveStatus = await stateStore.load('liveStatus', {});

    let newLives = 0;
    let errors = 0;
    for (const guildData of eligible) {
      let channel;
      try {
        channel = await resolveChannel(client, guildData, 'lives');
      } catch (error) {
        errors++;
        recordError(guildData.guildId, 'lives', error);
        continue;
      }

      const guildStatus = pruneGuildState(liveStatus, guildData.guildId, guildData.users);
      const pingText = guildData.pingRole ? `<@&${guildData.pingRole}>\n\n` : '';

      for (const username of guildData.users) {
        const result = byUsername.get(username);
        if (!result?.success) continue;
        const wasLive = guildStatus[username] === true;

        if (result.isLive && !wasLive) {
          const payload = tiktokLive(guildData.guildId, {
            username,
            nickname: result.nickname,
            viewers: result.viewers,
            title: result.title,
            cover: result.cover,
            liveUrl: result.liveUrl,
            pingText
          });

          if (!payload) continue;
          try {
            const delivery = await sendNotification(channel, payload, {
              guildId: guildData.guildId,
              platform: 'tiktok',
              account: username,
              eventType: 'live_started',
              eventId: result.roomId || result.liveUrl
            });
            const delivered = delivery.sent || (delivery.duplicate && ['sent', 'ended'].includes(delivery.event?.status));
            if (!delivered) throw delivery.error || new Error('No se pudo enviar la alerta');
            guildStatus[username] = true;
            if (delivery.sent) newLives++;
            monitor('TikTok', 'Live Started', guildData.guildId, { username, viewers: result.viewers });
          } catch (error) {
            errors++;
            recordError(guildData.guildId, 'send_live', error);
          }
        } else if (!result.isLive) {
          if (wasLive) {
            await completeActiveLive(channel, {
              guildId: guildData.guildId,
              platform: 'tiktok',
              account: username
            }).catch(error => recordError(guildData.guildId, 'complete_live', error));
          }
          guildStatus[username] = false;
        }
      }
    }

    await stateStore.save('liveStatus', liveStatus);
    const duration = Date.now() - startedAt;
    monitor('TikTok', 'Live Monitoring Complete', null, {
      guilds: eligible.length,
      uniqueUsers: usernames.length,
      configuredUsers: eligible.reduce((total, guild) => total + guild.users.length, 0),
      lives: newLives,
      errors,
      requests: usernames.length,
      duration: `${duration}ms`
    });

    return {
      success: !(errors > 0 && errors >= eligible.length),
      guilds: eligible.length,
      users: usernames.length,
      lives: newLives,
      errors,
      requests: usernames.length,
      duration
    };
  } catch (error) {
    monitorError('TikTok', 'Live Monitor Fatal', null, error);
    throw error;
  } finally {
    runningMonitors.delete('lives');
  }
}

async function monitorVideos(client) {
  if (runningMonitors.has('videos')) return { success: false, reason: 'already_running' };
  runningMonitors.add('videos');

  try {
    const startedAt = Date.now();
    const guilds = await getAllGuildConfigs({ approvedOnly: true });
    const eligible = collectEligibleGuilds(guilds, 'video');
    if (eligible.length === 0) {
      return { success: true, guilds: 0, users: 0, videos: 0, requests: 0, skipped: 'not_configured' };
    }

    const usernames = uniqueUsernames(eligible.flatMap(guild => guild.users));
    const results = await checkUsers(usernames);
    const byUsername = new Map(
      results.filter(result => result.exists).map(result => [normalizeUsername(result.username), result])
    );
    const videoState = await stateStore.load('videos', {});

    let newVideos = 0;
    let errors = 0;
    for (const guildData of eligible) {
      let channel;
      try {
        channel = await resolveChannel(client, guildData, 'videos');
      } catch (error) {
        errors++;
        recordError(guildData.guildId, 'videos', error);
        continue;
      }

      const guildVideos = pruneGuildState(videoState, guildData.guildId, guildData.users);
      const pingText = guildData.pingRole ? `<@&${guildData.pingRole}>\n\n` : '';

      for (const username of guildData.users) {
        const result = byUsername.get(username);
        if (!result?.latestVideoId) continue;

        const previousId = guildVideos[username];
        if (!previousId) {
          guildVideos[username] = result.latestVideoId;
          continue;
        }
        if (previousId === result.latestVideoId) continue;

        const payload = tiktokVideo(guildData.guildId, {
          username,
          nickname: result.nickname,
          description: result.latestVideoTitle,
          thumbnail: result.latestVideoThumbnail,
          url: result.latestVideoUrl,
          playCount: result.latestVideoPlayCount,
          commentCount: result.latestVideoCommentCount,
          pingText
        });
        if (!payload) continue;

        try {
          const delivery = await sendNotification(channel, payload, {
            guildId: guildData.guildId,
            platform: 'tiktok',
            account: username,
            eventType: 'video_published',
            eventId: result.latestVideoId
          });
          const delivered = delivery.sent || (delivery.duplicate && ['sent', 'ended'].includes(delivery.event?.status));
          if (!delivered) throw delivery.error || new Error('No se pudo enviar la alerta');
          guildVideos[username] = result.latestVideoId;
          if (delivery.sent) newVideos++;
          monitor('TikTok', 'New Video', guildData.guildId, {
            username,
            views: result.latestVideoPlayCount || 0
          });
        } catch (error) {
          errors++;
          recordError(guildData.guildId, 'send_video', error);
        }
      }
    }

    await stateStore.save('videos', videoState);
    const duration = Date.now() - startedAt;
    monitor('TikTok', 'Video Monitoring Complete', null, {
      guilds: eligible.length,
      uniqueUsers: usernames.length,
      configuredUsers: eligible.reduce((total, guild) => total + guild.users.length, 0),
      videos: newVideos,
      errors,
      requests: usernames.length,
      duration: `${duration}ms`
    });

    return {
      success: !(errors > 0 && errors >= eligible.length),
      guilds: eligible.length,
      users: usernames.length,
      videos: newVideos,
      errors,
      requests: usernames.length,
      duration
    };
  } catch (error) {
    monitorError('TikTok', 'Video Monitor Fatal', null, error);
    throw error;
  } finally {
    runningMonitors.delete('videos');
  }
}

async function clearGuildCache(guildId) {
  const liveStatus = await stateStore.load('liveStatus', {});
  const videos = await stateStore.load('videos', {});
  delete liveStatus[guildId];
  delete videos[guildId];
  await stateStore.save('liveStatus', liveStatus);
  await stateStore.save('videos', videos);
  monitor('TikTok', 'Cache Cleared', guildId, { action: 'Manual cache clear' });
}

async function clearUserState(guildId, username) {
  const normalized = normalizeUsername(username);
  const liveStatus = await stateStore.load('liveStatus', {});
  const videos = await stateStore.load('videos', {});
  if (liveStatus[guildId]) delete liveStatus[guildId][normalized];
  if (videos[guildId]) delete videos[guildId][normalized];
  await stateStore.save('liveStatus', liveStatus);
  await stateStore.save('videos', videos);
}

async function getMonitorStats() {
  const liveStatus = await stateStore.load('liveStatus', {});
  const videos = await stateStore.load('videos', {});
  const cache = await getCacheStats();
  return {
    guilds: { live: Object.keys(liveStatus).length, videos: Object.keys(videos).length },
    entries: {
      live: Object.values(liveStatus).reduce((total, guild) => total + Object.keys(guild).length, 0),
      videos: Object.values(videos).reduce((total, guild) => total + Object.keys(guild).length, 0)
    },
    provider: cache.provider,
    errors: [...guildErrors.entries()].map(([key, data]) => ({
      key,
      count: data.count,
      message: data.message,
      lastError: new Date(data.lastError).toISOString()
    }))
  };
}

module.exports = { monitorLives, monitorVideos, clearGuildCache, clearUserState, getMonitorStats };
