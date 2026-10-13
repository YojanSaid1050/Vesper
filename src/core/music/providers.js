// src/core/music/providers.js
//
// De dónde sale el audio. YouTube tiene el catálogo más grande, pero bloquea
// a casi todos los centros de datos (Render incluido) con «confirma que no
// eres un bot». Los bots de música que siguen funcionando hacen lo mismo que
// aquí: sacan el título de donde sea y el audio de donde se pueda.
//
//   1. YouTube, si el alojamiento no está bloqueado.
//   2. SoundCloud, que no exige verificación a los servidores.
//   3. Audius, música completa y gratuita con API abierta.
//
// Si YouTube bloquea, se deja de intentar durante un rato (cortacircuito) para
// que nadie espere a que falle cada vez. Un enlace de YouTube o de Spotify se
// sigue aceptando: se lee su título y se busca en la siguiente fuente.

const sources = require('./sources');

const PROVIDER_LABELS = Object.freeze({ youtube: 'YouTube', soundcloud: 'SoundCloud', audius: 'Audius', directo: 'enlace directo' });
const KNOWN_PROVIDERS = ['youtube', 'soundcloud', 'audius'];
const YOUTUBE_COOLDOWN_MS = Math.max(60_000, Number(process.env.MUSIC_YOUTUBE_COOLDOWN_MS || 30 * 60_000));
const HTTP_TIMEOUT_MS = 12_000;
// Las pistas de pago de SoundCloud solo ofrecen 30 s de muestra: se excluyen.
// Se prefiere el MP3 progresivo al HLS: es más ligero de abrir y nunca pasa
// por MPEG-TS, el formato con el que algunas compilaciones de ffmpeg se caen.
const SOUNDCLOUD_FORMAT = 'bestaudio[protocol^=http][format_id!*=preview]/bestaudio[format_id!*=preview]/best[format_id!*=preview]';
const STREAM_TTL_MS = sources.STREAM_TTL_MS;

const state = {
  youtubeBlockedUntil: 0,
  youtubeReason: null,
  lastErrors: {}
};

function providerOrder() {
  const configured = String(process.env.MUSIC_SOURCES || KNOWN_PROVIDERS.join(','))
    .split(',').map(item => item.trim().toLowerCase()).filter(item => KNOWN_PROVIDERS.includes(item));
  return configured.length ? [...new Set(configured)] : [...KNOWN_PROVIDERS];
}

function youtubeAvailable() {
  return Date.now() >= state.youtubeBlockedUntil;
}

function blockYoutube(reason) {
  state.youtubeBlockedUntil = Date.now() + YOUTUBE_COOLDOWN_MS;
  state.youtubeReason = reason;
  console.warn(`[Música] YouTube bloquea al alojamiento; se usan otras fuentes durante ${Math.round(YOUTUBE_COOLDOWN_MS / 60_000)} min. ${reason}`);
}

function remember(provider, error) {
  state.lastErrors[provider] = { message: String(error?.message || error).slice(0, 220), at: Date.now() };
  const detail = String(error?.stderr || '').split('\n').find(line => /ERROR/i.test(line));
  console.warn(`[Música] ${PROVIDER_LABELS[provider] || provider} falló: ${error?.message || error}${detail ? ` | ${detail.trim().slice(0, 300)}` : ''}`);
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function hostOf(value) {
  try { return new URL(value).hostname.replace(/^www\.|^m\.|^music\./, ''); } catch { return ''; }
}

const isYoutubeUrl = value => ['youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(hostOf(value));
const isSpotifyUrl = value => hostOf(value) === 'open.spotify.com';
const isSoundcloudUrl = value => ['soundcloud.com', 'on.soundcloud.com'].includes(hostOf(value));

// Quita el ruido típico de los títulos de YouTube para buscar en otra fuente.
function cleanTitle(title) {
  return String(title || '')
    .replace(/[([【][^)\]】]*(official|oficial|v[ií]deo|audio|lyric|letra|visualizer|hd|4k|mv|m\/v)[^)\]】]*[)\]】]/gi, ' ')
    .replace(/\b(official (music )?video|video oficial|lyrics?|letra)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter(word => word.length > 1 && !['the', 'feat', 'ft', 'and', 'con', 'los', 'las', 'del'].includes(word));
}

