const axios = require('axios');
const { getAccessToken, normalize, getStreamerInfo } = require('./utils');

async function checkStreamerStatus(userId) {
  const token = await getAccessToken();
  if (!token) return { success: false, error: 'No token' };

  try {
    const response = await axios.get('https://api.twitch.tv/helix/streams', {
      params: { user_id: userId },
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      }
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
    
    // IMPORTANTE: Cuando está offline, también devolvemos isLive: false
    return { 
      success: true, 
      isLive: false 
    };
  } catch (error) {
    console.error(`Error checking streamer ${userId}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function checkStreamers(users) {
  const results = [];
  
  for (const userId of users) {
    const isChannelId = userId.match(/^\d+$/);
    
    let streamerId = userId;
    let streamerInfo = null;
    
    if (isChannelId) {
      streamerInfo = await getStreamerInfo(userId);
      
      if (!streamerInfo) {
        results.push({
          success: false,
          streamerId: userId,
          login: userId,
          streamerName: userId,
          error: 'Streamer no encontrado'
        });
        continue;
      }
    } else {
      streamerInfo = await getStreamerInfo(userId);
      
      if (!streamerInfo) {
        results.push({
          success: false,
          login: normalize(userId),
          streamerName: normalize(userId),
          error: 'Streamer no encontrado'
        });
        continue;
      }
      
      streamerId = streamerInfo.id;
    }
    
    const streamStatus = await checkStreamerStatus(streamerId);
    
    // Combinar resultados - SIEMPRE incluir login y streamerName
    results.push({
      ...streamStatus,
      streamerId: streamerId,
      login: streamerInfo.login,
      streamerName: streamerInfo.name,
      avatar: streamerInfo.avatar
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

module.exports = { checkStreamers };