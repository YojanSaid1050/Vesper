// src/platforms/youtube/checks.js
const { google } = require('googleapis');
const { getChannelInfo, formatDuration } = require('./utils');
const { recordRequest } = require('../../core/ProviderMetrics');

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

// Caché para resultados de API
const liveCache = new Map();
const videoCache = new Map();
const channelContentCache = new Map();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

function durationToSeconds(duration = '') {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1]) || 0) * 3600
    + (parseInt(match[2]) || 0) * 60
    + (parseInt(match[3]) || 0);
}

async function getChannelContent(channelId) {
  const cached = channelContentCache.get(channelId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;

  // Todo canal de YouTube tiene una playlist de subidas cuyo identificador se
  // obtiene reemplazando el prefijo UC por UU. playlistItems.list cuesta una
  // fracción de la búsqueda y permite reutilizar una sola consulta para lives,
  // videos y shorts.
  const uploadsPlaylistId = `UU${channelId.slice(2)}`;
  const playlist = await youtube.playlistItems.list({
    part: ['snippet', 'contentDetails'],
    playlistId: uploadsPlaylistId,
    maxResults: 20
  });
  recordRequest('youtube', 1);

  const ids = (playlist.data.items || [])
    .map(item => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
    .filter(Boolean);

  if (ids.length === 0) {
    channelContentCache.set(channelId, { data: [], timestamp: Date.now() });
    return [];
  }

  const details = await youtube.videos.list({
    part: ['snippet', 'statistics', 'contentDetails', 'liveStreamingDetails'],
    id: ids
  });
  recordRequest('youtube', 1);

  const content = (details.data.items || []).map(item => {
    const duration = item.contentDetails?.duration || '';
    const durationSeconds = durationToSeconds(duration);
    const liveDetails = item.liveStreamingDetails || {};
    const isLive = item.snippet?.liveBroadcastContent === 'live'
      || Boolean(liveDetails.actualStartTime && !liveDetails.actualEndTime);
    const isShortVideo = !isLive && (
      (durationSeconds > 0 && durationSeconds <= 180)
      || (item.snippet?.title || '').toLowerCase().includes('#shorts')
    );

    return {
      videoId: item.id,
      title: item.snippet?.title || 'Sin título',
      description: item.snippet?.description || '',
      thumbnail: item.snippet?.thumbnails?.maxres?.url || item.snippet?.thumbnails?.high?.url,
      publishedAt: item.snippet?.publishedAt,
      views: parseInt(item.statistics?.viewCount) || 0,
      likes: parseInt(item.statistics?.likeCount) || 0,
      duration,
      durationSeconds,
      timestamp: new Date(item.snippet?.publishedAt || 0).getTime(),
      isShort: isShortVideo,
      isLive,
      viewers: parseInt(liveDetails.concurrentViewers) || 0,
      startedAt: liveDetails.actualStartTime || null
    };
  }).sort((a, b) => b.timestamp - a.timestamp);

  channelContentCache.set(channelId, { data: content, timestamp: Date.now() });
  return content;
}

async function findExactChannel(identifier) {
  const { normalize } = require('./utils');
  const cleanIdentifier = normalize(identifier);
  
  try {
    const searchResponse = await youtube.search.list({
      part: ['snippet'],
      q: cleanIdentifier,
      type: ['channel'],
      maxResults: 5
    });
    recordRequest('youtube', 100);
    
    for (const item of searchResponse.data.items || []) {
      const channelId = item.snippet.channelId;
      const channelInfo = await getChannelInfo(channelId);
      
      if (channelInfo) {
        const channelHandle = channelInfo.handle?.toLowerCase();
        const channelName = channelInfo.name?.toLowerCase();
        const searchTerm = cleanIdentifier.toLowerCase();
        
        if (channelHandle === searchTerm || channelName === searchTerm) {
          return channelInfo;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching channel ${identifier}:`, error.message);
    return null;
  }
}

async function checkLiveStatus(channelId) {
  if (liveCache.has(channelId)) {
    const cached = liveCache.get(channelId);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    liveCache.delete(channelId);
  }

  try {
    const content = await getChannelContent(channelId);
    const liveVideo = content.find(video => video.isLive);
    
    if (liveVideo) {
      const result = {
        success: true,
        channelId: channelId,
        isLive: true,
        videoId: liveVideo.videoId,
        title: liveVideo.title,
        thumbnail: liveVideo.thumbnail,
        viewers: liveVideo.viewers,
        likes: liveVideo.likes,
        liveUrl: `https://www.youtube.com/watch?v=${liveVideo.videoId}`,
        startedAt: liveVideo.startedAt
      };
      
      liveCache.set(channelId, { data: result, timestamp: Date.now() });
      return result;
    }
    
    const result = { success: true, channelId: channelId, isLive: false };
    liveCache.set(channelId, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    console.error(`Error checking live status for ${channelId}:`, err.message);
    return { success: false, channelId: channelId, error: err.message };
  }
}

async function checkLiveUsers(users) {
  const results = [];
  
  for (const userId of users) {
    try {
      const isChannelId = userId.match(/^UC[A-Za-z0-9_-]{22}$/);
      let channelId = userId;
      let channelInfo = null;
      
      if (isChannelId) {
        channelInfo = await getChannelInfo(userId);
        if (!channelInfo) {
          console.log(`[YouTube] Canal no encontrado (ID): ${userId}`);
          results.push({
            success: false,
            channelId: userId,
            error: 'Canal no encontrado'
          });
          continue;
        }
      } else {
        channelInfo = await findExactChannel(userId);
        
        if (!channelInfo) {
          console.log(`[YouTube] Canal no encontrado (búsqueda): ${userId}`);
          results.push({
            success: false,
            handle: userId,
            error: `No se encontró el canal "${userId}" en YouTube. Verifica el nombre.`
          });
          continue;
        }
        
        channelId = channelInfo.id;
      }
      
      console.log(`[YouTube] Canal encontrado: ${channelInfo.name} (${channelId})`);
      
      const liveStatus = await checkLiveStatus(channelId);
      
      results.push({
        ...liveStatus,
        handle: channelInfo.handle || userId,
        channelName: channelInfo.name || userId,
        avatar: channelInfo.avatar || null
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error processing live user ${userId}:`, error.message);
      results.push({
        success: false,
        channelId: userId,
        error: error.message
      });
    }
  }
  
  return results;
}

async function getLatestVideos(channelId) {
  console.log(`[YouTube DEBUG] getLatestVideos para canal: ${channelId}`);
  
  if (videoCache.has(channelId)) {
    const cached = videoCache.get(channelId);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[YouTube DEBUG] Usando caché para ${channelId}, ${cached.data.length} videos`);
      return cached.data;
    }
    videoCache.delete(channelId);
  }

  try {
    const content = await getChannelContent(channelId);
    const videos = content
      .filter(video => !video.isShort && !video.isLive)
      .map(video => ({
        ...video,
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
        duration: formatDuration(video.duration)
      }));
    
    console.log(`[YouTube DEBUG] Videos procesados para ${channelId}: ${videos.length} (más reciente: ${videos[0]?.videoId || 'ninguno'})`);
    
    videoCache.set(channelId, { data: videos, timestamp: Date.now() });
    return videos;
  } catch (err) {
    console.error(`Error getting videos for ${channelId}:`, err.message);
    return [];
  }
}

async function checkVideos(users) {
  console.log(`[YouTube DEBUG] checkVideos para usuarios: ${users.join(', ')}`);
  const results = [];
  
  for (const userId of users) {
    try {
      const isChannelId = userId.match(/^UC[A-Za-z0-9_-]{22}$/);
      let channelId = userId;
      let channelInfo = null;
      
      if (isChannelId) {
        channelInfo = await getChannelInfo(userId);
        if (!channelInfo) {
          console.log(`[YouTube] Canal no encontrado (ID): ${userId}`);
          results.push({
            success: false,
            channelId: userId,
            error: 'Canal no encontrado'
          });
          continue;
        }
      } else {
        channelInfo = await findExactChannel(userId);
        
        if (!channelInfo) {
          console.log(`[YouTube] Canal no encontrado (búsqueda): ${userId}`);
          results.push({
            success: false,
            handle: userId,
            error: `No se encontró el canal "${userId}" en YouTube. Verifica el nombre.`
          });
          continue;
        }
        
        channelId = channelInfo.id;
      }
      
      console.log(`[YouTube] Canal encontrado: ${channelInfo.name} (${channelId})`);
      
      const latestVideos = await getLatestVideos(channelId);
      
      console.log(`[YouTube] Canal ${channelInfo.name}: ${latestVideos.length} videos encontrados`);
      
      results.push({
        success: true,
        channelId: channelId,
        handle: channelInfo.handle || userId,
        channelName: channelInfo.name || userId,
        avatar: channelInfo.avatar || null,
        latestVideo: latestVideos[0] || null,
        allVideos: latestVideos
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error processing video user ${userId}:`, error.message);
      results.push({
        success: false,
        channelId: userId,
        error: error.message
      });
    }
  }
  
  return results;
}

async function getLatestShorts(channelId) {
  const shortCacheKey = `shorts_${channelId}`;
  const cached = videoCache.get(shortCacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;

  try {
    const content = await getChannelContent(channelId);
    const shorts = content
      .filter(video => video.isShort)
      .map(video => ({
        ...video,
        url: `https://www.youtube.com/shorts/${video.videoId}`
      }));

    videoCache.set(shortCacheKey, { data: shorts, timestamp: Date.now() });
    return shorts;
  } catch (error) {
    console.error(`Error getting shorts for ${channelId}:`, error.message);
    return [];
  }
}

// Se conserva temporalmente como referencia de migración. No es invocada por
// los monitores; la implementación activa usa la playlist de subidas.
async function getLatestShortsLegacy(channelId) {
  const shortCacheKey = `shorts_${channelId}`;
  if (videoCache.has(shortCacheKey)) {
    const cached = videoCache.get(shortCacheKey);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    videoCache.delete(shortCacheKey);
  }

  try {
    const shorts = [];
    const videoIds = new Set();
    
    try {
      const playlistsResponse = await youtube.playlists.list({
        part: ['snippet', 'contentDetails'],
        channelId: channelId,
        maxResults: 10
      });
      
      const shortsPlaylist = playlistsResponse.data.items?.find(playlist => 
        playlist.snippet.title?.toLowerCase().includes('short') ||
        playlist.snippet.title?.toLowerCase().includes('shorts')
      );
      
      if (shortsPlaylist) {
        console.log(`[YouTube Shorts] Encontrada playlist de shorts: ${shortsPlaylist.snippet.title}`);
        
        let nextPageToken = null;
        let hasMore = true;
        
        while (hasMore && shorts.length < 30) {
          const playlistItems = await youtube.playlistItems.list({
            part: ['snippet', 'contentDetails'],
            playlistId: shortsPlaylist.id,
            maxResults: 30,
            pageToken: nextPageToken
          });
          
          for (const item of playlistItems.data.items || []) {
            const videoId = item.snippet.resourceId?.videoId;
            if (videoId && !videoIds.has(videoId)) {
              videoIds.add(videoId);
              
              const videoDetails = await youtube.videos.list({
                part: ['statistics', 'contentDetails'],
                id: [videoId]
              });
              
              const stats = videoDetails.data.items?.[0];
              const duration = stats?.contentDetails?.duration || '';
              
              let durationSeconds = 0;
              const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
              if (durationMatch) {
                const hours = parseInt(durationMatch[1]) || 0;
                const minutes = parseInt(durationMatch[2]) || 0;
                const seconds = parseInt(durationMatch[3]) || 0;
                durationSeconds = hours * 3600 + minutes * 60 + seconds;
              }
              
              shorts.push({
                videoId: videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails?.high?.url,
                publishedAt: item.snippet.publishedAt,
                url: `https://www.youtube.com/shorts/${videoId}`,
                views: parseInt(stats?.statistics?.viewCount) || 0,
                likes: parseInt(stats?.statistics?.likeCount) || 0,
                timestamp: new Date(item.snippet.publishedAt).getTime(),
                durationSeconds: durationSeconds
              });
            }
          }
          
          nextPageToken = playlistItems.data.nextPageToken;
          hasMore = nextPageToken && shorts.length < 30;
        }
      }
    } catch (err) {
      console.log(`[YouTube Shorts] No se encontró playlist de shorts para ${channelId}`);
    }
    
    const searchResponse = await youtube.search.list({
      part: ['snippet'],
      channelId: channelId,
      type: ['video'],
      maxResults: 30,
      order: 'date'
    });
    
    for (const video of searchResponse.data.items || []) {
      const videoId = video.id.videoId;
      if (videoIds.has(videoId)) continue;
      
      const details = await youtube.videos.list({
        part: ['contentDetails', 'statistics'],
        id: [videoId]
      });
      
      const item = details.data.items?.[0];
      if (!item) continue;
      
      const duration = item.contentDetails?.duration || '';
      let durationSeconds = 0;
      const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1]) || 0;
        const minutes = parseInt(durationMatch[2]) || 0;
        const seconds = parseInt(durationMatch[3]) || 0;
        durationSeconds = hours * 3600 + minutes * 60 + seconds;
      }
      
      const title = (video.snippet.title || '').toLowerCase();
      const hasShortTag = title.includes('#shorts');
      const isShortDuration = durationSeconds > 0 && durationSeconds <= 180;
      
      if (isShortDuration || hasShortTag) {
        shorts.push({
          videoId: videoId,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnail: video.snippet.thumbnails?.maxres?.url || video.snippet.thumbnails?.high?.url,
          publishedAt: video.snippet.publishedAt,
          url: `https://www.youtube.com/shorts/${videoId}`,
          views: parseInt(item.statistics?.viewCount) || 0,
          likes: parseInt(item.statistics?.likeCount) || 0,
          timestamp: new Date(video.snippet.publishedAt).getTime(),
          durationSeconds: durationSeconds
        });
      }
    }
    
    shorts.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`[YouTube Shorts] Canal ${channelId}: encontró ${shorts.length} shorts (límite 3 minutos)`);
    if (shorts.length > 0) {
      console.log(`[YouTube Shorts] Primer short: ${shorts[0].videoId} - ${shorts[0].title} (${shorts[0].durationSeconds}s)`);
    }
    
    videoCache.set(shortCacheKey, { data: shorts, timestamp: Date.now() });
    return shorts;
  } catch (err) {
    console.error(`Error getting shorts for ${channelId}:`, err.message);
    return [];
  }
}

async function checkShorts(users) {
  console.log(`[YouTube DEBUG] checkShorts para usuarios: ${users.join(', ')}`);
  const results = [];
  
  for (const userId of users) {
    try {
      const isChannelId = userId.match(/^UC[A-Za-z0-9_-]{22}$/);
      let channelId = userId;
      let channelInfo = null;
      
      if (isChannelId) {
        channelInfo = await getChannelInfo(userId);
        if (!channelInfo) {
          console.log(`[YouTube] Canal no encontrado (ID): ${userId}`);
          results.push({
            success: false,
            channelId: userId,
            error: 'Canal no encontrado'
          });
          continue;
        }
      } else {
        channelInfo = await findExactChannel(userId);
        
        if (!channelInfo) {
          console.log(`[YouTube] Canal no encontrado (búsqueda): ${userId}`);
          results.push({
            success: false,
            handle: userId,
            error: `No se encontró el canal "${userId}" en YouTube. Verifica el nombre.`
          });
          continue;
        }
        
        channelId = channelInfo.id;
      }
      
      console.log(`[YouTube] Canal encontrado: ${channelInfo.name} (${channelId})`);
      
      const latestShorts = await getLatestShorts(channelId);
      
      console.log(`[YouTube] Canal ${channelInfo.name}: ${latestShorts.length} shorts encontrados`);
      
      results.push({
        success: true,
        channelId: channelId,
        handle: channelInfo.handle || userId,
        channelName: channelInfo.name || userId,
        avatar: channelInfo.avatar || null,
        latestShort: latestShorts[0] || null,
        allShorts: latestShorts
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error processing shorts user ${userId}:`, error.message);
      results.push({
        success: false,
        channelId: userId,
        error: error.message
      });
    }
  }
  
  return results;
}

// ==================================================
// FUNCIONES PARA LIMPIEZA ESPECÍFICA
// ==================================================

function clearChannelCache(channelId) {
  if (channelId) {
    liveCache.delete(channelId);
    videoCache.delete(channelId);
    videoCache.delete(`shorts_${channelId}`);
    channelContentCache.delete(channelId);
    console.log(`[YouTube] Cache limpiado para canal: ${channelId}`);
  }
}

async function verifyChannelExists(channelId) {
  try {
    const response = await youtube.channels.list({
      part: ['id'],
      id: [channelId],
      maxResults: 1
    });
    return Boolean(response.data.items?.length);
  } catch (error) {
    console.error(`[YouTube] Error verificando existencia del canal ${channelId}:`, error.message);
    return null;
  }
}

function clearCache(channelId = null) {
  if (channelId) {
    clearChannelCache(channelId);
  } else {
    liveCache.clear();
    videoCache.clear();
    channelContentCache.clear();
    console.log('[YouTube] Todas las cachés han sido limpiadas');
  }
}

// ==================================================
// LIMPIEZA PERIÓDICA DE CANALES INEXISTENTES (CADA 7 DÍAS)
// ==================================================

async function cleanNonExistentChannelsInGuild(guildId, channels, updateGuildSectionFunc) {
  if (!channels || channels.length === 0) return { validChannels: [], removedChannels: [] };
  
  const validChannels = [];
  const removedChannels = [];
  
  for (const channelId of channels) {
    const exists = await verifyChannelExists(channelId);
    if (exists !== false) {
      validChannels.push(channelId);
      if (exists === null) {
        console.warn(`[YouTube] No se pudo confirmar ${channelId}; se conserva para evitar una eliminación incorrecta`);
      }
    } else {
      removedChannels.push(channelId);
      clearChannelCache(channelId);
      console.log(`[YouTube] Canal ${channelId} ya no existe, eliminando de la lista...`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (removedChannels.length > 0) {
    await updateGuildSectionFunc(guildId, 'youtube', { users: validChannels });
  }
  
  return { validChannels, removedChannels };
}

async function scheduledCleanup() {
  console.log('🔍 [YouTube] Iniciando limpieza periódica de canales inexistentes (cada 7 días)...');
  
  const { getAllGuildConfigs, updateGuildSection } = require('../../database/mongoManager');
  const guilds = await getAllGuildConfigs({ approvedOnly: true });
  let totalRemoved = 0;
  
  for (const [guildId, config] of Object.entries(guilds)) {
    const youtubeConfig = config.youtube || {};
    const channels = youtubeConfig.users || [];
    
    if (channels.length === 0) continue;
    
    const { removedChannels } = await cleanNonExistentChannelsInGuild(guildId, channels, updateGuildSection);
    totalRemoved += removedChannels.length;
    
    if (removedChannels.length > 0) {
      console.log(`[YouTube] Guild ${guildId}: Eliminados ${removedChannels.length} canales inexistentes`);
    }
  }
  
  console.log(`✅ [YouTube] Limpieza completada. Total de canales eliminados: ${totalRemoved}`);
}

// ==================================================
// LIMPIEZA DE CACHÉ HUÉRFANA (CADA 6 HORAS - NO CONSUME CUOTA DE API)
// ==================================================

async function cleanOrphanedCache() {
  console.log('🔍 [YouTube] Iniciando limpieza de caché huérfana (cada 6 horas)...');
  
  const { getAllGuildConfigs } = require('../../database/mongoManager');
  const guilds = await getAllGuildConfigs({ approvedOnly: true });
  
  // Recopilar todos los canales activos de MongoDB
  const activeChannels = new Set();
  for (const [guildId, config] of Object.entries(guilds)) {
    const youtubeConfig = config.youtube || {};
    const channels = youtubeConfig.users || [];
    channels.forEach(c => activeChannels.add(c));
  }
  
  let orphanedCount = 0;
  
  // Limpiar liveCache
  for (const [channelId, value] of liveCache.entries()) {
    if (!activeChannels.has(channelId)) {
      liveCache.delete(channelId);
      orphanedCount++;
      console.log(`[YouTube] Caché huérfana (live) eliminada para: ${channelId}`);
    }
  }
  
  // Limpiar videoCache
  for (const [key, value] of videoCache.entries()) {
    const channelId = key.replace('shorts_', '');
    if (!activeChannels.has(channelId)) {
      videoCache.delete(key);
      orphanedCount++;
      console.log(`[YouTube] Caché huérfana (video/shorts) eliminada para: ${key}`);
    }
  }
  
  console.log(`✅ [YouTube] Limpieza de caché huérfana completada. ${orphanedCount} entradas eliminadas.`);
}

// ==================================================
// PROGRAMACIÓN DE LIMPIEZAS
// ==================================================

// Limpieza de existencia: cada 7 días (primer ejecución en 1 hora)
const scheduledCleanupTimer = setTimeout(() => {
  const runCleanup = () => scheduledCleanup().catch(error => console.error('[YouTube] Error en limpieza programada:', error));
  runCleanup();
  const timer = setInterval(runCleanup, 7 * 24 * 60 * 60 * 1000);
  timer.unref?.();
}, 60 * 60 * 1000);
scheduledCleanupTimer.unref?.();

// Limpieza de caché huérfana: cada 6 horas (primer ejecución en 30 minutos)
const orphanCleanupTimer = setTimeout(() => {
  const runCleanup = () => Promise.resolve(cleanOrphanedCache()).catch(error => console.error('[YouTube] Error limpiando caché huérfana:', error));
  runCleanup();
  const timer = setInterval(runCleanup, 6 * 60 * 60 * 1000);
  timer.unref?.();
}, 30 * 60 * 1000);
orphanCleanupTimer.unref?.();

module.exports = {
  checkLiveUsers,
  checkVideos,
  checkShorts,
  clearCache,
  clearChannelCache,
  verifyChannelExists,
  findExactChannel,
  cleanNonExistentChannelsInGuild,
  scheduledCleanup,
  cleanOrphanedCache
};
