// src/platforms/youtube/monitors.js
const { getAllGuildConfigs, getGuildConfig } = require('../../database/mongoManager');
const { sendNotification, completeActiveLive } = require('../../core/NotificationService');
const PersistentStateStore = require('../../core/PersistentStateStore');
const { checkLiveUsers, checkVideos, checkShorts, clearChannelCache } = require('./checks');
const { youtubeLive, youtubeVideo, youtubeShort } = require('../messageFactory');
const { monitor } = require('../../utils/logger');
const { isModuleEnabledConfig } = require('../../config/guildPolicy');

const stateStore = new PersistentStateStore('youtube');

const CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000,
  BATCH_SIZE: 10,
  ERROR_COOLDOWN: 60 * 1000,
  MAX_CONSECUTIVE_ERRORS: 5
};

const guildErrors = new Map();
const runningMonitors = new Set();

function shouldSkipGuild(guildId, type) {
  const errors = guildErrors.get(`${guildId}_${type}`);
  if (!errors) return false;
  const now = Date.now();
  if (errors.count >= CONFIG.MAX_CONSECUTIVE_ERRORS && now - errors.lastError < CONFIG.ERROR_COOLDOWN * 5) return true;
  return false;
}

function recordError(guildId, type, error) {
  const key = `${guildId}_${type}`;
  const current = guildErrors.get(key) || { count: 0, lastError: 0, errors: [] };
  current.count++;
  current.lastError = Date.now();
  const errorMsg = error?.message || String(error);
  current.errors.push({ timestamp: current.lastError, message: errorMsg });
  if (current.errors.length > 10) current.errors.shift();
  guildErrors.set(key, current);
  console.error(`[YouTube] Error en ${type} para guild ${guildId}:`, errorMsg);
}

function resetErrors(guildId, type) {
  const key = `${guildId}_${type}`;
  if (guildErrors.has(key)) guildErrors.delete(key);
}

