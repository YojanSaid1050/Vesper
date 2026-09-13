const fs = require('fs');
const { chromium } = require('playwright');
const { normalizeUsername, sleep } = require('./utils');

const DEFAULT_USER_AGENT = process.env.TIKTOK_USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

function positiveInteger(value, fallback, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

const CONFIG = {
  USER_AGENT: DEFAULT_USER_AGENT,
  REQUEST_TIMEOUT_MS: positiveInteger(process.env.TIKTOK_REQUEST_TIMEOUT_MS, 30_000, 5_000, 120_000),
  REQUEST_DELAY_MS: positiveInteger(process.env.TIKTOK_REQUEST_DELAY_MS, 900, 0, 10_000),
  CONCURRENCY: positiveInteger(process.env.TIKTOK_CONCURRENCY, 2, 1, 5),
  BROWSER_PATH: process.env.TIKTOK_BROWSER_PATH || '',
  BROWSER_TIMEOUT_MS: positiveInteger(process.env.TIKTOK_BROWSER_TIMEOUT_MS, 60_000, 10_000, 180_000),
  PAGE_SETTLE_MS: positiveInteger(process.env.TIKTOK_PAGE_SETTLE_MS, 3_000, 500, 15_000)
};

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '');
}

function firstUrl(...values) {
  for (const value of values) {
    if (typeof value === 'string' && /^https:\/\//i.test(value)) return value;
    if (Array.isArray(value)) {
      const nested = firstUrl(...value);
      if (nested) return nested;
    }
    if (value && typeof value === 'object') {
      const nested = firstUrl(value.urlList, value.url_list, value.url, value.uri);
      if (nested) return nested;
    }
  }
  return null;
}

function extractJsonScript(html, id) {
  const escapedId = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(html || '').match(
    new RegExp(`<script[^>]+id=["']${escapedId}["'][^>]*>([\\s\\S]*?)<\\/script>`, 'i')
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function parseProfileHtml(html, requestedUsername) {
  const username = normalizeUsername(requestedUsername);
  const sigi = extractJsonScript(html, 'SIGI_STATE');
  const info = sigi?.LiveRoom?.liveRoomUserInfo;
  const user = info?.user || {};
  const liveRoom = info?.liveRoom || {};
  const returnedUsername = normalizeUsername(firstDefined(user.uniqueId, user.unique_id, username));

  if (!sigi || !returnedUsername || (username && returnedUsername !== username)) {
    const error = new Error(`TikTok no devolvió un perfil público válido para @${username}`);
    error.code = 'TIKTOK_PROFILE_UNAVAILABLE';
    throw error;
  }

  const roomId = String(firstDefined(user.roomId, user.room_id, liveRoom.id, ''));
  const roomStatus = Number(firstDefined(liveRoom.status, sigi.LiveRoom.liveRoomStatus, 0));
  const isLive = Boolean(roomId && roomStatus !== 0 && roomStatus !== 4);

  return {
    exists: true,
    success: true,
    username: returnedUsername,
    secUid: String(firstDefined(user.secUid, user.sec_uid, '')),
    nickname: firstDefined(user.nickname, returnedUsername),
    avatar: firstUrl(user.avatarLarger, user.avatarMedium, user.avatarThumb),
    followers: Number(firstDefined(user.stats?.followerCount, user.followerCount, 0)) || 0,
    hearts: Number(firstDefined(user.stats?.heartCount, user.heartCount, 0)) || 0,
    videos: Number(firstDefined(user.stats?.videoCount, user.videoCount, 0)) || 0,
    isLive,
    roomId,
    viewers: isLive ? Number(firstDefined(liveRoom.liveRoomStats?.userCount, liveRoom.userCount, 0)) || 0 : 0,
    title: firstDefined(liveRoom.title, 'TikTok Live'),
    cover: firstUrl(liveRoom.coverUrl, liveRoom.cover, user.avatarLarger, user.avatarMedium),
    liveUrl: `https://www.tiktok.com/@${returnedUsername}/live`
  };
}

function videoTimestampFromId(id) {
  try {
    const seconds = Number(BigInt(String(id)) >> 32n);
    const minimum = Date.UTC(2015, 0, 1) / 1000;
    const maximum = Date.now() / 1000 + 366 * 24 * 60 * 60;
    return seconds >= minimum && seconds <= maximum ? seconds : 0;
  } catch {
    return 0;
  }
}

function normalizeBrowserVideo(item, profile) {
  const username = normalizeUsername(firstDefined(item?.username, profile?.username));
  const id = firstDefined(item?.id, item?.videoId);
  if (!username || !id) return null;
  return {
    exists: true,
    username,
    nickname: firstDefined(profile?.nickname, username),
    avatar: profile?.avatar || null,
    followers: Number(profile?.followers) || 0,
    hearts: Number(profile?.hearts) || 0,
    videos: Number(profile?.videos) || 0,
    latestVideoId: String(id),
    latestVideoUrl: `https://www.tiktok.com/@${username}/video/${id}`,
    latestVideoTimestamp: Number(item?.timestamp) || videoTimestampFromId(id),
    latestVideoTitle: firstDefined(item?.title, ''),
    latestVideoThumbnail: firstUrl(item?.thumbnail),
    latestVideoPlayCount: Number(item?.playCount) || 0,
    latestVideoCommentCount: Number(item?.commentCount) || 0
  };
}

function latestBrowserVideo(items, profile) {
  const username = normalizeUsername(profile?.username);
  const unique = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const normalized = normalizeBrowserVideo(item, profile);
    if (!normalized || normalized.username !== username) continue;
    unique.set(normalized.latestVideoId, normalized);
  }
  return [...unique.values()].sort((a, b) => {
    if (a.latestVideoTimestamp !== b.latestVideoTimestamp) {
      return b.latestVideoTimestamp - a.latestVideoTimestamp;
    }
    try {
      const left = BigInt(a.latestVideoId);
      const right = BigInt(b.latestVideoId);
      return left === right ? 0 : left > right ? -1 : 1;
    } catch {
      return b.latestVideoId.localeCompare(a.latestVideoId);
    }
  })[0] || null;
}

function extractVideoLinksFromHtml(html, profile) {
  const username = normalizeUsername(profile?.username);
  const pattern = new RegExp(`https?:\\/\\/(?:www\\.)?tiktok\\.com\\/@${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/video\\/(\\d+)`, 'gi');
  const items = [];
  let match;
  const normalizedHtml = String(html || '').replace(/\\\//g, '/');
  while ((match = pattern.exec(normalizedHtml)) !== null) {
    items.push({ id: match[1], username });
  }
  return latestBrowserVideo(items, profile);
}

function browserCandidates() {
  const candidates = [CONFIG.BROWSER_PATH];
  if (process.platform === 'linux') {
    candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable');
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  } else if (process.platform === 'win32') {
    const programFiles = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    for (const root of programFiles) {
      candidates.push(
        `${root}\\Google\\Chrome\\Application\\chrome.exe`,
        `${root}\\Microsoft\\Edge\\Application\\msedge.exe`
      );
    }
  }
  try {
    candidates.push(chromium.executablePath());
  } catch {
    // La ruta administrada puede no existir si Playwright no descargó Chromium.
  }
  return [...new Set(candidates.filter(Boolean))];
}

function findBrowserExecutable() {
  return browserCandidates().find(candidate => fs.existsSync(candidate)) || null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = CONFIG.REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

class TikTokBrowserService {
  constructor() {
    this.browser = null;
    this.startPromise = null;
    this.executablePath = null;
    this.lastError = null;
    this.startedAt = null;
  }

  async ensureReady() {
    if (this.browser?.isConnected()) return this.browser;
    if (this.startPromise) return this.startPromise;

    this.startPromise = (async () => {
      this.executablePath = findBrowserExecutable();
      if (!this.executablePath) {
        throw new Error('Chromium no está instalado; define TIKTOK_BROWSER_PATH o ejecuta npx playwright install chromium');
      }
      this.browser = await chromium.launch({
        executablePath: this.executablePath,
        headless: true,
        timeout: CONFIG.BROWSER_TIMEOUT_MS,
        args: [
          ...(String(process.env.TIKTOK_BROWSER_NO_SANDBOX || 'false').toLowerCase() === 'true'
            ? ['--no-sandbox', '--disable-setuid-sandbox']
            : []),
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-gpu'
        ]
      });
      this.browser.on('disconnected', () => { this.browser = null; });
      this.startedAt = new Date().toISOString();
      this.lastError = null;
      return this.browser;
    })().catch(error => {
      this.lastError = String(error?.message || error).slice(0, 300);
      this.browser = null;
      throw error;
    }).finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  async latestVideo(profile) {
    const browser = await this.ensureReady();
    const context = await browser.newContext({
      userAgent: CONFIG.USER_AGENT,
      locale: 'es-CO',
      timezoneId: 'America/Bogota',
      viewport: { width: 1365, height: 900 },
      extraHTTPHeaders: { 'accept-language': 'es-CO,es;q=0.9,en;q=0.7' }
    });

    try {
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      });
      const page = await context.newPage();
      await page.route('**/*', route => {
        const type = route.request().resourceType();
        if (['media', 'font'].includes(type)) return route.abort();
        return route.continue();
      });

      const url = `https://www.tiktok.com/@${profile.username}`;
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.BROWSER_TIMEOUT_MS
      });
      if (response && response.status() >= 400) {
        throw new Error(`TikTok respondió HTTP ${response.status()} al navegador local`);
      }

      await page.waitForTimeout(CONFIG.PAGE_SETTLE_MS);
      await page.waitForSelector('a[href*="/video/"]', { timeout: 20_000 }).catch(() => null);
      const items = await page.evaluate(targetUsername => {
        const output = [];
        for (const anchor of document.querySelectorAll('a[href*="/video/"]')) {
          const href = anchor.href || anchor.getAttribute('href') || '';
          const match = href.match(/\/@([^/]+)\/video\/(\d+)/i);
          if (!match || match[1].toLowerCase() !== targetUsername.toLowerCase()) continue;
          const card = anchor.closest('[data-e2e*="user-post-item"], div') || anchor;
          const image = anchor.querySelector('img') || card.querySelector?.('img');
          output.push({
            id: match[2],
            username: match[1],
            title: image?.alt || anchor.getAttribute('aria-label') || anchor.title || '',
            thumbnail: image?.currentSrc || image?.src || null
          });
        }
        return output;
      }, profile.username);

      let latest = latestBrowserVideo(items, profile);
      if (!latest) latest = extractVideoLinksFromHtml(await page.content(), profile);
      if (!latest) throw new Error(`TikTok no mostró videos públicos para @${profile.username}`);
      return latest;
    } finally {
      await context.close().catch(() => {});
    }
  }

  async profile(username) {
    const browser = await this.ensureReady();
    const context = await browser.newContext({
      userAgent: CONFIG.USER_AGENT,
      locale: 'es-CO',
      timezoneId: 'America/Bogota',
      viewport: { width: 1365, height: 900 },
      extraHTTPHeaders: { 'accept-language': 'es-CO,es;q=0.9,en;q=0.7' }
    });
    try {
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      });
      const page = await context.newPage();
      await page.route('**/*', route => {
        const type = route.request().resourceType();
        if (['media', 'font', 'image'].includes(type)) return route.abort();
        return route.continue();
      });
      const response = await page.goto(`https://www.tiktok.com/@${username}/live`, {
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.BROWSER_TIMEOUT_MS
      });
      if (response && response.status() >= 400) throw new Error(`TikTok respondió HTTP ${response.status()} al navegador local`);
      await page.waitForTimeout(CONFIG.PAGE_SETTLE_MS);
      await page.waitForFunction(() => Boolean(
        document.querySelector('script#SIGI_STATE, script#__UNIVERSAL_DATA_FOR_REHYDRATION__')
      ), null, { timeout: 20_000 }).catch(() => null);
      return parseProfileHtml(await page.content(), username);
    } finally {
      await context.close().catch(() => {});
    }
  }

  async stats() {
    return {
      mode: 'integrated',
      installed: Boolean(findBrowserExecutable()),
      running: Boolean(this.browser?.isConnected()),
      ready: Boolean(this.browser?.isConnected()),
      executable: this.executablePath ? 'detected' : null,
      startedAt: this.startedAt,
      lastError: this.lastError
    };
  }

  async stop() {
    const browser = this.browser;
    this.browser = null;
    if (browser) await browser.close().catch(() => {});
  }
}

