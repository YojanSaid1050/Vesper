// src/platforms/twitch/monitors.js
const { getAllGuildConfigs, getGuildConfig } = require('../../database/mongoManager');
const { sendNotification, completeActiveLive } = require('../../core/NotificationService');
const PersistentStateStore = require('../../core/PersistentStateStore');
const { checkStreamers } = require('./checks');
const { twitchLive } = require('../messageFactory');
const { monitor, monitorError } = require('../../utils/logger');
const { isModuleEnabledConfig } = require('../../config/guildPolicy');

const stateStore = new PersistentStateStore('twitch');

const CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000,
  BATCH_SIZE: 10,
  ERROR_COOLDOWN: 60 * 1000,
  MAX_CONSECUTIVE_ERRORS: 5
};

const guildErrors = new Map();
let isRunning = false;

function shouldSkipGuild(guildId) {
  const errors = guildErrors.get(guildId);
  if (!errors) return false;
  const now = Date.now();
  if (errors.count >= CONFIG.MAX_CONSECUTIVE_ERRORS && now - errors.lastError < CONFIG.ERROR_COOLDOWN * 5) return true;
  return false;
}

function recordError(guildId, error) {
  const current = guildErrors.get(guildId) || { count: 0, lastError: 0, errors: [] };
  current.count++;
  current.lastError = Date.now();
  current.errors.push({ timestamp: current.lastError, message: error.message });
  if (current.errors.length > 10) current.errors.shift();
  guildErrors.set(guildId, current);
  monitorError('Twitch', 'Guild Error', guildId, error);
}

function resetErrors(guildId) {
  if (guildErrors.has(guildId)) guildErrors.delete(guildId);
}

