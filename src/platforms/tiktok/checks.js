const {
  getFreeTikTokClient,
  stopFreeTikTokClient,
  CONFIG: CLIENT_CONFIG
} = require('./freeClient');
const { normalizeUsername } = require('./utils');

const userCache = new Map();
const liveCache = new Map();

const CONFIG = {
  PROVIDER: 'self_hosted',
  USER_CACHE_DURATION: Math.max(60_000, Number(process.env.TIKTOK_VIDEO_CACHE_MINUTES || 30) * 60_000),
  LIVE_CACHE_DURATION: Math.max(30_000, Number(process.env.TIKTOK_LIVE_CACHE_MINUTES || 5) * 60_000),
  MAX_CACHE_SIZE: Math.max(50, Number(process.env.TIKTOK_MAX_CACHE_SIZE) || 500),
  CONCURRENCY: Math.max(1, Math.min(5, Number(process.env.TIKTOK_CONCURRENCY) || 2)),
  BROWSER_TIMEOUT_MS: CLIENT_CONFIG.BROWSER_TIMEOUT_MS
};

function uniqueUsernames(usernames = []) {
  return [...new Set(usernames.map(normalizeUsername).filter(Boolean))].sort();
}

function getCached(cache, key, maxAge) {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.timestamp >= maxAge) return null;
  return JSON.parse(JSON.stringify(entry.data));
}

function setCached(cache, key, data) {
  cache.set(key, { data: JSON.parse(JSON.stringify(data)), timestamp: Date.now() });
  if (cache.size <= CONFIG.MAX_CACHE_SIZE) return;
  const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
  for (const [entryKey] of oldest.slice(0, cache.size - CONFIG.MAX_CACHE_SIZE)) cache.delete(entryKey);
}

async function mapLimit(items, limit, operation) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await operation(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function checkLiveUsers(usernames = [], options = {}) {
  const normalized = uniqueUsernames(usernames);
  if (normalized.length === 0) return [];
  const client = getFreeTikTokClient();

  const results = await mapLimit(normalized, CONFIG.CONCURRENCY, async username => {
    const cached = options.skipCache ? null : getCached(liveCache, username, CONFIG.LIVE_CACHE_DURATION);
    if (cached) return cached;
    try {
      const profile = await client.fetchProfile(username);
      const result = {
        success: true,
        username: profile.username,
        isLive: profile.isLive,
        roomId: profile.roomId,
        nickname: profile.nickname,
        viewers: profile.viewers,
        title: profile.title,
        cover: profile.cover,
        liveUrl: profile.liveUrl
      };
      setCached(liveCache, username, result);
      return result;
    } catch (error) {
      return { success: false, username, rawError: String(error.message || error).slice(0, 300) };
    }
  });

  if (results.every(result => !result.success)) {
    throw new Error(`TikTok no respondió para ninguna cuenta: ${results.map(result => result.rawError).join('; ')}`);
  }
  return results;
}

async function checkUsers(usernames = [], options = {}) {
  const normalized = uniqueUsernames(usernames);
  if (normalized.length === 0) return [];
  const client = getFreeTikTokClient();

  const results = await mapLimit(normalized, 1, async username => {
    const cached = options.skipCache ? null : getCached(userCache, username, CONFIG.USER_CACHE_DURATION);
    if (cached) return cached;
    try {
      const profile = await client.fetchProfile(username);
      const result = await client.fetchLatestVideo(username, profile);
      setCached(userCache, username, result);
      return result;
    } catch (error) {
      return {
        exists: false,
        username,
        unavailable: true,
        error: String(error.message || error).slice(0, 300)
      };
    }
  });

  if (results.every(result => result.unavailable)) {
    throw new Error(`No fue posible consultar videos TikTok: ${results.map(result => result.error).join('; ')}`);
  }
  return results;
}

async function checkUser(username, options = {}) {
  const normalized = normalizeUsername(username);
  if (!normalized) return { exists: false, error: 'Nombre de usuario vacío' };
  const [result] = await checkUsers([normalized], options);
  return result || { exists: false, username: normalized };
}

function clearUserCache(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return;
  userCache.delete(normalized);
  liveCache.delete(normalized);
}

function clearAllCache() {
  userCache.clear();
  liveCache.clear();
}

async function getCacheStats() {
  return {
    userCache: { total: userCache.size },
    liveCache: { total: liveCache.size },
    provider: await getFreeTikTokClient().stats()
  };
}

async function verifyUserExists(username) {
  try {
    const profile = await getFreeTikTokClient().fetchProfile(normalizeUsername(username));
    return profile.exists === true;
  } catch (error) {
    console.warn(`[TikTok] No se pudo verificar @${normalizeUsername(username)}: ${error.message}`);
    return null;
  }
}

async function cleanNonExistentUsersInGuild(guildId, users) {
  return { validUsers: [...users], removedUsers: [], skipped: true, guildId };
}

async function scheduledCleanup() {
  return { removedUsers: 0, skipped: true, reason: 'manual_removal_only' };
}

async function cleanOrphanedCache() {
  clearAllCache();
  return { cleared: true };
}

module.exports = {
  checkLiveUsers,
  checkUser,
  checkUsers,
  clearUserCache,
  clearAllCache,
  getCacheStats,
  verifyUserExists,
  shutdownTikTokProvider: stopFreeTikTokClient,
  cleanNonExistentUsersInGuild,
  scheduledCleanup,
  cleanOrphanedCache,
  CONFIG,
  mapLimit
};