class FreeTikTokClient {
  constructor() {
    this.browser = new TikTokBrowserService();
    this.activeOperations = 0;
    this.waiters = [];
    this.nextStartAt = 0;
    this.metrics = {
      profileRequests: 0,
      videoRequests: 0,
      successes: 0,
      errors: 0,
      lastSuccess: null,
      lastError: null
    };
  }

  async queued(operation) {
    if (this.activeOperations >= CONFIG.CONCURRENCY) {
      await new Promise(resolve => this.waiters.push(resolve));
    }
    this.activeOperations++;
    const delay = Math.max(0, this.nextStartAt - Date.now());
    this.nextStartAt = Math.max(Date.now(), this.nextStartAt) + CONFIG.REQUEST_DELAY_MS;
    if (delay) await sleep(delay);
    try {
      return await operation();
    } finally {
      this.activeOperations--;
      this.waiters.shift()?.();
    }
  }

  recordSuccess() {
    this.metrics.successes++;
    this.metrics.lastSuccess = new Date().toISOString();
  }

  recordError(error) {
    this.metrics.errors++;
    this.metrics.lastError = {
      message: String(error?.message || error).slice(0, 300),
      at: new Date().toISOString()
    };
  }

  async fetchProfile(username) {
    const normalized = normalizeUsername(username);
    if (!normalized) throw new Error('Usuario TikTok vacío');
    this.metrics.profileRequests++;

    try {
      const result = await this.queued(async () => {
        const response = await fetchWithTimeout(`https://www.tiktok.com/@${normalized}/live`, {
          redirect: 'follow',
          headers: {
            'user-agent': CONFIG.USER_AGENT,
            accept: 'text/html,application/xhtml+xml',
            'accept-language': 'es-CO,es;q=0.9,en;q=0.7',
            'cache-control': 'no-cache'
          }
        });
        const html = await response.text();
        if (!response.ok) throw new Error(`TikTok respondió HTTP ${response.status} para @${normalized}`);
        try {
          return parseProfileHtml(html, normalized);
        } catch (directError) {
          // TikTok puede responder 200 con una página CAPTCHA o un HTML mínimo.
          // El navegador local es el respaldo gratuito y mantiene el resto de
          // plataformas aislado si también fuera bloqueado.
          try {
            return await this.browser.profile(normalized);
          } catch (browserError) {
            throw new Error(`Consulta pública bloqueada (${directError.message}); respaldo Chromium falló (${browserError.message})`);
          }
        }
      });
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordError(error);
      throw error;
    }
  }

  async fetchLatestVideo(username, profile = null) {
    const normalized = normalizeUsername(username);
    const resolvedProfile = profile || await this.fetchProfile(normalized);
    this.metrics.videoRequests++;

    try {
      const latest = await this.queued(() => this.browser.latestVideo(resolvedProfile));
      this.recordSuccess();
      return latest;
    } catch (error) {
      this.recordError(error);
      throw error;
    }
  }

  async stats() {
    return {
      provider: 'self_hosted',
      costUsd: 0,
      ...JSON.parse(JSON.stringify(this.metrics)),
      browser: await this.browser.stats()
    };
  }

  async stop() {
    await this.browser.stop();
  }
}

let instance = null;

function getFreeTikTokClient() {
  if (!instance) instance = new FreeTikTokClient();
  return instance;
}

function stopFreeTikTokClient() {
  if (instance) instance.stop().catch(() => {});
}

module.exports = {
  CONFIG,
  FreeTikTokClient,
  TikTokBrowserService,
  getFreeTikTokClient,
  stopFreeTikTokClient,
  parseProfileHtml,
  normalizeBrowserVideo,
  latestBrowserVideo,
  extractVideoLinksFromHtml,
  videoTimestampFromId,
  extractJsonScript,
  findBrowserExecutable
};
