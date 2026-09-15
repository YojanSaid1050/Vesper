const { baseUrl } = require('./security');

// Las direcciones de vuelta que Vesper usa. Tienen que estar dadas de alta,
// carácter a carácter, en el panel de cada proveedor: si no coinciden, el
// proveedor rechaza el acceso antes incluso de preguntar nada.
// Google llama a esto «URI de redireccionamiento autorizado» y devuelve
// «Error 400: redirect_uri_mismatch»; Discord lo llama «Redirect» y devuelve
// «Invalid OAuth2 redirect_uri».
function redirectUris() {
  let base = null;
  try {
    base = baseUrl();
  } catch {
    return { base: null, discord: null, google: null };
  }
  return {
    base,
    discord: `${base}/auth/discord/callback`,
    google: `${base}/auth/google/callback`
  };
}

// Los errores de OAuth son crípticos. Se traducen los dos o tres que se dan
// de verdad, diciendo exactamente qué hay que pegar y dónde.
function explainOAuthError(provider, raw) {
  const uris = redirectUris();
  const text = String(raw || '');
  const uri = provider === 'Google' ? uris.google : uris.discord;

  if (/redirect_uri_mismatch|invalid.*redirect/i.test(text)) {
    return provider === 'Google'
      ? `Google rechaza la dirección de vuelta. Entra en Google Cloud Console → Credenciales → tu ID de cliente OAuth y añade exactamente esta «URI de redireccionamiento autorizado»: ${uri}`
      : `Discord rechaza la dirección de vuelta. Entra en el portal de desarrolladores → OAuth2 → Redirects y añade exactamente: ${uri}`;
  }
  if (/invalid_client|unauthorized_client/i.test(text)) {
    return `${provider} no reconoce las credenciales. Comprueba el ID y el secreto de cliente en el alojamiento.`;
  }
  if (/invalid_grant/i.test(text)) {
    return `${provider} rechazó el código de acceso. Suele pasar al recargar una página de vuelta antigua: vuelve a empezar desde el panel.`;
  }
  if (/access_denied/i.test(text)) {
    return `Cancelaste el acceso en ${provider}.`;
  }
  return `${provider}: ${text}`;
}

async function responseJson(response, provider) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error_description || data.error?.message || data.error || `Error HTTP ${response.status}`;
    throw Object.assign(new Error(explainOAuthError(provider, `${data.error || ''} ${message}`)), { statusCode: 401 });
  }
  return data;
}

function discordConfigured() {
  return Boolean((process.env.DISCORD_OAUTH_CLIENT_ID || process.env.CLIENT_ID) && process.env.DISCORD_OAUTH_CLIENT_SECRET && process.env.WEB_BASE_URL);
}

function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.WEB_BASE_URL);
}

function discordAuthorizationUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_OAUTH_CLIENT_ID || process.env.CLIENT_ID,
    response_type: 'code',
    redirect_uri: `${baseUrl()}/auth/discord/callback`,
    scope: 'identify guilds',
    state
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

async function exchangeDiscordCode(code) {
  const clientId = process.env.DISCORD_OAUTH_CLIENT_ID || process.env.CLIENT_ID;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: process.env.DISCORD_OAUTH_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${baseUrl()}/auth/discord/callback`
  });
  const token = await responseJson(await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(12_000)
  }), 'Discord');
  const user = await responseJson(await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(12_000)
  }), 'Discord');
  return {
    id: user.id,
    username: user.username,
    globalName: user.global_name || null,
    avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null
  };
}

function googleAuthorizationUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: `${baseUrl()}/auth/google/callback`,
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeGoogleCode(code) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${baseUrl()}/auth/google/callback`
  });
  const token = await responseJson(await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(12_000)
  }), 'Google');
  const user = await responseJson(await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(12_000)
  }), 'Google');
  if (!user.email || user.email_verified !== true) {
    throw Object.assign(new Error('Google no devolvió un correo verificado.'), { statusCode: 401 });
  }
  return {
    id: user.sub,
    email: String(user.email).toLowerCase(),
    name: user.name || null,
    picture: user.picture || null,
    verified: true
  };
}

module.exports = {
  redirectUris,
  explainOAuthError,
  discordConfigured,
  googleConfigured,
  discordAuthorizationUrl,
  exchangeDiscordCode,
  googleAuthorizationUrl,
  exchangeGoogleCode
};
