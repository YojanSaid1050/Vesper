const WebSession = require('../database/models/WebSession');
const WebIdentityLink = require('../database/models/WebIdentityLink');
const { connectMongo } = require('../database/mongoManager');
const {
  COOKIE_NAME,
  sessionHours,
  randomToken,
  hashToken,
  hashValue,
  safeEqual,
  parseCookies,
  setSessionCookie,
  clearSessionCookie
} = require('./security');

function expiry() {
  return new Date(Date.now() + sessionHours() * 60 * 60 * 1000);
}

async function sessionFromRequest(req, { touch = false } = {}) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;
  await connectMongo();
  const session = await WebSession.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  if (touch && Date.now() - new Date(session.lastSeenAt || 0).getTime() > 5 * 60 * 1000) {
    session.lastSeenAt = new Date();
    session.expiresAt = expiry();
    await session.save();
  }
  return session;
}

async function beginOAuth(req, res, provider) {
  await connectMongo();
  let session = await sessionFromRequest(req);
  let token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!session) {
    token = randomToken();
    session = new WebSession({
      tokenHash: hashToken(token),
      csrfToken: randomToken(24),
      expiresAt: expiry()
    });
  }
  const state = randomToken(32);
  session.oauthStateHash = hashValue(state);
  session.oauthProvider = provider;
  session.expiresAt = expiry();
  await session.save();
  setSessionCookie(res, token);
  return state;
}

async function completeOAuth(req, res, provider, state, identity) {
  const session = await sessionFromRequest(req);
  if (!session || session.oauthProvider !== provider || !safeEqual(session.oauthStateHash, hashValue(state))) {
    throw Object.assign(new Error('El estado de autenticación no es válido o expiró.'), { statusCode: 401 });
  }
  const existingDiscordId = session.discord?.id || null;
  const existingGoogleId = session.google?.id || null;
  if (provider === 'discord') session.discord = identity;
  else session.google = identity;

  const linked = provider === 'discord'
    ? await WebIdentityLink.findOne({ 'discord.id': identity.id }).lean()
    : await WebIdentityLink.findOne({ 'google.id': identity.id }).lean();
  if (linked) {
    if ((provider === 'discord' && existingGoogleId && linked.google.id !== existingGoogleId) ||
        (provider === 'google' && existingDiscordId && linked.discord.id !== existingDiscordId)) {
      throw Object.assign(new Error('Esa cuenta ya está vinculada a una identidad diferente.'), { statusCode: 409 });
    }
    session.discord = linked.discord;
    session.google = linked.google;
    if (provider === 'discord') session.discord = identity;
    else session.google = identity;
  }

  if (session.discord && session.google) {
    const [discordLink, googleLink] = await Promise.all([
      WebIdentityLink.findOne({ 'discord.id': session.discord.id }).lean(),
      WebIdentityLink.findOne({ 'google.id': session.google.id }).lean()
    ]);
    if ((discordLink && discordLink.google.id !== session.google.id) || (googleLink && googleLink.discord.id !== session.discord.id)) {
      throw Object.assign(new Error('Una de estas cuentas ya está vinculada a otra identidad.'), { statusCode: 409 });
    }
    await WebIdentityLink.findOneAndUpdate(
      { 'discord.id': session.discord.id },
      { $set: { discord: session.discord.toObject?.() || session.discord, google: session.google.toObject?.() || session.google } },
      { upsert: true, returnDocument: 'after' }
    );
  }
  const nextToken = randomToken();
  session.tokenHash = hashToken(nextToken);
  session.csrfToken = randomToken(24);
  session.oauthStateHash = null;
  session.oauthProvider = null;
  session.lastSeenAt = new Date();
  session.expiresAt = expiry();
  await session.save();
  setSessionCookie(res, nextToken);
  return session;
}

async function unlinkProvider(session, provider) {
  if (!['discord', 'google'].includes(provider)) throw Object.assign(new Error('Proveedor no válido.'), { statusCode: 400 });
  if (!session.discord || !session.google) throw Object.assign(new Error('No hay dos identidades vinculadas.'), { statusCode: 409 });
  await WebIdentityLink.deleteOne({ 'discord.id': session.discord.id, 'google.id': session.google.id });
  session[provider] = null;
  session.csrfToken = randomToken(24);
  session.expiresAt = expiry();
  await session.save();
  return session;
}

async function logout(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (token) {
    await connectMongo();
    await WebSession.deleteOne({ tokenHash: hashToken(token) }).catch(() => null);
  }
  clearSessionCookie(res);
}

async function requireSession(req, res, next) {
  try {
    const session = await sessionFromRequest(req, { touch: true });
    if (!session || (!session.discord && !session.google)) return res.status(401).json({ error: 'Debes iniciar sesión.' });
    req.webSession = session;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireCsrf(req, res, next) {
  const supplied = req.get('X-CSRF-Token');
  if (!supplied || !safeEqual(supplied, req.webSession?.csrfToken)) {
    return res.status(403).json({ error: 'La validación de seguridad de la solicitud falló.' });
  }
  return next();
}

module.exports = { sessionFromRequest, beginOAuth, completeOAuth, unlinkProvider, logout, requireSession, requireCsrf };
