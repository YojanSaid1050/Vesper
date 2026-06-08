const { google } = require('googleapis');
const { getChannelInfo, isShort } = require('./utils');

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

async function checkLiveStatus(channelId) {
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
        part: ['liveStreamingDetails', 'snippet'],
        id: [liveVideo.id.videoId]
      });
      
      const details = videoDetails.data.items?.[0];
      const liveDetails = details?.liveStreamingDetails;
      
      return {
        success: true,
        channelId: channelId,
        isLive: true,
        videoId: liveVideo.id.videoId,
        title: liveVideo.snippet.title,
        thumbnail: liveVideo.snippet.thumbnails?.high?.url,
        viewers: parseInt(liveDetails?.concurrentViewers) || 0,
        liveUrl: `https://www.youtube.com/watch?v=${liveVideo.id.videoId}`
      };
    }
    
    return {
      success: true,
      channelId: channelId,
      isLive: false
    };
  } catch (err) {
    return {
      success: false,
      channelId: channelId,
      error: err.message
    };
  }
}

async function checkLiveUsers(users) {
  const results = [];
  
  for (const userId of users) {
    const isChannelId = userId.match(/^UC[A-Za-z0-9_-]{22}$/);
    
    let channelId = userId;
    let channelInfo = null;
    
    if (isChannelId) {
      channelInfo = await getChannelInfo(userId);
      
      if (!channelInfo) {
        results.push({
          success: false,
          channelId: userId,
          error: 'Canal no encontrado'
        });
        continue;
      }
    } else {
      const { normalize } = require('./utils');
      const handle = normalize(userId);
      
      try {
        const searchResponse = await youtube.search.list({
          part: ['snippet'],
          q: handle,
          type: ['channel'],
          maxResults: 1
        });
        
        const foundChannel = searchResponse.data.items?.[0];
        
        if (!foundChannel) {
          results.push({
            success: false,
            handle: handle,
            error: 'Canal no encontrado'
          });
          continue;
        }
        
        channelId = foundChannel.snippet.channelId;
        channelInfo = await getChannelInfo(channelId);
        
        if (!channelInfo) {
          results.push({
            success: false,
            handle: handle,
            error: 'No se pudo obtener información del canal'
          });
          continue;
        }
      } catch (err) {
        results.push({
          success: false,
          handle: handle,
          error: err.message
        });
        continue;
      }
    }
    
    const liveStatus = await checkLiveStatus(channelId);
    
    results.push({
      ...liveStatus,
      handle: channelInfo?.handle || userId,
      channelName: channelInfo?.name || userId,
      avatar: channelInfo?.avatar || null
    });
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

async function getLatestVideos(channelId) {
  try {
    const response = await youtube.search.list({
      part: ['snippet'],
      channelId: channelId,
      type: ['video'],
      maxResults: 10,
      order: 'date'
    });
    
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
        let formattedDuration = duration;
        
        if (duration && duration !== 'P0D') {
          const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          if (match) {
            const hours = match[1] ? `${match[1]}:` : '';
            const minutes = match[2] ? match[2].padStart(2, '0') : '00';
            const seconds = match[3] ? match[3].padStart(2, '0') : '00';
            formattedDuration = hours ? `${hours}${minutes}:${seconds}` : `${minutes}:${seconds}`;
          }
        }
        
        videos.push({
          videoId: videoId,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnail: video.snippet.thumbnails?.high?.url,
          publishedAt: video.snippet.publishedAt,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          views: parseInt(stats?.statistics?.viewCount) || 0,
          likes: parseInt(stats?.statistics?.likeCount) || 0,
          duration: formattedDuration !== 'PT0S' ? formattedDuration : null
        });
      }
    }
    
    return videos;
  } catch (err) {
    return [];
  }
}

