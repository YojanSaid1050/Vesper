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
// YouTube va de último: bloquea a casi todos los alojamientos en la nube y
// probarlo primero solo retrasaba cada canción.
const DEFAULT_ORDER = ['soundcloud', 'audius', 'youtube'];
const YOUTUBE_COOLDOWN_MS = Math.max(60_000, Number(process.env.MUSIC_YOUTUBE_COOLDOWN_MS || 30 * 60_000));
const HTTP_TIMEOUT_MS = 12_000;
// Las pistas de pago de SoundCloud solo ofrecen 30 s de muestra: se excluyen.
// Orden: MP3 progresivo, luego HLS en Opus o MP3 y, por último, el resto
// (AAC suele ir en MPEG-TS, el formato con el que algunas compilaciones de
// ffmpeg se caen).
const SOUNDCLOUD_FORMAT = ['protocol^=http', 'format_id*=opus', 'format_id*=mp3', null]
  .map(filter => `bestaudio${filter ? `[${filter}]` : ''}[format_id!*=preview]`).join('/') + '/best[format_id!*=preview]';
const STREAM_TTL_MS = sources.STREAM_TTL_MS;
// Cuántos resultados de SoundCloud se abren a la vez. Los primeros suelen ser
// los oficiales, protegidos; abrir cinco en paralelo tarda lo mismo que uno.
const SOUNDCLOUD_PARALLEL = Math.min(8, Math.max(1, Number(process.env.MUSIC_SOUNDCLOUD_PARALLEL || 5)));
// Con una fuente secundaria lista, cuánto se espera todavía a la preferida
// antes de poner la que ya está.
const PREFERRED_GRACE_MS = Math.max(0, Number(process.env.MUSIC_PREFERRED_GRACE_MS ?? 1_500));
// Lo pedido hace poco no se vuelve a buscar.
const SEARCH_CACHE_MS = 30 * 60_000;
const SEARCH_CACHE_SIZE = 200;
const searchCache = new Map();

const state = {
  youtubeBlockedUntil: 0,
  youtubeReason: null,
  lastErrors: {}
};

