const { google } = require('googleapis');

const channelCache = new Map();

function normalize(input) {
  if (!input) return '';
  
  let cleaned = input.toLowerCase().trim();
  cleaned = cleaned.replace('@', '');
  cleaned = cleaned.replace(/\s/g, '');
  
  const urlPatterns = [
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/
  ];
  
  for (const pattern of urlPatterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  
  return cleaned;
}

async function getChannelInfo(identifier) {
  if (channelCache.has(identifier)) {
    const cached = channelCache.get(identifier);
    if (Date.now() - cached.timestamp < 3600000) {
      return cached.data;
    }
    channelCache.delete(identifier);
  }

  const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
  });

  try {
    let channelId = identifier;
    const isChannelId = identifier.match(/^UC[A-Za-z0-9_-]{22}$/);

    if (!isChannelId) {
      const search = await youtube.search.list({
        part: ['snippet'],
        q: normalize(identifier),
        type: ['channel'],
        maxResults: 1
      });

      if (!search.data.items?.length) return null;
      channelId = search.data.items[0].snippet.channelId;
    }

    const response = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      id: [channelId]
    });

    const channel = response.data.items?.[0];
    if (!channel) return null;

    const result = {
      id: channel.id,
      name: channel.snippet.title,
      handle: channel.snippet.customUrl?.replace('@', '') || channel.id,
      avatar: channel.snippet.thumbnails?.high?.url,
      subscribers: parseInt(channel.statistics?.subscriberCount) || 0
    };

    channelCache.set(identifier, { data: result, timestamp: Date.now() });
    channelCache.set(result.id, { data: result, timestamp: Date.now() });
    if (result.handle) {
      channelCache.set(result.handle, { data: result, timestamp: Date.now() });
    }

    return result;
  } catch (error) {
    console.error(`Error obteniendo canal ${identifier}:`, error.message);
    return null;
  }
}

async function verifyChannel(input) {
  const info = await getChannelInfo(input);
  return info ? { exists: true, ...info } : { exists: false };
}

async function isShort(videoId) {
  const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
  });

  try {
    const details = await youtube.videos.list({
      part: ['contentDetails', 'snippet'],
      id: [videoId]
    });
    
    const duration = details.data.items?.[0]?.contentDetails?.duration || '';
    const title = details.data.items?.[0]?.snippet?.title?.toLowerCase() || '';
    
    const isShortDuration = duration.includes('S') && !duration.includes('H') && !duration.includes('M');
    const hasShortTag = title.includes('#shorts');
    
    return isShortDuration || hasShortTag;
  } catch {
    return false;
  }
}

module.exports = {
  normalize,
  getChannelInfo,
  verifyChannel,
  isShort
};