async function checkVideos(users) {
  const results = [];
  
  for (const userId of users) {
    const isChannelId = userId.match(/^UC[A-Za-z0-9_-]{22}$/);
    
    let channelId = userId;
    let channelInfo = null;
    
    if (isChannelId) {
      channelInfo = await getChannelInfo(userId);
      
      if (!channelInfo) {
        results.push({
          success: false,
          channelId: userId,
          error: 'Canal no encontrado'
        });
        continue;
      }
    } else {
      const { normalize } = require('./utils');
      const handle = normalize(userId);
      
      try {
        const searchResponse = await youtube.search.list({
          part: ['snippet'],
          q: handle,
          type: ['channel'],
          maxResults: 1
        });
        
        const foundChannel = searchResponse.data.items?.[0];
        
        if (!foundChannel) {
          results.push({
            success: false,
            handle: handle,
            error: 'Canal no encontrado'
          });
          continue;
        }
        
        channelId = foundChannel.snippet.channelId;
        channelInfo = await getChannelInfo(channelId);
        
        if (!channelInfo) {
          results.push({
            success: false,
            handle: handle,
            error: 'No se pudo obtener información del canal'
          });
          continue;
        }
      } catch (err) {
        results.push({
          success: false,
          handle: handle,
          error: err.message
        });
        continue;
      }
    }
    
    const latestVideos = await getLatestVideos(channelId);
    
    results.push({
      success: true,
      channelId: channelId,
      handle: channelInfo?.handle || userId,
      channelName: channelInfo?.name || userId,
      avatar: channelInfo?.avatar || null,
      latestVideo: latestVideos[0] || null,
      allVideos: latestVideos
    });
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

async function getLatestShorts(channelId) {
  try {
    const response = await youtube.search.list({
      part: ['snippet'],
      channelId: channelId,
      type: ['video'],
      maxResults: 15,
      order: 'date'
    });
    
    const shorts = [];
    
    for (const video of response.data.items || []) {
      const videoId = video.id.videoId;
      const isShortVideo = await isShort(videoId);
      
      if (isShortVideo) {
        const details = await youtube.videos.list({
          part: ['statistics'],
          id: [videoId]
        });
        
        const stats = details.data.items?.[0];
        
        shorts.push({
          videoId: videoId,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnail: video.snippet.thumbnails?.high?.url,
          publishedAt: video.snippet.publishedAt,
          url: `https://www.youtube.com/shorts/${videoId}`,
          views: parseInt(stats?.statistics?.viewCount) || 0,
          likes: parseInt(stats?.statistics?.likeCount) || 0
        });
      }
    }
    
    return shorts;
  } catch (err) {
    return [];
  }
}

async function checkShorts(users) {
  const results = [];
  
  for (const userId of users) {
    const isChannelId = userId.match(/^UC[A-Za-z0-9_-]{22}$/);
    
    let channelId = userId;
    let channelInfo = null;
    
    if (isChannelId) {
      channelInfo = await getChannelInfo(userId);
      
      if (!channelInfo) {
        results.push({
          success: false,
          channelId: userId,
          error: 'Canal no encontrado'
        });
        continue;
      }
    } else {
      const { normalize } = require('./utils');
      const handle = normalize(userId);
      
      try {
        const searchResponse = await youtube.search.list({
          part: ['snippet'],
          q: handle,
          type: ['channel'],
          maxResults: 1
        });
        
        const foundChannel = searchResponse.data.items?.[0];
        
        if (!foundChannel) {
          results.push({
            success: false,
            handle: handle,
            error: 'Canal no encontrado'
          });
          continue;
        }
        
        channelId = foundChannel.snippet.channelId;
        channelInfo = await getChannelInfo(channelId);
        
        if (!channelInfo) {
          results.push({
            success: false,
            handle: handle,
            error: 'No se pudo obtener información del canal'
          });
          continue;
        }
      } catch (err) {
        results.push({
          success: false,
          handle: handle,
          error: err.message
        });
        continue;
      }
    }
    
    const latestShorts = await getLatestShorts(channelId);
    
    results.push({
      success: true,
      channelId: channelId,
      handle: channelInfo?.handle || userId,
      channelName: channelInfo?.name || userId,
      avatar: channelInfo?.avatar || null,
      latestShort: latestShorts[0] || null,
      allShorts: latestShorts
    });
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

module.exports = {
  checkLiveUsers,
  checkVideos,
  checkShorts
};