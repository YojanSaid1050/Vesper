// src/platforms/twitch/checks.js
const axios = require('axios');
const { getAccessToken, normalize, getStreamerInfo } = require('./utils');

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

function setCachedStreamer(identifier, data) {
  streamerCache.set(identifier, {
    data,
    timestamp: Date.now()
  });
}

async function checkStreamerStatus(userId) {
  const token = await getAccessToken();
  if (!token) return { success: false, error: 'No token' };

  try {
    const response = await axios.get('https://api.twitch.tv/helix/streams', {
      params: { user_id: userId },
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      },
      timeout: 10000
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

async function checkStreamers(users) {
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
    return false;
  }
}

// Limpiar streamers inexistentes de un guild específico
async function cleanNonExistentStreamersInGuild(guildId, streamers, updateGuildSectionFunc) {
  if (!streamers || streamers.length === 0) return { validStreamers: [], removedStreamers: [] };
  
  const validStreamers = [];
  const removedStreamers = [];
  
  for (const login of streamers) {
    const exists = await verifyStreamerExists(login);
    if (exists) {
      validStreamers.push(login);
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
  const guilds = await getAllGuildConfigs();
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
  const guilds = await getAllGuildConfigs();
  
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
setTimeout(() => {
  scheduledCleanup();
  setInterval(scheduledCleanup, 7 * 24 * 60 * 60 * 1000);
}, 60 * 60 * 1000);

// Limpieza de caché huérfana: cada 6 horas (primer ejecución en 30 minutos)
setTimeout(() => {
  cleanOrphanedCache();
  setInterval(cleanOrphanedCache, 6 * 60 * 60 * 1000);
}, 30 * 60 * 1000);

module.exports = { 
  checkStreamers, 
  clearStreamerCache,
  verifyStreamerExists,
  cleanNonExistentStreamersInGuild,
  scheduledCleanup,
  cleanOrphanedCache
};