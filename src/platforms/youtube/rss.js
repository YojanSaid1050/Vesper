// src/platforms/youtube/rss.js
//
// Descubrimiento de contenido nuevo por los feeds RSS públicos de YouTube.
//
// Por qué: la API de datos v3 da 10.000 unidades al día. Vigilar un canal con
// playlistItems.list + videos.list cuesta 2 unidades por consulta, y con los
// intervalos actuales sale a ~1.150 unidades diarias POR CANAL. Es decir, la
// cuota se agota con ocho o nueve canales.
//
// Los feeds RSS no consumen cuota, no necesitan clave y son los mismos que usa
// cualquier lector de noticias:
//
//   videos largos → playlist_id = UULF + <id del canal sin el UC inicial>
//   shorts        → playlist_id = UUSH + <id del canal sin el UC inicial>
//   directos      → playlist_id = UULV + <id del canal sin el UC inicial>
//
// Con esto la vigilancia sale gratis y la cuota de la API solo se gasta cuando
// aparece algo nuevo y hay que pedir sus detalles (duración, vistas, si sigue
// en directo).

const FEED_BASE = 'https://www.youtube.com/feeds/videos.xml';
const REQUEST_TIMEOUT_MS = Math.max(5_000, Number(process.env.YOUTUBE_RSS_TIMEOUT_MS || 12_000));
const USER_AGENT = 'Vesper-Bot/2.9 (+https://github.com/YojanSaid1050/Vesper)';

const PLAYLIST_PREFIX = Object.freeze({
  videos: 'UULF',
  shorts: 'UUSH',
  lives: 'UULV',
  uploads: 'UU'
});

function playlistIdFor(channelId, kind = 'uploads') {
  const id = String(channelId || '').trim();
  if (!/^UC[\w-]{20,}$/.test(id)) return null;
  const prefix = PLAYLIST_PREFIX[kind] || PLAYLIST_PREFIX.uploads;
  return `${prefix}${id.slice(2)}`;
}

function feedUrl(channelId, kind = 'uploads') {
  const playlistId = playlistIdFor(channelId, kind);
  if (!playlistId) return null;
  return `${FEED_BASE}?playlist_id=${playlistId}`;
}

// Analizador mínimo del Atom que devuelve YouTube. No se usa una librería de
// XML porque el formato es fijo y conocido, y así no se añade una dependencia
// para leer seis campos.
function decodeEntities(text) {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (match, code) => String.fromCharCode(Number(code)))
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeEntities(match[1].trim()) : null;
}

function attrValue(block, tag, attribute) {
  const match = block.match(new RegExp(`<${tag}[^>]*\\b${attribute}="([^"]*)"`));
  return match ? decodeEntities(match[1]) : null;
}

function parseFeed(xml) {
  const entries = [];
  const blocks = String(xml).split('<entry>').slice(1);

  for (const raw of blocks) {
    const block = raw.split('</entry>')[0];
    const videoId = tagValue(block, 'yt:videoId');
    if (!videoId) continue;

    const published = tagValue(block, 'published');
    entries.push({
      videoId,
      channelId: tagValue(block, 'yt:channelId'),
      title: tagValue(block, 'title') || 'Sin título',
      author: tagValue(block, 'name') || '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: attrValue(block, 'media:thumbnail', 'url'),
      description: tagValue(block, 'media:description') || '',
      publishedAt: published,
      timestamp: published ? new Date(published).getTime() : 0,
      views: Number(attrValue(block, 'media:statistics', 'views')) || 0
    });
  }

  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

async function fetchFeed(channelId, kind = 'uploads') {
  const url = feedUrl(channelId, kind);
  if (!url) throw new Error(`Identificador de canal no válido: ${channelId}`);

  const response = await fetch(url, {
    headers: { Accept: 'application/atom+xml, application/xml', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  // Un canal sin Shorts o sin directos devuelve 404 en esa lista concreta.
  // No es un fallo: simplemente no hay nada de ese tipo.
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`El feed respondió HTTP ${response.status}`);

  return parseFeed(await response.text());
}

/**
 * Devuelve los identificadores de video más recientes de un canal, separados
 * por tipo y sin gastar cuota de la API.
 */
async function latestByKind(channelId, kinds = ['videos', 'shorts', 'lives']) {
  const results = {};
  await Promise.all(kinds.map(async kind => {
    results[kind] = await fetchFeed(channelId, kind).catch(() => []);
  }));
  return results;
}

module.exports = {
  FEED_BASE,
  PLAYLIST_PREFIX,
  playlistIdFor,
  feedUrl,
  parseFeed,
  fetchFeed,
  latestByKind,
  decodeEntities
};
