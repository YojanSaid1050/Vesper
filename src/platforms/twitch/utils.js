const axios = require('axios');

let cachedToken = null;
let tokenExpiry = null;
let tokenRequest = null;

// Los tokens de aplicación de Twitch duran unos 60 días. Sin margen de
// seguridad, una petición lanzada justo en el límite recibe 401; y sin
// invalidación explícita, un token revocado dejaba el monitor caído durante
// semanas sin ningún error evidente.
const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;
const TOKEN_REQUEST_TIMEOUT_MS = 10_000;

function invalidateAccessToken() {
  cachedToken = null;
  tokenExpiry = null;
}

async function getAccessToken({ forceRefresh = false } = {}) {
  if (forceRefresh) invalidateAccessToken();
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  // Varios monitores se ejecutan en paralelo: sin esta deduplicación cada uno
  // pedía su propio token y Twitch acababa limitando la aplicación.
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    try {
      const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          grant_type: 'client_credentials'
        },
        timeout: TOKEN_REQUEST_TIMEOUT_MS
      });

      const expiresInMs = Number(response.data.expires_in || 0) * 1000;
      cachedToken = response.data.access_token || null;
      tokenExpiry = cachedToken && expiresInMs > 0
        ? Date.now() + Math.max(60_000, expiresInMs - TOKEN_SAFETY_MARGIN_MS)
        : null;
      if (!cachedToken) console.error('Twitch no devolvió un token de acceso');
      return cachedToken;
    } catch (error) {
      invalidateAccessToken();
      console.error('Error getting Twitch access token:', error.message);
      return null;
    } finally {
      tokenRequest = null;
    }
  })();

  return tokenRequest;
}

// Reintenta una llamada a la API una sola vez cuando Twitch responde 401,
// renovando el token antes. Cubre el caso de un token revocado o rotado.
async function withTwitchAuth(call) {
  let token = await getAccessToken();
  if (!token) throw new Error('No se pudo obtener el token de Twitch');
  try {
    return await call(token);
  } catch (error) {
    if (error?.response?.status !== 401) throw error;
    token = await getAccessToken({ forceRefresh: true });
    if (!token) throw new Error('No se pudo renovar el token de Twitch');
    return call(token);
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
      },
      timeout: 10_000
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
    throw error;
  }
}

// Función principal para verificar streamer
async function verifyStreamer(identifier) {
  try {
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
  } catch (error) {
    return { exists: false, error: error.message, temporary: true };
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

module.exports = { 
  getAccessToken,
  invalidateAccessToken,
  withTwitchAuth, 
  normalize, 
  getStreamerInfo, 
  verifyStreamer,  // <-- Asegurar que está exportada
  formatNumber,
  escapeMarkdown
};
