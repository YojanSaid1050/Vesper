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

  // También se piden los servidores de la persona. Sin esto el panel solo
  // podía enseñar aquellos donde el bot YA estaba, y no había forma de
  // invitarlo a uno nuevo desde la web: había que salir a Discord y volver.
  const guilds = await ownedGuilds(token.access_token);

  return {
    id: user.id,
    username: user.username,
    globalName: user.global_name || null,
    avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null,
    guilds
  };
}

// Solo los servidores donde la persona manda: administrador, dueño o con
// «Gestionar servidor». Son los únicos a los que puede añadir un bot, y así la
// sesión no engorda con los cien servidores a los que pertenece.
const MANAGE_GUILD = 1n << 5n;
const ADMINISTRATOR = 1n << 3n;

async function ownedGuilds(accessToken) {
  try {
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(12_000)
    });
    if (!response.ok) return [];
    const list = await response.json();
    if (!Array.isArray(list)) return [];

    return list
      .filter(guild => {
        if (guild.owner) return true;
        const permissions = BigInt(guild.permissions || 0);
        return (permissions & MANAGE_GUILD) === MANAGE_GUILD || (permissions & ADMINISTRATOR) === ADMINISTRATOR;
      })
      .map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null,
        owner: Boolean(guild.owner)
      }))
      .slice(0, 100);
  } catch {
    // Que Discord no conteste esta lista no debe impedir entrar al panel.
    return [];
  }
}

// La dirección para añadir el bot a un servidor. Los permisos son los que
// Vesper necesita de verdad, ni uno más.
const INVITE_PERMISSIONS = '1376425551958';

function inviteUrl(guildId = null) {
  const clientId = process.env.DISCORD_OAUTH_CLIENT_ID || process.env.CLIENT_ID;
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    permissions: INVITE_PERMISSIONS,
    scope: 'bot applications.commands'
  });
  if (guildId) {
    params.set('guild_id', guildId);
    params.set('disable_guild_select', 'true');
  }
  return `https://discord.com/oauth2/authorize?${params}`;
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
  inviteUrl,
  ownedGuilds,
  INVITE_PERMISSIONS,
  explainOAuthError,
  discordConfigured,
  googleConfigured,
  discordAuthorizationUrl,
  exchangeDiscordCode,
  googleAuthorizationUrl,
  exchangeGoogleCode
};
