const { google } = require('googleapis');

const channelCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

function normalize(input) {
  if (!input) return '';
  
  let cleaned = input.toLowerCase().trim();
  cleaned = cleaned.replace('@', '');
  cleaned = cleaned.replace(/\s/g, '');
  
  const urlPatterns = [
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/user\/([a-zA-Z0-9_-]+)/
  ];
  
  for (const pattern of urlPatterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  
  return cleaned;
}

async function findExactChannel(searchTerm) {
  const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
  });

  try {
    const cleanTerm = normalize(searchTerm);
    
    const searchResponse = await youtube.search.list({
      part: ['snippet'],
      q: cleanTerm,
      type: ['channel'],
      maxResults: 10
    });
    
    for (const item of searchResponse.data.items || []) {
      const channelId = item.snippet.channelId;
      const channelInfo = await getChannelInfo(channelId);
      
      if (channelInfo) {
        const channelHandle = channelInfo.handle?.toLowerCase();
        const channelName = channelInfo.name?.toLowerCase();
        const searchTermLower = cleanTerm.toLowerCase();
        
        if (channelHandle === searchTermLower || channelName === searchTermLower) {
          return channelInfo;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching exact channel ${searchTerm}:`, error.message);
    return null;
  }
}

function isValidChannelId(id) {
  return id && id.startsWith('UC') && id.length === 24 && /^UC[A-Za-z0-9_-]{22}$/.test(id);
}

async function getChannelInfo(identifier) {
  if (channelCache.has(identifier)) {
    const cached = channelCache.get(identifier);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
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
    const isValidId = isValidChannelId(identifier);

    if (!isValidId) {
      const exactChannel = await findExactChannel(identifier);
      if (exactChannel) {
        const cacheData = { data: exactChannel, timestamp: Date.now() };
        channelCache.set(identifier, cacheData);
        channelCache.set(exactChannel.id, cacheData);
        if (exactChannel.handle) {
          channelCache.set(exactChannel.handle, cacheData);
        }
        return exactChannel;
      }
      
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

    const cacheData = { data: result, timestamp: Date.now() };
    channelCache.set(identifier, cacheData);
    channelCache.set(result.id, cacheData);
    if (result.handle) {
      channelCache.set(result.handle, cacheData);
    }

    return result;
  } catch (error) {
    console.error(`Error obteniendo canal ${identifier}:`, error.message);
    return null;
  }
}

async function verifyChannel(input) {
  const exactChannel = await findExactChannel(input);
  if (exactChannel) {
    return { exists: true, ...exactChannel };
  }
  
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
    
    const item = details.data.items?.[0];
    if (!item) return false;
    
    const duration = item.contentDetails?.duration || '';
    const title = (item.snippet?.title || '').toLowerCase();
    
    // Calcular duración en segundos
    let durationSeconds = 0;
    const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1]) || 0;
      const minutes = parseInt(durationMatch[2]) || 0;
      const seconds = parseInt(durationMatch[3]) || 0;
      durationSeconds = hours * 3600 + minutes * 60 + seconds;
    }
    
    // Short: hasta 3 minutos (180 segundos) O tiene #shorts
    const isShortDuration = durationSeconds > 0 && durationSeconds <= 180;
    const hasShortTag = title.includes('#shorts');
    
    return isShortDuration || hasShortTag;
  } catch (error) {
    console.error(`Error checking if video ${videoId} is short:`, error.message);
    return false;
  }
}

function formatNumber(num) {
  if (!num) return '0';
  const number = typeof num === 'number' ? num : parseInt(num);
  if (isNaN(number)) return '0';
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return number.toString();
}

function escapeMarkdown(text) {
  if (!text) return '';
  const str = String(text);
  return str
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/\|/g, '\\|')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function formatDuration(duration) {
  if (!duration || duration === 'P0D') return null;
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (match) {
    const hours = match[1] ? `${match[1]}:` : '';
    const minutes = match[2] ? match[2].padStart(2, '0') : '00';
    const seconds = match[3] ? match[3].padStart(2, '0') : '00';
    return hours ? `${hours}${minutes}:${seconds}` : `${minutes}:${seconds}`;
  }
  return null;
}

function formatDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

module.exports = {
  normalize,
  getChannelInfo,
  verifyChannel,
  isShort,
  formatNumber,
  escapeMarkdown,
  formatDuration,
  formatDate,
  findExactChannel,
  isValidChannelId
};