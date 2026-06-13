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
      
      // Intentar obtener de caché primero
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
      
      // Pequeña pausa para evitar rate limit
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

// Función para limpiar caché
function clearStreamerCache(identifier = null) {
  if (identifier) {
    streamerCache.delete(identifier);
    console.log(`🗑️ Cache cleared for streamer: ${identifier}`);
  } else {
    streamerCache.clear();
    console.log('🗑️ All streamer cache cleared');
  }
}

module.exports = { checkStreamers, clearStreamerCache };