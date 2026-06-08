const axios = require('axios');

let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }
    });

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    return accessToken;
  } catch (error) {
    console.error('Error obteniendo token de Twitch:', error.message);
    return null;
  }
}

function normalize(username) {
  if (!username) return '';
  return username.toLowerCase().trim().replace('@', '');
}

async function getStreamerInfo(username) {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const response = await axios.get('https://api.twitch.tv/helix/users', {
      params: { login: normalize(username) },
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      }
    });

    const user = response.data.data?.[0];
    if (!user) return null;

    return {
      id: user.id,
      name: user.display_name,
      login: user.login,
      avatar: user.profile_image_url
    };
  } catch (error) {
    console.error(`Error obteniendo info de ${username}:`, error.message);
    return null;
  }
}

async function verifyStreamer(input) {
  const info = await getStreamerInfo(input);
  return info ? { exists: true, ...info } : { exists: false };
}

module.exports = {
  getAccessToken,
  normalize,
  getStreamerInfo,
  verifyStreamer
};