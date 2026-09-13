// src/platforms/twitch/checks.js
const axios = require('axios');
const { getAccessToken, withTwitchAuth, normalize, getStreamerInfo } = require('./utils');
const { recordRequest } = require('../../core/ProviderMetrics');

// Cache para streamers
const streamerCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

function getCachedStreamer(identifier) {
  const cached = streamerCache.get(identifier);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

// Sin límite, este Map crecía indefinidamente en procesos de larga duración.
const STREAMER_CACHE_MAX = 1000;

function setCachedStreamer(identifier, data) {
  streamerCache.delete(identifier);
  streamerCache.set(identifier, {
    data,
    timestamp: Date.now()
  });
  while (streamerCache.size > STREAMER_CACHE_MAX) {
    const oldest = streamerCache.keys().next().value;
    if (oldest === undefined) break;
    streamerCache.delete(oldest);
  }
}

async function checkStreamerStatus(userId) {
  try {
    const response = await withTwitchAuth(token => axios.get('https://api.twitch.tv/helix/streams', {
      params: { user_id: userId },
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      },
      timeout: 10000
    }));
    recordRequest('twitch', 1, {
      remaining: response.headers?.['ratelimit-remaining'],
      limit: response.headers?.['ratelimit-limit'],
      resetAt: response.headers?.['ratelimit-reset'] ? new Date(Number(response.headers['ratelimit-reset']) * 1000).toISOString() : null
    });

    const stream = response.data.data?.[0];
    
    if (stream) {
      return {
        success: true,
        isLive: true,
        streamId: stream.id,
        title: stream.title,
        game: stream.game_name,
        viewers: stream.viewer_count,
        thumbnail: stream.thumbnail_url.replace('{width}', 1920).replace('{height}', 1080),
        streamUrl: `https://twitch.tv/${stream.user_login}`,
        startedAt: stream.started_at
      };
    }
    
    return { success: true, isLive: false };
  } catch (error) {
    console.error(`Error checking streamer ${userId}:`, error.message);
    return { success: false, error: error.message };
  }
}

// La API de Twitch acepta como máximo 100 valores de `login`/`user_id` por
// petición. Con más cuentas devolvía 400 y el monitor entero fallaba.
const TWITCH_BATCH_LIMIT = 100;

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function fetchStreamerBatch(users) {
  const list = Array.isArray(users) ? users : [];
  if (list.length === 0) return [];
  if (list.length > TWITCH_BATCH_LIMIT) {
    const results = [];
    for (const group of chunk(list, TWITCH_BATCH_LIMIT)) {
      results.push(...await fetchStreamerBatch(group));
    }
    return results;
  }

  const headersFor = token => ({
    'Client-ID': process.env.TWITCH_CLIENT_ID,
    'Authorization': `Bearer ${token}`
  });
  const userParams = new URLSearchParams();
  list.forEach(user => userParams.append('login', normalize(user)));

  const userResponse = await withTwitchAuth(token => axios.get('https://api.twitch.tv/helix/users', {
    params: userParams,
    headers: headersFor(token),
    timeout: 10000
  }));
  recordRequest('twitch', 1, {
    remaining: userResponse.headers?.['ratelimit-remaining'],
    limit: userResponse.headers?.['ratelimit-limit'],
    resetAt: userResponse.headers?.['ratelimit-reset'] ? new Date(Number(userResponse.headers['ratelimit-reset']) * 1000).toISOString() : null
  });

  const info = (userResponse.data.data || []).map(user => ({
    id: user.id,
    login: user.login,
    name: user.display_name,
    avatar: user.profile_image_url
  }));

  if (info.length === 0) return [];

  const streamParams = new URLSearchParams();
  info.forEach(user => streamParams.append('user_id', user.id));
  streamParams.set('first', String(Math.min(info.length, 100)));

  const streamResponse = await withTwitchAuth(token => axios.get('https://api.twitch.tv/helix/streams', {
    params: streamParams,
    headers: headersFor(token),
    timeout: 10000
  }));
  recordRequest('twitch', 1, {
    remaining: streamResponse.headers?.['ratelimit-remaining'],
    limit: streamResponse.headers?.['ratelimit-limit'],
    resetAt: streamResponse.headers?.['ratelimit-reset'] ? new Date(Number(streamResponse.headers['ratelimit-reset']) * 1000).toISOString() : null
  });
  const streams = new Map((streamResponse.data.data || []).map(stream => [stream.user_id, stream]));

  return info.map(user => {
    const stream = streams.get(user.id);
    setCachedStreamer(user.login, user);
    setCachedStreamer(user.id, user);

    if (!stream) {
      return {
        success: true,
        isLive: false,
        streamerId: user.id,
        login: user.login,
        streamerName: user.name,
        avatar: user.avatar
      };
    }

    return {
      success: true,
      isLive: true,
      streamId: stream.id,
      title: stream.title,
      game: stream.game_name,
      viewers: stream.viewer_count,
      thumbnail: stream.thumbnail_url.replace('{width}', '1920').replace('{height}', '1080'),
      streamUrl: `https://twitch.tv/${stream.user_login}`,
      startedAt: stream.started_at,
      streamerId: user.id,
      login: user.login,
      streamerName: user.name,
      avatar: user.avatar
    };
  });
}