async function withRetry(fn, context, maxRetries = CONFIG.MAX_RETRIES) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.warn(`⚠️ [YouTube] Retry ${i + 1}/${maxRetries} for ${context}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (i + 1)));
    }
  }
}

// ==================================================
// NUEVA FUNCIÓN: Limpiar caché de un canal específico en el almacenamiento persistente
// ==================================================
async function cleanYouTubeChannelCache(guildId, channelId) {
  // Limpiar liveStatus
  const liveStatus = await stateStore.load('liveStatus', {});
  if (liveStatus[guildId] && liveStatus[guildId][channelId] !== undefined) {
    delete liveStatus[guildId][channelId];
    // Si el objeto del guild queda vacío, eliminarlo
    if (Object.keys(liveStatus[guildId]).length === 0) {
      delete liveStatus[guildId];
    }
    await stateStore.save('liveStatus', liveStatus);
    console.log(`[YouTube] Cache de liveStatus eliminado para canal ${channelId} en guild ${guildId}`);
  }
  
  // Limpiar videos
  const videos = await stateStore.load('videos', {});
  if (videos[guildId] && videos[guildId][channelId] !== undefined) {
    delete videos[guildId][channelId];
    if (Object.keys(videos[guildId]).length === 0) {
      delete videos[guildId];
    }
    await stateStore.save('videos', videos);
    console.log(`[YouTube] Cache de videos eliminado para canal ${channelId} en guild ${guildId}`);
  }
  
  // Limpiar shorts
  const shorts = await stateStore.load('shorts', {});
  if (shorts[guildId] && shorts[guildId][channelId] !== undefined) {
    delete shorts[guildId][channelId];
    if (Object.keys(shorts[guildId]).length === 0) {
      delete shorts[guildId];
    }
    await stateStore.save('shorts', shorts);
    console.log(`[YouTube] Cache de shorts eliminado para canal ${channelId} en guild ${guildId}`);
  }
  
  // También limpiar la caché en memoria
  clearChannelCache(channelId);
}

// Mantener la función original para compatibilidad (aunque ya no se debería usar)
async function clearGuildCache(guildId) {
  const liveStatus = await stateStore.load('liveStatus', {});
  const videos = await stateStore.load('videos', {});
  const shorts = await stateStore.load('shorts', {});
  
  delete liveStatus[guildId];
  delete videos[guildId];
  delete shorts[guildId];
  
  await Promise.all([
    stateStore.save('liveStatus', liveStatus),
    stateStore.save('videos', videos),
    stateStore.save('shorts', shorts)
  ]);
  
  monitor('YouTube', 'Cache Cleared', guildId, { action: 'Manual cache clear' });
}

async function monitorLives(client) {
  if (runningMonitors.has('lives')) {
    console.log('⚠️ [YouTube] Live monitor already running, skipping...');
    return { success: false, reason: 'already_running' };
  }
  runningMonitors.add('lives');
  
  try {
    console.log('🔴 [YouTube] Starting live monitoring cycle...');
    const startTime = Date.now();
    const liveStatus = await stateStore.load('liveStatus', {});
    const guilds = await getAllGuildConfigs({ approvedOnly: true });
    let totalGuilds = 0, totalChannels = 0, totalLives = 0, totalErrors = 0;

    const guildEntries = Object.entries(guilds);
    const batchSize = 5;
    
    for (let i = 0; i < guildEntries.length; i += batchSize) {
      const batch = guildEntries.slice(i, i + batchSize);
      const promises = batch.map(async ([guildId, config]) => {
        try {
          const result = await processGuildLives(guildId, config, client, liveStatus);
          if (result) {
            totalGuilds += result.guilds || 0;
            totalChannels += result.channels || 0;
            totalLives += result.lives || 0;
          }
        } catch (error) {
          totalErrors++;
          console.error(`[YouTube] Error en monitorLives para guild ${guildId}:`, error);
        }
      });
      await Promise.all(promises);
      if (i + batchSize < guildEntries.length) await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await stateStore.save('liveStatus', liveStatus);
    
    const duration = Date.now() - startTime;
    monitor('YouTube', 'Live Monitoring Complete', null, {
      guilds: totalGuilds, channels: totalChannels, lives: totalLives, errors: totalErrors, duration: `${duration}ms`
    });
    
    return { success: !(totalErrors > 0 && totalGuilds === 0), guilds: totalGuilds, channels: totalChannels, lives: totalLives, errors: totalErrors, duration };
  } catch (error) {
    console.error('[YouTube] Live Monitor Fatal:', error);
    return { success: false, error: error.message };
  } finally {
    runningMonitors.delete('lives');
  }
}

async function processGuildLives(guildId, config, client, liveStatus) {
  if (!isModuleEnabledConfig(config, 'youtube', guildId)) return null;
  const youtubeConfig = config.youtube || {};
  const users = youtubeConfig.users || [];
  const liveChannelId = youtubeConfig.liveChannel;
  const pingRole = youtubeConfig.pingRole || null;

  if (users.length === 0 || !liveChannelId) return null;
  
  if (shouldSkipGuild(guildId, 'lives')) {
    console.log(`⏸️ [YouTube] Guild ${guildId} in error cooldown, skipping lives`);
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

    if (!liveStatus[guildId]) liveStatus[guildId] = {};
    const guildStatus = liveStatus[guildId];
    
    const validUsersSet = new Set(users);
    for (const savedUser of Object.keys(guildStatus)) {
      if (!validUsersSet.has(savedUser)) {
        console.log(`[YouTube] Eliminando usuario obsoleto: ${savedUser}`);
        delete guildStatus[savedUser];
      }
    }

    const results = await withRetry(() => checkLiveUsers(users), `Check lives for guild ${guildId}`);
    
    if (!results || results.length === 0) {
      console.log(`[YouTube] No hay resultados de checkLiveUsers, manteniendo caché existente`);
      if (Object.keys(guildStatus).length > 0) {
        liveStatus[guildId] = guildStatus;
      }
      return null;
    }

    let newLives = 0;
    let hasChanges = false;
    
    const pingText = pingRole ? `<@&${pingRole}>\n\n` : '';

    for (const user of results) {
      if (!user?.success) {
        console.log(`[YouTube] Usuario sin éxito, conservando datos previos`);
        continue;
      }

      const channelId = user.channelId;
      const isLive = user.isLive === true;
      const wasLive = guildStatus[channelId] === true;

      if (isLive && !wasLive) {
        console.log(`🔴 [YouTube LIVE] ${user.channelName} started live in guild ${guildId}`);
        monitor('YouTube', 'Live Started', guildId, {
          channel: user.channelName, viewers: user.viewers || 0
        });
        
        try {
          const embed = await youtubeLive(guildId, {
            channelName: user.channelName,
            handle: user.handle,
            title: user.title,
            viewers: user.viewers,
            thumbnail: user.thumbnail,
            liveUrl: user.liveUrl,
            startedAt: user.startedAt,
            likes: user.likes,
            pingText: pingText
          });
          
          if (embed) {
            const delivery = await sendNotification(channel, embed, {
              guildId,
              platform: 'youtube',
              account: channelId,
              eventType: 'live_started',
              eventId: user.videoId || user.startedAt
            });
            if (delivery.sent || (delivery.duplicate && ['sent', 'ended'].includes(delivery.event?.status))) {
              if (delivery.sent) newLives++;
              guildStatus[channelId] = true;
              hasChanges = true;
            }
          }
        } catch (error) {
          console.error(`[YouTube] Error enviando mensaje live para ${user.channelName}:`, error);
        }
      } else if (guildStatus[channelId] !== isLive) {
        if (!isLive && wasLive) {
          await completeActiveLive(channel, {
            guildId,
            platform: 'youtube',
            account: channelId
          }).catch(error => recordError(guildId, 'complete_live', error));
        }
        guildStatus[channelId] = isLive;
        hasChanges = true;
      }
    }

    if (hasChanges || Object.keys(guildStatus).length > 0) {
      liveStatus[guildId] = guildStatus;
    }
    
    resetErrors(guildId, 'lives');
    
    return { guilds: 1, channels: users.length, lives: newLives };
  } catch (error) {
    console.error(`[YouTube] Error en processGuildLives para guild ${guildId}:`, error);
    recordError(guildId, 'lives', error);
    throw error;
  }
}

async function monitorVideos(client) {
  if (runningMonitors.has('videos')) {
    console.log('⚠️ [YouTube] Video monitor already running, skipping...');
    return { success: false, reason: 'already_running' };
  }
  runningMonitors.add('videos');
  
  try {
    console.log('📹 [YouTube] Starting video monitoring cycle...');
    const startTime = Date.now();
    const videos = await stateStore.load('videos', {});
    const guilds = await getAllGuildConfigs({ approvedOnly: true });
    let totalGuilds = 0, totalChannels = 0, totalNewVideos = 0, totalErrors = 0;

    const guildEntries = Object.entries(guilds);
    const batchSize = 5;
    
    for (let i = 0; i < guildEntries.length; i += batchSize) {
      const batch = guildEntries.slice(i, i + batchSize);
      const promises = batch.map(async ([guildId, config]) => {
        try {
          const result = await processGuildVideos(guildId, config, client, videos);
          if (result) {
            totalGuilds += result.guilds || 0;
            totalChannels += result.channels || 0;
            totalNewVideos += result.videos || 0;
          }
        } catch (error) {
          totalErrors++;
          console.error(`[YouTube] Error en monitorVideos para guild ${guildId}:`, error);
        }
      });
      await Promise.all(promises);
      if (i + batchSize < guildEntries.length) await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await stateStore.save('videos', videos);
    
    const duration = Date.now() - startTime;
    monitor('YouTube', 'Video Monitoring Complete', null, {
      guilds: totalGuilds, channels: totalChannels, videos: totalNewVideos, errors: totalErrors, duration: `${duration}ms`
    });
    
    return { success: !(totalErrors > 0 && totalGuilds === 0), guilds: totalGuilds, channels: totalChannels, videos: totalNewVideos, errors: totalErrors, duration };
  } catch (error) {
    console.error('[YouTube] Video Monitor Fatal:', error);
    return { success: false, error: error.message };
  } finally {
    runningMonitors.delete('videos');
  }
}

async function processGuildVideos(guildId, config, client, videos) {
  if (!isModuleEnabledConfig(config, 'youtube', guildId)) return null;
  const youtubeConfig = config.youtube || {};
  const users = youtubeConfig.users || [];
  const videoChannelId = youtubeConfig.videoChannel;
  const pingRole = youtubeConfig.pingRole || null;

  if (users.length === 0 || !videoChannelId) return null;
  
  if (shouldSkipGuild(guildId, 'videos')) {
    console.log(`⏸️ [YouTube] Guild ${guildId} in error cooldown, skipping videos`);
    return null;
  }

  try {
    const channel = await withRetry(() => client.channels.fetch(videoChannelId), `Fetch channel ${videoChannelId}`).catch(() => null);
    if (!channel) {
      throw new Error(`Channel ${videoChannelId} not found`);
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

    const guildVideos = videos[guildId] || {};
    
    const validUsersSet = new Set(users);
    for (const savedUser of Object.keys(guildVideos)) {
      if (!validUsersSet.has(savedUser)) {
        console.log(`[YouTube] Eliminando usuario obsoleto: ${savedUser}`);
        delete guildVideos[savedUser];
      }
    }

    const results = await withRetry(() => checkVideos(users), `Check videos for guild ${guildId}`);
    
    if (!results || results.length === 0) {
      console.log(`[YouTube] No hay resultados de checkVideos, manteniendo caché existente`);
      if (Object.keys(guildVideos).length > 0) {
        videos[guildId] = guildVideos;
      }
      return null;
    }

    let newVideos = 0;
    let hasChanges = false;
    
    const pingText = pingRole ? `<@&${pingRole}>\n\n` : '';

    for (const user of results) {
      if (!user?.success) {
        console.log(`[YouTube] Usuario sin éxito: ${user?.channelId || 'unknown'}, conservando datos previos`);
        continue;
      }
      
      const channelId = user.channelId;
      const lastVideoId = guildVideos[channelId];
      const latestVideo = user.latestVideo;
      
      if (!latestVideo) {
        console.log(`[YouTube] No hay videos para ${user.channelName}, manteniendo datos previos`);
        continue;
      }

      if (!lastVideoId) {
        console.log(`[YouTube] Primer video para ${user.channelName}: ${latestVideo.videoId}`);
        guildVideos[channelId] = latestVideo.videoId;
        hasChanges = true;
        continue;
      }

      if (lastVideoId !== latestVideo.videoId) {
        console.log(`🆕 [YouTube] Nuevo video de ${user.channelName}: ${latestVideo.videoId}`);
        monitor('YouTube', 'New Video', guildId, {
          channel: user.channelName, views: latestVideo.views || 0
        });
        
        try {
          const embed = await youtubeVideo(guildId, { 
            channelName: user.channelName, 
            handle: user.handle
          }, latestVideo, pingText);
          
          if (embed) {
            const delivery = await sendNotification(channel, embed, {
              guildId,
              platform: 'youtube',
              account: channelId,
              eventType: 'video_published',
              eventId: latestVideo.videoId
            });
            if (delivery.sent || (delivery.duplicate && ['sent', 'ended'].includes(delivery.event?.status))) {
              if (delivery.sent) newVideos++;
              guildVideos[channelId] = latestVideo.videoId;
              hasChanges = true;
            }
          }
        } catch (error) {
          console.error(`[YouTube] Error enviando mensaje video para ${user.channelName}:`, error);
        }
      }
    }

    if (hasChanges || Object.keys(guildVideos).length > 0) {
      videos[guildId] = guildVideos;
      console.log(`[YouTube] guildVideos guardado: ${Object.keys(guildVideos).length} canales`);
    }
    
    resetErrors(guildId, 'videos');
    
    return { guilds: 1, channels: users.length, videos: newVideos };
  } catch (error) {
    console.error(`[YouTube] Error en processGuildVideos para guild ${guildId}:`, error);
    recordError(guildId, 'videos', error);
    throw error;
  }
}

async function monitorShorts(client) {
  if (runningMonitors.has('shorts')) {
    console.log('⚠️ [YouTube] Shorts monitor already running, skipping...');
    return { success: false, reason: 'already_running' };
  }
  runningMonitors.add('shorts');
  
  try {
    console.log('📱 [YouTube] Starting shorts monitoring cycle...');
    const startTime = Date.now();
    const shorts = await stateStore.load('shorts', {});
    const guilds = await getAllGuildConfigs({ approvedOnly: true });
    let totalGuilds = 0, totalChannels = 0, totalNewShorts = 0, totalErrors = 0;

    const guildEntries = Object.entries(guilds);
    const batchSize = 5;
    
    for (let i = 0; i < guildEntries.length; i += batchSize) {
      const batch = guildEntries.slice(i, i + batchSize);
      const promises = batch.map(async ([guildId, config]) => {
        try {
          const result = await processGuildShorts(guildId, config, client, shorts);
          if (result) {
            totalGuilds += result.guilds || 0;
            totalChannels += result.channels || 0;
            totalNewShorts += result.shorts || 0;
          }
        } catch (error) {
          totalErrors++;
          console.error(`[YouTube] Error en monitorShorts para guild ${guildId}:`, error);
        }
      });
      await Promise.all(promises);
      if (i + batchSize < guildEntries.length) await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await stateStore.save('shorts', shorts);
    
    const duration = Date.now() - startTime;
    monitor('YouTube', 'Shorts Monitoring Complete', null, {
      guilds: totalGuilds, channels: totalChannels, shorts: totalNewShorts, errors: totalErrors, duration: `${duration}ms`
    });
    
    return { success: !(totalErrors > 0 && totalGuilds === 0), guilds: totalGuilds, channels: totalChannels, shorts: totalNewShorts, errors: totalErrors, duration };
  } catch (error) {
    console.error('[YouTube] Shorts Monitor Fatal:', error);
    return { success: false, error: error.message };
  } finally {
    runningMonitors.delete('shorts');
  }
}

async function processGuildShorts(guildId, config, client, shorts) {
  if (!isModuleEnabledConfig(config, 'youtube', guildId)) return null;
  const youtubeConfig = config.youtube || {};
  const users = youtubeConfig.users || [];
  const shortChannelId = youtubeConfig.shortChannel;
  const pingRole = youtubeConfig.pingRole || null;

  if (users.length === 0 || !shortChannelId) return null;
  
  if (shouldSkipGuild(guildId, 'shorts')) {
    console.log(`⏸️ [YouTube] Guild ${guildId} in error cooldown, skipping shorts`);
    return null;
  }

  try {
    const channel = await withRetry(() => client.channels.fetch(shortChannelId), `Fetch channel ${shortChannelId}`).catch(() => null);
    if (!channel) {
      throw new Error(`Channel ${shortChannelId} not found`);
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

    const guildShorts = shorts[guildId] || {};
    
    const validUsersSet = new Set(users);
    for (const savedUser of Object.keys(guildShorts)) {
      if (!validUsersSet.has(savedUser)) {
        console.log(`[YouTube] Eliminando usuario obsoleto: ${savedUser}`);
        delete guildShorts[savedUser];
      }
    }

    const results = await withRetry(() => checkShorts(users), `Check shorts for guild ${guildId}`);
    
    if (!results || results.length === 0) {
      console.log(`[YouTube] No hay resultados de checkShorts, manteniendo caché existente`);
      if (Object.keys(guildShorts).length > 0) {
        shorts[guildId] = guildShorts;
      }
      return null;
    }

    let newShorts = 0;
    let hasChanges = false;
    
    const pingText = pingRole ? `<@&${pingRole}>\n\n` : '';

    for (const user of results) {
      if (!user?.success) {
        console.log(`[YouTube] Usuario sin éxito: ${user?.channelId || 'unknown'}, conservando datos previos`);
        continue;
      }
      
      const channelId = user.channelId;
      const lastShortId = guildShorts[channelId];
      const latestShort = user.latestShort;
      
      if (!latestShort) {
        console.log(`[YouTube] No hay shorts para ${user.channelName}, manteniendo datos previos`);
        continue;
      }

      if (!lastShortId) {
        console.log(`[YouTube] Primer short para ${user.channelName}: ${latestShort.videoId}`);
        guildShorts[channelId] = latestShort.videoId;
        hasChanges = true;
        continue;
      }

      if (lastShortId !== latestShort.videoId) {
        console.log(`🆕 [YouTube] Nuevo short de ${user.channelName}: ${latestShort.videoId}`);
        monitor('YouTube', 'New Short', guildId, {
          channel: user.channelName, views: latestShort.views || 0
        });
        
        try {
          const embed = await youtubeShort(guildId, { 
            channelName: user.channelName, 
            handle: user.handle
          }, latestShort, pingText);
          
          if (embed) {
            const delivery = await sendNotification(channel, embed, {
              guildId,
              platform: 'youtube',
              account: channelId,
              eventType: 'short_published',
              eventId: latestShort.videoId
            });
            if (delivery.sent || (delivery.duplicate && ['sent', 'ended'].includes(delivery.event?.status))) {
              if (delivery.sent) newShorts++;
              guildShorts[channelId] = latestShort.videoId;
              hasChanges = true;
            }
          }
        } catch (error) {
          console.error(`[YouTube] Error enviando mensaje short para ${user.channelName}:`, error);
        }
      }
    }

    if (hasChanges || Object.keys(guildShorts).length > 0) {
      shorts[guildId] = guildShorts;
      console.log(`[YouTube] guildShorts guardado: ${Object.keys(guildShorts).length} canales`);
    }
    
    resetErrors(guildId, 'shorts');
    
    return { guilds: 1, channels: users.length, shorts: newShorts };
  } catch (error) {
    console.error(`[YouTube] Error en processGuildShorts para guild ${guildId}:`, error);
    recordError(guildId, 'shorts', error);
    throw error;
  }
}

async function getMonitorStats() {
  const liveStatus = await stateStore.load('liveStatus', {});
  const videos = await stateStore.load('videos', {});
  const shorts = await stateStore.load('shorts', {});
  
  let totalLiveEntries = 0, totalVideoEntries = 0, totalShortEntries = 0;
  for (const guild of Object.values(liveStatus)) totalLiveEntries += Object.keys(guild).length;
  for (const guild of Object.values(videos)) totalVideoEntries += Object.keys(guild).length;
  for (const guild of Object.values(shorts)) totalShortEntries += Object.keys(guild).length;
  
  return {
    guilds: { live: Object.keys(liveStatus).length, videos: Object.keys(videos).length, shorts: Object.keys(shorts).length },
    entries: { live: totalLiveEntries, videos: totalVideoEntries, shorts: totalShortEntries },
    errors: Array.from(guildErrors.entries()).map(([key, data]) => ({
      key, count: data.count, lastError: new Date(data.lastError).toISOString()
    }))
  };
}

module.exports = { 
  monitorLives, 
  monitorVideos, 
  monitorShorts, 
  clearGuildCache, 
  cleanYouTubeChannelCache,  // NUEVA: Exportar función de limpieza específica
  getMonitorStats 
};
