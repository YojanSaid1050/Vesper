const axios = require('axios');

let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }
    });

    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    return cachedToken;
  } catch (error) {
    console.error('Error getting Twitch access token:', error.message);
    return null;
  }
}

function normalize(username) {
  return (username || '').toLowerCase().replace('@', '').trim();
}

async function getStreamerInfo(identifier) {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const isId = /^\d+$/.test(identifier);
    const params = isId ? { id: identifier } : { login: normalize(identifier) };

    const response = await axios.get('https://api.twitch.tv/helix/users', {
      params,
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      }
    });

    const user = response.data.data?.[0];
    if (!user) return null;

    return {
      id: user.id,
      login: user.login,
      name: user.display_name,
      avatar: user.profile_image_url
    };
  } catch (error) {
    console.error(`Error getting streamer info for ${identifier}:`, error.message);
    return null;
  }
}

// Función principal para verificar streamer
async function verifyStreamer(identifier) {
  const info = await getStreamerInfo(identifier);
  if (!info) {
    return { exists: false };
  }
  
  return {
    exists: true,
    id: info.id,
    login: info.login,
    name: info.name,
    avatar: info.avatar
  };
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

module.exports = { 
  getAccessToken, 
  normalize, 
  getStreamerInfo, 
  verifyStreamer,  // <-- Asegurar que está exportada
  formatNumber,
  escapeMarkdown
};