async function checkStreamers(users) {
  if (!Array.isArray(users) || users.length === 0) return [];

  const normalizedUsers = [...new Set(users.map(normalize).filter(Boolean))];
  const results = [];

  for (let index = 0; index < normalizedUsers.length; index += 100) {
    const batch = normalizedUsers.slice(index, index + 100);
    const batchResults = await fetchStreamerBatch(batch);
    const found = new Set(batchResults.map(item => item.login));
    results.push(...batchResults);

    for (const login of batch) {
      if (!found.has(login)) {
        results.push({ success: false, login, streamerName: login, error: 'Streamer no encontrado' });
      }
    }
  }

  return results;
}

async function checkStreamersLegacy(users) {
  const results = [];
  
  for (const userId of users) {
    try {
      const isChannelId = userId.match(/^\d+$/);
      
      const cachedInfo = getCachedStreamer(userId);
      let streamerInfo = cachedInfo;
      
      if (!streamerInfo) {
        streamerInfo = await getStreamerInfo(userId);
        if (streamerInfo) {
          setCachedStreamer(userId, streamerInfo);
          setCachedStreamer(streamerInfo.login, streamerInfo);
          setCachedStreamer(streamerInfo.id, streamerInfo);
        }
      }
      
      if (!streamerInfo) {
        results.push({
          success: false,
          login: normalize(userId),
          streamerName: normalize(userId),
          error: 'Streamer no encontrado'
        });
        continue;
      }
      
      const streamStatus = await checkStreamerStatus(streamerInfo.id);
      
      results.push({
        ...streamStatus,
        streamerId: streamerInfo.id,
        login: streamerInfo.login,
        streamerName: streamerInfo.name,
        avatar: streamerInfo.avatar
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Error processing streamer ${userId}:`, error.message);
      results.push({
        success: false,
        login: normalize(userId),
        streamerName: normalize(userId),
        error: error.message
      });
    }
  }
  
  return results;
}

function clearStreamerCache(identifier = null) {
  if (identifier) {
    streamerCache.delete(identifier);
    console.log(`🗑️ Cache cleared for streamer: ${identifier}`);
  } else {
    streamerCache.clear();
    console.log('🗑️ All streamer cache cleared');
  }
}

// ==================================================
// LIMPIEZA PERIÓDICA DE STREAMERS INEXISTENTES (CADA 7 DÍAS)
// ==================================================

// Verificar si un streamer sigue existiendo en Twitch
async function verifyStreamerExists(login) {
  try {
    const info = await getStreamerInfo(login);
    return info !== null;
  } catch (error) {
    console.error(`[Twitch] Error verificando existencia de ${login}:`, error.message);
    return null;
  }
}

// Limpiar streamers inexistentes de un guild específico
async function cleanNonExistentStreamersInGuild(guildId, streamers, updateGuildSectionFunc) {
  if (!streamers || streamers.length === 0) return { validStreamers: [], removedStreamers: [] };
  
  const validStreamers = [];
  const removedStreamers = [];
  
  for (const login of streamers) {
    const exists = await verifyStreamerExists(login);
    if (exists !== false) {
      validStreamers.push(login);
      if (exists === null) {
        console.warn(`[Twitch] No se pudo confirmar ${login}; se conserva para evitar una eliminación incorrecta`);
      }
    } else {
      removedStreamers.push(login);
      clearStreamerCache(login);
      console.log(`[Twitch] Streamer ${login} ya no existe, eliminando de la lista...`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (removedStreamers.length > 0) {
    await updateGuildSectionFunc(guildId, 'twitch', { users: validStreamers });
  }
  
  return { validStreamers, removedStreamers };
}

// Limpieza periódica global (CADA 7 DÍAS)
async function scheduledCleanup() {
  console.log('🔍 [Twitch] Iniciando limpieza periódica de streamers inexistentes (cada 7 días)...');
  
  const { getAllGuildConfigs, updateGuildSection } = require('../../database/mongoManager');
  const guilds = await getAllGuildConfigs({ approvedOnly: true });
  let totalRemoved = 0;
  
  for (const [guildId, config] of Object.entries(guilds)) {
    const twitchConfig = config.twitch || {};
    const streamers = twitchConfig.users || [];
    
    if (streamers.length === 0) continue;
    
    const { removedStreamers } = await cleanNonExistentStreamersInGuild(guildId, streamers, updateGuildSection);
    totalRemoved += removedStreamers.length;
    
    if (removedStreamers.length > 0) {
      console.log(`[Twitch] Guild ${guildId}: Eliminados ${removedStreamers.length} streamers inexistentes: ${removedStreamers.join(', ')}`);
    }
  }
  
  console.log(`✅ [Twitch] Limpieza completada. Total de streamers eliminados: ${totalRemoved}`);
}

// ==================================================
// LIMPIEZA DE CACHÉ HUÉRFANA (CADA 6 HORAS - NO CONSUME API)
// ==================================================

async function cleanOrphanedCache() {
  console.log('🔍 [Twitch] Iniciando limpieza de caché huérfana (cada 6 horas)...');
  
  const { getAllGuildConfigs } = require('../../database/mongoManager');
  const guilds = await getAllGuildConfigs({ approvedOnly: true });
  
  // Recopilar todos los streamers activos de MongoDB
  const activeStreamers = new Set();
  for (const [guildId, config] of Object.entries(guilds)) {
    const twitchConfig = config.twitch || {};
    const streamers = twitchConfig.users || [];
    streamers.forEach(s => activeStreamers.add(s.toLowerCase()));
  }
  
  let orphanedCount = 0;
  
  // Limpiar streamerCache
  for (const [identifier, value] of streamerCache.entries()) {
    const isActive = activeStreamers.has(identifier.toLowerCase());
    
    if (!isActive) {
      streamerCache.delete(identifier);
      orphanedCount++;
      console.log(`[Twitch] Caché huérfana eliminada para: ${identifier}`);
    }
  }
  
  console.log(`✅ [Twitch] Limpieza de caché huérfana completada. ${orphanedCount} entradas eliminadas.`);
}

// ==================================================
// PROGRAMACIÓN DE LIMPIEZAS
// ==================================================

// Limpieza de existencia: cada 7 días (primer ejecución en 1 hora)
const scheduledCleanupTimer = setTimeout(() => {
  const runCleanup = () => scheduledCleanup().catch(error => console.error('[Twitch] Error en limpieza programada:', error));
  runCleanup();
  const timer = setInterval(runCleanup, 7 * 24 * 60 * 60 * 1000);
  timer.unref?.();
}, 60 * 60 * 1000);
scheduledCleanupTimer.unref?.();

// Limpieza de caché huérfana: cada 6 horas (primer ejecución en 30 minutos)
const orphanCleanupTimer = setTimeout(() => {
  const runCleanup = () => Promise.resolve(cleanOrphanedCache()).catch(error => console.error('[Twitch] Error limpiando caché huérfana:', error));
  runCleanup();
  const timer = setInterval(runCleanup, 6 * 60 * 60 * 1000);
  timer.unref?.();
}, 30 * 60 * 1000);
orphanCleanupTimer.unref?.();

module.exports = { 
  checkStreamers, 
  clearStreamerCache,
  verifyStreamerExists,
  cleanNonExistentStreamersInGuild,
  scheduledCleanup,
  cleanOrphanedCache
};
