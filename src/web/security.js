const crypto = require('crypto');

const COOKIE_NAME = 'vesper_session';
const DEFAULT_SESSION_HOURS = 24;

function csvSet(value, transform = item => item) {
  return new Set(String(value || '').split(',').map(item => transform(item.trim())).filter(Boolean));
}

function dashboardEnabled() {
  return String(process.env.WEB_DASHBOARD_ENABLED || 'false').toLowerCase() === 'true';
}

function sessionConfigured() {
  return String(process.env.WEB_SESSION_SECRET || '').length >= 32;
}

function sessionSecret() {
  const secret = String(process.env.WEB_SESSION_SECRET || '');
  if (secret.length < 32) throw new Error('WEB_SESSION_SECRET debe tener al menos 32 caracteres');
  return secret;
}

function baseUrl() {
  const raw = String(process.env.WEB_BASE_URL || '').trim().replace(/\/$/, '');
  if (!raw) throw new Error('WEB_BASE_URL no está configurada');
  const parsed = new URL(raw);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('WEB_BASE_URL debe usar HTTP o HTTPS');
  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== '/')) {
    throw new Error('WEB_BASE_URL debe contener solo el origen público, sin ruta, credenciales ni parámetros');
  }
  return parsed.toString().replace(/\/$/, '');
}

function sessionHours() {
  const value = Number(process.env.WEB_SESSION_HOURS || DEFAULT_SESSION_HOURS);
  return Number.isFinite(value) && value >= 1 && value <= 168 ? value : DEFAULT_SESSION_HOURS;
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function hashToken(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(String(value || '')).digest('hex');
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(header = '') {
  const result = {};
  for (const part of String(header).split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try { result[key] = decodeURIComponent(value); }
    catch { result[key] = value; }
  }
  return result;
}

function secureCookie() {
  if (process.env.WEB_COOKIE_SECURE !== undefined) {
    return String(process.env.WEB_COOKIE_SECURE).toLowerCase() === 'true';
  }
  try { return new URL(baseUrl()).protocol === 'https:'; }
  catch { return process.env.NODE_ENV === 'production'; }
}

function setSessionCookie(res, token) {
  const maxAge = sessionHours() * 60 * 60;
  const attributes = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`
  ];
  if (secureCookie()) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(res) {
  const attributes = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secureCookie()) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.secure || req.get('X-Forwarded-Proto') === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://discord.com https://accounts.google.com; img-src 'self' data: https:; style-src 'self'; script-src 'self'; connect-src 'self'");
  next();
}

function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  let lastCleanup = 0;
  return (req, res, next) => {
    const now = Date.now();
    if (now - lastCleanup > windowMs) {
      for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
      lastCleanup = now;
    }
    const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${req.baseUrl || req.path}`;
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.' });
    }
    return next();
  };
}

module.exports = {
  COOKIE_NAME,
  csvSet,
  dashboardEnabled,
  sessionConfigured,
  sessionSecret,
  baseUrl,
  sessionHours,
  randomToken,
  hashToken,
  hashValue,
  safeEqual,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  securityHeaders,
  createRateLimiter
};