function providerOrder() {
  const configured = String(process.env.MUSIC_SOURCES || DEFAULT_ORDER.join(','))
    .split(',').map(item => item.trim().toLowerCase()).filter(item => KNOWN_PROVIDERS.includes(item));
  return configured.length ? [...new Set(configured)] : [...DEFAULT_ORDER];
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

// Un enlace de SoundCloud se lee entero de una vez: es una sola pista.
async function soundcloudLink(url) {
  const raw = await sources.run(sources.ytdlpPath(), [
    ...sources.COMMON_ARGS, '--ignore-errors', '--no-playlist', '-f', SOUNDCLOUD_FORMAT, '-J', url
  ]).catch(error => {
    // Con --ignore-errors, yt-dlp sale con código 1 si alguna entrada falló
    // aunque otras sí sirvan: se aprovecha lo que haya escrito.
    if (error.stderr && /^\s*\{/.test(error.stdout || '')) return error.stdout;
    throw error;
  });
  const parsed = JSON.parse(raw);
  const entries = (Array.isArray(parsed.entries) ? parsed.entries : [parsed]).filter(Boolean);
  return entries.map(entry => sources.trackFromJson(entry)).find(candidate => candidate?.streamUrl && candidate.duration > 35) || null;
}

function bestThumbnail(entry) {
  const list = entry.thumbnails || [];
  return list.find(item => item.id === 't500x500')?.url || list.at(-1)?.url || entry.thumbnail || null;
}

// Un resultado concreto de la búsqueda, ya con su audio. Devuelve null si no
// sirve: protegido, muestra de 30 s u otra canción.
async function soundcloudItem(query, position) {
  try {
    const raw = await sources.run(sources.ytdlpPath(), [
      ...sources.COMMON_ARGS, '--no-playlist', '--playlist-items', String(position),
      '-f', SOUNDCLOUD_FORMAT, '-J', `scsearch${SOUNDCLOUD_PARALLEL}:${query}`
    ]);
    const parsed = JSON.parse(raw);
    const entry = (Array.isArray(parsed.entries) ? parsed.entries : [parsed]).find(Boolean);
    const track = entry ? { ...sources.trackFromJson(entry), thumbnail: bestThumbnail(entry) } : null;
    return track?.streamUrl && track.duration > 35 && relevant(query, track) ? track : null;
  } catch (error) {
    return { failure: error };
  }
}

// Las primeras pistas de SoundCloud suelen ser las oficiales de los sellos,
// protegidas, o muestras de 30 s. En vez de abrirlas una tras otra, se abre
// cada resultado en su propio proceso a la vez y gana el primero, en el orden
// de la búsqueda, que se pueda reproducir: unos 3-4 s en vez de 7.
async function fromSoundcloud(query) {
  try {
    if (isSoundcloudUrl(query)) {
      const track = await soundcloudLink(query);
      if (!track) throw new Error('SoundCloud no tiene esa canción completa.');
      return [tagged(track, 'soundcloud')];
    }
    const items = Array.from({ length: SOUNDCLOUD_PARALLEL }, (_, index) => soundcloudItem(query, index + 1));
    let cause = null;
    for (const pending of items) {
      const result = await pending;
      if (result?.streamUrl) return [tagged(result, 'soundcloud')];
      if (result?.failure && !cause) cause = result.failure;
    }
    throw Object.assign(new Error('SoundCloud no tiene esa canción completa.'), cause ? { cause, stderr: cause.stderr } : {});
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
  // El detalle de cada fuente se guarda para el diagnóstico; a la persona
  // solo le llega la frase clara.
  return Object.assign(new Error(fallback), { causes: errors });
}

// Lanza varias búsquedas a la vez y se queda con la de más prioridad que
// responda. Si una secundaria ya tiene la canción, la preferida tiene
// PREFERRED_GRACE_MS más para contestar; si no, suena la que ya está.
function firstInOrder(tasks, graceMs = PREFERRED_GRACE_MS) {
  return new Promise((resolve, reject) => {
    const results = tasks.map(() => null);
    let done = false;
    let grace = null;
    const finish = (fn, value) => { if (done) return; done = true; if (grace) clearTimeout(grace); fn(value); };
    const settle = () => {
      if (done) return;
      for (let index = 0; index < results.length; index++) {
        const result = results[index];
        if (result?.ok) return finish(resolve, result.value);
        if (!result) {
          if (!grace && results.some((other, later) => later > index && other?.ok)) {
            grace = setTimeout(() => finish(resolve, results.find(other => other?.ok).value), graceMs);
            grace.unref?.();
          }
          return;
        }
      }
      finish(reject, results.map(result => result.error));
    };
    tasks.forEach((task, index) => task.then(
      value => { results[index] = { ok: true, value }; settle(); },
      error => { results[index] = { ok: false, error }; settle(); }
    ));
  });
}

function cacheKey(text, exclude) {
  return `${String(text).toLowerCase().replace(/\s+/g, ' ').trim()}|${[...exclude].sort().join(',')}|${providerOrder().join(',')}`;
}

function cached(key) {
  const hit = searchCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > SEARCH_CACHE_MS) { searchCache.delete(key); return null; }
  // Copias: la pista se modifica al sonar (dirección nueva, otra fuente…).
  return hit.tracks.map(track => ({ ...track }));
}

function store(key, tracks) {
  searchCache.delete(key);
  searchCache.set(key, { at: Date.now(), tracks: tracks.map(track => ({ ...track })) });
  while (searchCache.size > SEARCH_CACHE_SIZE) searchCache.delete(searchCache.keys().next().value);
}

// Busca un texto en las fuentes. Las ligeras se consultan a la vez; YouTube,
// que casi siempre bloquea a los alojamientos y es la más lenta, solo entra
// si las anteriores no la tienen (o si se configuró para ir primero).
async function searchText(text, { exclude = [] } = {}) {
  const key = cacheKey(text, exclude);
  const hit = cached(key);
  if (hit) return hit;

  const usable = providerOrder().filter(provider => !exclude.includes(provider) && (provider !== 'youtube' || youtubeAvailable()));
  const groups = [];
  for (const provider of usable) {
    const alone = provider === 'youtube';
    if (alone || !groups.length || groups.at(-1).alone) groups.push({ alone, providers: [provider] });
    else groups.at(-1).providers.push(provider);
  }

  const errors = [];
  for (const group of groups) {
    const tasks = group.providers.map(provider => SEARCHERS[provider](text).then(tracks => {
      if (!tracks.length) throw new Error('Sin resultados.');
      return tracks;
    }));
    try {
      const tracks = await firstInOrder(tasks);
      store(key, tracks);
      return tracks.map(track => ({ ...track }));
    } catch (failures) {
      (Array.isArray(failures) ? failures : [failures]).forEach((error, index) => errors.push({ provider: group.providers[index], error }));
    }
  }
  throw combinedError(errors);
}

// Un enlace de YouTube se respeta según el orden de fuentes: si YouTube va
// primero se intenta directo; si no, se lee su título y se busca en las demás,
// y YouTube solo entra como último recurso.
async function fromYoutubeLink(url, limit) {
  const playlist = /[?&]list=/.test(url) && !/[?&]v=/.test(url);
  const order = providerOrder();
  const tryYoutube = async () => {
    if (!order.includes('youtube') || !youtubeAvailable()) return null;
    try {
      return await fromYoutube(url, { limit });
    } catch (error) {
      if (!error.botCheck && !error.timedOut) throw error;
      return null;
    }
  };

  if (order[0] === 'youtube' || playlist) {
    const tracks = await tryYoutube();
    if (tracks?.length) return tracks;
    if (playlist) throw new Error('Ahora mismo no se pueden reproducir listas de YouTube. Pide las canciones por su nombre.');
  }

  const title = await titleFromLink(url).catch(() => null);
  if (title) {
    try {
      return await searchText(title, { exclude: ['youtube'] });
    } catch (error) {
      const tracks = order[0] === 'youtube' ? null : await tryYoutube();
      if (tracks?.length) return tracks;
      throw error;
    }
  }
  const tracks = order[0] === 'youtube' ? null : await tryYoutube();
  if (tracks?.length) return tracks;
  throw new Error('No pude leer ese enlace de YouTube. Escribe el nombre de la canción.');
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

  if (isYoutubeUrl(clean)) return fromYoutubeLink(clean, limit);

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
      results.push({ provider, label: PROVIDER_LABELS[provider], ok: false, ms: Date.now() - started, detail: error.message, error, botCheck: Boolean(error.botCheck) });
    }
  }
  return results;
}

function reset() {
  state.youtubeBlockedUntil = 0;
  state.youtubeReason = null;
  state.lastErrors = {};
  audiusHost = null;
  searchCache.clear();
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
  SOUNDCLOUD_FORMAT,
  firstInOrder
};