async function withRetry(fn, context, maxRetries = CONFIG.MAX_RETRIES) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.warn(`⚠️ [Twitch] Retry ${i + 1}/${maxRetries} for ${context}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (i + 1)));
    }
  }
}

async function monitorStreams(client) {
  if (isRunning) {
    console.log('⚠️ [Twitch] Monitor already running, skipping...');
    return { success: false, reason: 'already_running' };
  }
  isRunning = true;
  
  try {
    console.log('🎮 [Twitch] Starting stream monitoring cycle...');
    const startTime = Date.now();
    
    const streamStatus = await stateStore.load('status', {});
    const guilds = await getAllGuildConfigs({ approvedOnly: true });
    
    let totalGuilds = 0, totalStreamers = 0, totalStreams = 0, totalErrors = 0;
    const guildEntries = Object.entries(guilds);
    const batchSize = 5;
    
    for (let i = 0; i < guildEntries.length; i += batchSize) {
      const batch = guildEntries.slice(i, i + batchSize);
      const promises = batch.map(async ([guildId, config]) => {
        try {
          const result = await processGuildStreams(guildId, config, client, streamStatus);
          if (result) {
            totalGuilds += result.guilds || 0;
            totalStreamers += result.streamers || 0;
            totalStreams += result.streams || 0;
          }
        } catch (error) {
          totalErrors++;
          monitorError('Twitch', 'Monitor Streams Process', guildId, error);
        }
      });
      await Promise.all(promises);
      if (i + batchSize < guildEntries.length) await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await stateStore.save('status', streamStatus);
    
    const duration = Date.now() - startTime;
    monitor('Twitch', 'Stream Monitoring Complete', null, {
      guilds: totalGuilds, streamers: totalStreamers, streams: totalStreams, errors: totalErrors, duration: `${duration}ms`
    });
    
    return { success: !(totalErrors > 0 && totalGuilds === 0), guilds: totalGuilds, streamers: totalStreamers, streams: totalStreams, errors: totalErrors, duration };
  } catch (error) {
    monitorError('Twitch', 'Stream Monitor Fatal', null, error);
    return { success: false, error: error.message };
  } finally {
    isRunning = false;
  }
}

async function processGuildStreams(guildId, config, client, streamStatus) {
  if (!isModuleEnabledConfig(config, 'twitch')) return null;
  const twitchConfig = config.twitch || {};
  const users = twitchConfig.users || [];
  const liveChannelId = twitchConfig.liveChannel;
  const pingRole = twitchConfig.pingRole || null;

  if (users.length === 0 || !liveChannelId) return null;
  if (shouldSkipGuild(guildId)) {
    console.log(`⏸️ [Twitch] Guild ${guildId} in error cooldown`);
    return null;
  }

  try {
    const channel = await withRetry(() => client.channels.fetch(liveChannelId), `Fetch channel ${liveChannelId}`).catch(() => null);
    if (!channel) {
      throw new Error(`Channel ${liveChannelId} not found`);
    }

    // Un ID mal configurado puede devolver un canal sin servidor (por ejemplo
    // un DM). Sin esta comprobación, el ciclo entero del monitor se caía.
    const botMember = channel.guild?.members?.me;
    if (!botMember) {
      throw new Error(`El canal ${channel.id} no pertenece a un servidor`);
    }
    const permissions = channel.permissionsFor(botMember);
    if (!permissions?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
      throw new Error('Missing permissions');
    }

    if (!streamStatus[guildId]) streamStatus[guildId] = {};
    const guildStatus = streamStatus[guildId];
    
    // Limpiar usuarios que ya no están en la lista
    const validUsersSet = new Set(users);
    for (const savedUser of Object.keys(guildStatus)) {
      if (!validUsersSet.has(savedUser)) {
        console.log(`[Twitch] Eliminando usuario obsoleto: ${savedUser}`);
        delete guildStatus[savedUser];
      }
    }

    const results = await withRetry(() => checkStreamers(users), `Check streams for guild ${guildId}`);
    
    if (!results || results.length === 0) {
      console.log(`[Twitch] No hay resultados de checkStreamers, manteniendo caché existente`);
      if (Object.keys(guildStatus).length > 0) {
        streamStatus[guildId] = guildStatus;
      }
      return null;
    }

    let newStreams = 0;
    let hasChanges = false;
    
    const pingText = pingRole ? `<@&${pingRole}>\n\n` : '';

    for (const streamer of results) {
      if (!streamer?.success) {
        console.log(`[Twitch] Streamer sin éxito: ${streamer?.login || 'unknown'}, conservando datos previos`);
        continue;
      }
      
      const streamerLogin = streamer.login;
      const isLive = streamer.isLive === true;
      const wasLive = guildStatus[streamerLogin] === true;

      if (isLive && !wasLive) {
        console.log(`🔴 [Twitch] ${streamerLogin} started streaming in guild ${guildId}`);
        monitor('Twitch', 'Stream Started', guildId, {
          streamer: streamerLogin, viewers: streamer.viewers || 0, game: streamer.game || 'Unknown'
        });
        
        try {
          const embed = await twitchLive(guildId, {
            streamer: streamer.streamerName,
            title: streamer.title || 'Sin título',
            game: streamer.game || 'Sin categoría',
            viewers: streamer.viewers || 0,
            thumbnail: streamer.thumbnail,
            streamUrl: streamer.streamUrl || `https://twitch.tv/${streamerLogin}`,
            pingText: pingText
          });
          
          if (embed) {
            const delivery = await sendNotification(channel, embed, {
              guildId,
              platform: 'twitch',
              account: streamerLogin,
              eventType: 'live_started',
              eventId: streamer.streamId || streamer.startedAt
            });
            if (delivery.sent || (delivery.duplicate && ['sent', 'ended'].includes(delivery.event?.status))) {
              if (delivery.sent) newStreams++;
              guildStatus[streamerLogin] = true;
              hasChanges = true;
            }
          }
        } catch (error) {
          monitorError('Twitch', 'Send Stream Message', guildId, error, { streamer: streamerLogin });
        }
      } else {
        if (!isLive && wasLive) {
          await completeActiveLive(channel, {
            guildId,
            platform: 'twitch',
            account: streamerLogin
          }).catch(error => monitorError('Twitch', 'Complete Stream Message', guildId, error, { streamer: streamerLogin }));
        }
        // Actualizar estado aunque no haya cambio
        if (guildStatus[streamerLogin] !== isLive) {
          guildStatus[streamerLogin] = isLive;
          hasChanges = true;
        }
      }
    }

    if (hasChanges || Object.keys(guildStatus).length > 0) {
      streamStatus[guildId] = guildStatus;
      console.log(`[Twitch] guildStatus guardado: ${Object.keys(guildStatus).length} streamers`);
    }
    
    resetErrors(guildId);
    
    return { guilds: 1, streamers: users.length, streams: newStreams };
  } catch (error) {
    monitorError('Twitch', 'Process Guild Streams', guildId, error);
    recordError(guildId, error);
    throw error;
  }
}

async function clearGuildCache(guildId) {
  const streamStatus = await stateStore.load('status', {});
  delete streamStatus[guildId];
  await stateStore.save('status', streamStatus);
  monitor('Twitch', 'Cache Cleared', guildId, { action: 'Manual cache clear' });
}

async function clearUserState(guildId, username) {
  const streamStatus = await stateStore.load('status', {});
  if (streamStatus[guildId]) {
    delete streamStatus[guildId][String(username).toLowerCase()];
    if (Object.keys(streamStatus[guildId]).length === 0) delete streamStatus[guildId];
  }
  await stateStore.save('status', streamStatus);
}

async function getMonitorStats() {
  const streamStatus = await stateStore.load('status', {});
  let totalStreamEntries = 0;
  for (const guild of Object.values(streamStatus)) totalStreamEntries += Object.keys(guild).length;
  
  return {
    guilds: Object.keys(streamStatus).length,
    entries: totalStreamEntries,
    errors: Array.from(guildErrors.entries()).map(([key, data]) => ({
      guildId: key, count: data.count, lastError: new Date(data.lastError).toISOString()
    }))
  };
}

module.exports = { monitorStreams, clearGuildCache, clearUserState, getMonitorStats };
