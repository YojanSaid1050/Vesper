const { google } = require('googleapis');
const { getChannelInfo, isShort, formatDuration } = require('./utils');

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

// Caché para resultados de API
const liveCache = new Map();
const videoCache = new Map();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

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
    const response = await youtube.search.list({
      part: ['snippet'],
      channelId: channelId,
      eventType: 'live',
      type: ['video'],
      maxResults: 5
    });
    
    const liveVideo = response.data.items?.[0];
    
    if (liveVideo) {
      const videoDetails = await youtube.videos.list({
        part: ['liveStreamingDetails', 'snippet', 'statistics'],
        id: [liveVideo.id.videoId]
      });
      
      const details = videoDetails.data.items?.[0];
      const liveDetails = details?.liveStreamingDetails;
      
      const result = {
        success: true,
        channelId: channelId,
        isLive: true,
        videoId: liveVideo.id.videoId,
        title: liveVideo.snippet.title,
        thumbnail: liveVideo.snippet.thumbnails?.maxres?.url || liveVideo.snippet.thumbnails?.high?.url,
        viewers: parseInt(liveDetails?.concurrentViewers) || 0,
        likes: parseInt(details?.statistics?.likeCount) || 0,
        liveUrl: `https://www.youtube.com/watch?v=${liveVideo.id.videoId}`,
        startedAt: liveDetails?.actualStartTime
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
    const response = await youtube.search.list({
      part: ['snippet'],
      channelId: channelId,
      type: ['video'],
      maxResults: 15,
      order: 'date'
    });
    
    console.log(`[YouTube DEBUG] API response para ${channelId}: ${response.data.items?.length || 0} items`);
    
    const videos = [];
    
    for (const video of response.data.items || []) {
      const videoId = video.id.videoId;
      const isShortVideo = await isShort(videoId);
      
      if (!isShortVideo) {
        const details = await youtube.videos.list({
          part: ['statistics', 'contentDetails'],
          id: [videoId]
        });
        
        const stats = details.data.items?.[0];
        const duration = stats?.contentDetails?.duration || '';
        
        videos.push({
          videoId: videoId,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnail: video.snippet.thumbnails?.maxres?.url || video.snippet.thumbnails?.high?.url,
          publishedAt: video.snippet.publishedAt,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          views: parseInt(stats?.statistics?.viewCount) || 0,
          likes: parseInt(stats?.statistics?.likeCount) || 0,
          duration: formatDuration(duration),
          timestamp: new Date(video.snippet.publishedAt).getTime()
        });
      }
    }
    
    // Ordenar por fecha (más reciente primero)
    videos.sort((a, b) => b.timestamp - a.timestamp);
    
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
  if (videoCache.has(shortCacheKey)) {
    const cached = videoCache.get(shortCacheKey);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    videoCache.delete(shortCacheKey);
  }

  try {
    const shorts = [];
    const videoIds = new Set(); // Para evitar duplicados
    
    // MÉTODO 1: Buscar playlist de shorts del canal
    try {
      const playlistsResponse = await youtube.playlists.list({
        part: ['snippet', 'contentDetails'],
        channelId: channelId,
        maxResults: 10
      });
      
      // Buscar playlist que parezca ser de shorts
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
              
              // Obtener detalles del video (vistas, duración)
              const videoDetails = await youtube.videos.list({
                part: ['statistics', 'contentDetails'],
                id: [videoId]
              });
              
              const stats = videoDetails.data.items?.[0];
              const duration = stats?.contentDetails?.duration || '';
              
              // Calcular duración en segundos
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
    
    // MÉTODO 2: Buscar videos recientes y filtrar por duración (hasta 3 minutos)
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
      const isShortDuration = durationSeconds > 0 && durationSeconds <= 180; // 3 minutos máximo
      
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
    
    // Ordenar por fecha (más reciente primero)
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

function clearCache(channelId = null) {
  if (channelId) {
    liveCache.delete(channelId);
    videoCache.delete(channelId);
    videoCache.delete(`shorts_${channelId}`);
  } else {
    liveCache.clear();
    videoCache.clear();
  }
}

module.exports = {
  checkLiveUsers,
  checkVideos,
  checkShorts,
  clearCache,
  findExactChannel
};