// ¿El resultado se parece a lo que se pidió? Evita poner una canción que no
// tiene nada que ver cuando la fuente alternativa no la tiene.
function relevant(query, track) {
  const wanted = words(query);
  if (wanted.length === 0) return true;
  const found = new Set(words(`${track.title} ${track.author}`));
  const hits = wanted.filter(word => found.has(word)).length;
  return hits / wanted.length >= 0.5;
}

async function fetchJson(url, { timeoutMs = HTTP_TIMEOUT_MS } = {}) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json', 'User-Agent': 'Vesper/3 (Discord bot)' } });
  } catch (error) {
    throw new Error(error.name === 'TimeoutError' ? `${hostOf(url)} tardó demasiado en responder.` : `No se pudo conectar con ${hostOf(url)}.`);
  }
  if (!response.ok) throw new Error(`${hostOf(url)} respondió ${response.status}.`);
  return response.json();
}

// Título de un enlace sin tocar el reproductor de YouTube ni pedir claves:
// los oEmbed públicos no aplican el bloqueo anti-bot.
async function titleFromLink(url) {
  if (isYoutubeUrl(url)) {
    const data = await fetchJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    return cleanTitle(data.title) || null;
  }
  if (isSpotifyUrl(url)) {
    const data = await fetchJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    return cleanTitle(data.title) || null;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Fuentes                                                             */
/* ------------------------------------------------------------------ */

function tagged(track, provider) {
  return track ? { ...track, provider, source: PROVIDER_LABELS[provider] || track.source } : null;
}

async function fromYoutube(target, { limit = 1 } = {}) {
  try {
    const tracks = await sources.search(target, { limit });
    const first = tracks[0];
    // Se resuelve ya el audio de la primera: si YouTube bloquea, mejor
    // saberlo ahora y pasar a otra fuente que descubrirlo al reproducir.
    if (first && !first.streamUrl) await sources.resolveStream(first);
    return tracks.map(track => tagged(track, 'youtube'));
  } catch (error) {
    if (error.botCheck) blockYoutube(error.message);
    remember('youtube', error);
    throw error;
  }
}

async function fromSoundcloud(query) {
  try {
    const target = isSoundcloudUrl(query) ? query : `scsearch5:${query}`;
    const raw = await sources.run(sources.ytdlpPath(), [
      ...sources.COMMON_ARGS, '--ignore-errors', '--no-playlist', '-f', SOUNDCLOUD_FORMAT, '-J', target
    ]).catch(error => {
      // Con --ignore-errors, yt-dlp sale con código 1 si alguna entrada falló
      // aunque otras sí sirvan: se aprovecha lo que haya escrito.
      if (error.stderr && /^\s*\{/.test(error.stdout || '')) return error.stdout;
      throw error;
    });
    const parsed = JSON.parse(raw);
    const entries = (Array.isArray(parsed.entries) ? parsed.entries : [parsed]).filter(Boolean);
    const track = entries
      .map(entry => sources.trackFromJson(entry))
      .find(candidate => candidate?.streamUrl && candidate.duration > 35 && (isSoundcloudUrl(query) || relevant(query, candidate)));
    if (!track) throw new Error('SoundCloud no tiene esa canción completa.');
    return [tagged(track, 'soundcloud')];
  } catch (error) {
    remember('soundcloud', error);
    throw error;
  }
}

let audiusHost = null;
async function audiusBase() {
  if (audiusHost) return audiusHost;
  try {
    const hosts = (await fetchJson('https://api.audius.co/')).data;
    audiusHost = Array.isArray(hosts) && hosts.length ? hosts[Math.floor(Math.random() * hosts.length)] : 'https://api.audius.co';
  } catch {
    audiusHost = 'https://api.audius.co';
  }
  return audiusHost;
}

async function fromAudius(query) {
  try {
    const base = await audiusBase();
    const result = await fetchJson(`${base}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=Vesper`);
    const item = (result.data || [])
      .map(entry => ({ entry, track: { title: entry.title, author: entry.user?.name || 'Audius' } }))
      .find(({ entry, track }) => entry.id && Number(entry.duration) > 35 && relevant(query, track));
    if (!item) throw new Error('Audius no tiene esa canción.');
    const { entry } = item;
    return [{
      title: entry.title || 'Sin título',
      author: entry.user?.name || 'Audius',
      duration: Number(entry.duration) || 0,
      live: false,
      pageUrl: entry.permalink ? `https://audius.co${entry.permalink}` : `${base}/v1/tracks/${entry.id}`,
      streamUrl: `${base}/v1/tracks/${entry.id}/stream?app_name=Vesper`,
      streamExpires: Number.POSITIVE_INFINITY,
      acodec: 'mp3',
      thumbnail: entry.artwork?.['480x480'] || null,
      provider: 'audius',
      source: PROVIDER_LABELS.audius
    }];
  } catch (error) {
    audiusHost = null;
    remember('audius', error);
    throw error;
  }
}

const SEARCHERS = { youtube: fromYoutube, soundcloud: fromSoundcloud, audius: fromAudius };

function combinedError(errors, fallback = 'No encontré esa canción en ninguna fuente.') {
  if (!errors.length) return new Error(fallback);
  const detail = errors.map(({ provider, error }) => `${PROVIDER_LABELS[provider]}: ${error.message}`).join(' · ');
  return Object.assign(new Error(`${fallback} (${detail})`.slice(0, 400)), { causes: errors });
}

// Busca un texto recorriendo las fuentes en orden hasta que una responda.
async function searchText(text, { exclude = [] } = {}) {
  const errors = [];
  for (const provider of providerOrder()) {
    if (exclude.includes(provider)) continue;
    if (provider === 'youtube' && !youtubeAvailable()) continue;
    try {
      const tracks = await SEARCHERS[provider](text);
      if (tracks.length) return tracks;
    } catch (error) {
      errors.push({ provider, error });
    }
  }
  throw combinedError(errors);
}

/**
 * Convierte lo que pidió la persona en una o varias pistas listas para sonar.
 */
async function search(query, { limit = 1 } = {}) {
  const clean = String(query || '').trim();
  if (!clean) throw new Error('Escribe qué quieres escuchar.');

  const direct = sources.directAudio(clean);
  if (direct) return [{ ...direct, provider: 'directo' }];

  if (!sources.isHttpUrl(clean)) return searchText(clean);

  if (isSoundcloudUrl(clean)) return fromSoundcloud(clean);

  if (isSpotifyUrl(clean)) {
    const title = await titleFromLink(clean).catch(() => null);
    if (!title) throw new Error('No pude leer ese enlace de Spotify. Escribe el nombre de la canción.');
    return searchText(title);
  }

  if (isYoutubeUrl(clean)) {
    let youtubeError = null;
    if (youtubeAvailable()) {
      try {
        return await fromYoutube(clean, { limit });
      } catch (error) {
        youtubeError = error;
        if (!error.botCheck && !error.timedOut) throw error;
      }
    }
    if (/[?&]list=/.test(clean) && !/[?&]v=/.test(clean)) {
      throw new Error('YouTube no deja reproducir listas desde este alojamiento ahora mismo. Pide las canciones por su nombre.');
    }
    const title = await titleFromLink(clean).catch(() => null);
    if (!title) throw youtubeError || new Error('No pude leer ese enlace de YouTube.');
    return searchText(title, { exclude: ['youtube'] });
  }

  // Cualquier otro sitio que soporte yt-dlp (Bandcamp, Vimeo…).
  const tracks = await sources.search(clean, { limit });
  return tracks.map(track => tagged(track, 'otro'));
}

/**
 * Dirección del audio justo antes de sonar. `attempt` sube cuando ffmpeg no
 * pudo abrir la anterior: 1 pide una dirección nueva (o el camino completo de
 * YouTube) y 2 busca la misma canción en otra fuente.
 */
async function resolveStream(track, { attempt = 0 } = {}) {
  const provider = track.provider || 'youtube';
  if (provider === 'directo' || provider === 'audius') {
    if (attempt < 2) return track.streamUrl;
  }

  if (attempt >= 2 || (provider === 'youtube' && !youtubeAvailable() && !track.streamUrl)) {
    return switchProvider(track);
  }

  try {
    if (provider === 'soundcloud') {
      if (attempt === 0 && track.streamUrl && Date.now() < track.streamExpires) return track.streamUrl;
      const url = (await sources.run(sources.ytdlpPath(), [...sources.COMMON_ARGS, '--no-playlist', '-f', SOUNDCLOUD_FORMAT, '-g', track.pageUrl]))
        .split('\n').map(line => line.trim()).find(Boolean);
      if (!url) throw new Error('SoundCloud no devolvió el audio.');
      track.streamUrl = url;
      track.streamExpires = Date.now() + STREAM_TTL_MS;
      return url;
    }
    return await sources.resolveStream(track, { full: attempt === 1 });
  } catch (error) {
    if (error.botCheck) blockYoutube(error.message);
    remember(provider === 'otro' ? 'youtube' : provider, error);
    if (provider === 'youtube' && (error.botCheck || error.timedOut)) return switchProvider(track);
    throw error;
  }
}

// La misma canción, desde otra fuente. La pista se actualiza en sitio para
// que la cola y los mensajes reflejen de dónde suena de verdad.
async function switchProvider(track) {
  const previous = track.provider || 'youtube';
  const [replacement] = await searchText(cleanTitle(`${track.author && !/topic|vevo|desconocido/i.test(track.author) ? `${track.author} ` : ''}${track.title}`), { exclude: [previous] });
  Object.assign(track, {
    provider: replacement.provider,
    source: replacement.source,
    pageUrl: replacement.pageUrl,
    streamUrl: replacement.streamUrl,
    streamExpires: replacement.streamExpires,
    acodec: replacement.acodec,
    switchedFrom: previous
  });
  if (!track.streamUrl) return resolveStream(track);
  return track.streamUrl;
}

function canRetry(track, attempt) {
  return (track.provider || 'youtube') !== 'directo' && attempt < 2;
}

function status() {
  return {
    order: providerOrder(),
    youtubeBlocked: !youtubeAvailable(),
    youtubeBlockedUntil: state.youtubeBlockedUntil || null,
    youtubeReason: state.youtubeReason,
    cookies: Boolean(sources.youtubeCookiesFile()),
    proxy: Boolean(sources.musicProxy()),
    lastErrors: { ...state.lastErrors }
  };
}

// Prueba cada fuente por separado con una búsqueda real. Es lo que enseña
// /musica diagnostico para saber qué funciona desde el alojamiento.
async function probe(query = 'lofi hip hop') {
  const results = [];
  for (const provider of providerOrder()) {
    const started = Date.now();
    try {
      const [track] = await SEARCHERS[provider](query);
      if (provider === 'youtube' && track && !track.streamUrl) await resolveStream(track);
      results.push({ provider, label: PROVIDER_LABELS[provider], ok: true, ms: Date.now() - started, detail: track?.title || '' });
    } catch (error) {
      results.push({ provider, label: PROVIDER_LABELS[provider], ok: false, ms: Date.now() - started, detail: error.message, botCheck: Boolean(error.botCheck) });
    }
  }
  return results;
}

function reset() {
  state.youtubeBlockedUntil = 0;
  state.youtubeReason = null;
  state.lastErrors = {};
  audiusHost = null;
}

module.exports = {
  search,
  resolveStream,
  canRetry,
  status,
  probe,
  reset,
  cleanTitle,
  relevant,
  providerOrder,
  isYoutubeUrl,
  isSpotifyUrl,
  PROVIDER_LABELS,
  SOUNDCLOUD_FORMAT
};
