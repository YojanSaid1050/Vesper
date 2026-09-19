// src/core/music/sources.js
//
// Convierte lo que escribe una persona («pon lofi», un enlace de YouTube, la
// dirección de una radio) en algo que se pueda reproducir.
//
// Aquí no hay ningún servidor aparte. La búsqueda y la extracción las hace
// yt-dlp, un programa que viene con el bot, y el audio lo transcodifica
// ffmpeg, que también viene incluido. Todo ocurre dentro del mismo proceso
// que ya corre en el alojamiento, que es justo lo que Lavalink no permitía.

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const YTDLP_TIMEOUT_MS = Math.max(5_000, Number(process.env.MUSIC_RESOLVE_TIMEOUT_MS || 30_000));

// Las direcciones que devuelve YouTube caducan. Se guardan un rato para no
// volver a preguntar por la misma canción, pero nunca más allá de esto.
const STREAM_TTL_MS = 5 * 60 * 1000;

const AUDIO_EXTENSIONS = /\.(mp3|ogg|oga|opus|m4a|aac|flac|wav|webm)(\?|$)/i;
const STREAM_HINTS = /(\/stream\b|\/listen\b|icecast|shoutcast|radio)/i;

// Se busca en este orden: lo que diga el entorno, el binario que descarga
// `npm run music:setup` dentro del proyecto, y por último el del sistema.
function ytdlpPath() {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
  const local = path.join(__dirname, '..', '..', '..', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  return fs.existsSync(local) ? local : 'yt-dlp';
}

function ffmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    return require('ffmpeg-static') || 'ffmpeg';
  } catch {
    return 'ffmpeg';
  }
}

// ¿Están las dos herramientas donde deberían? Si falta alguna, la música no
// puede funcionar y conviene decirlo antes de que alguien escriba un comando.
function toolCheck() {
  const tools = { ytdlp: ytdlpPath(), ffmpeg: ffmpegPath() };
  const missing = [];
  for (const [name, binary] of Object.entries(tools)) {
    // Un nombre suelto («yt-dlp») significa «búscalo en el PATH del sistema»:
    // no se puede comprobar aquí, se sabrá al ejecutarlo.
    if (path.isAbsolute(binary) && !fs.existsSync(binary)) missing.push(name);
    else if (!path.isAbsolute(binary) && !inPath(binary)) missing.push(name);
  }
  return { ...tools, ok: missing.length === 0, missing };
}

function inPath(binary) {
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  return dirs.some(dir => {
    try {
      fs.accessSync(path.join(dir, binary), fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function run(binary, args, { timeoutMs = YTDLP_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('La búsqueda tardó demasiado. Inténtalo otra vez.'));
    }, timeoutMs);

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk.toString().slice(0, 2000); });
    child.on('error', error => {
      clearTimeout(timer);
      reject(new Error(error.code === 'ENOENT'
        ? 'No encuentro yt-dlp. Ejecuta "npm run music:setup" en el alojamiento para descargarlo.'
        : error.message));
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) return resolve(stdout);
      reject(new Error(friendlyError(stderr) || `yt-dlp terminó con código ${code}`));
    });
  });
}

// yt-dlp escribe errores muy técnicos. Se traducen los habituales.
function friendlyError(stderr) {
  const text = String(stderr || '');
  if (/Private video|Video unavailable|This video is not available/i.test(text)) return 'Ese video es privado o no está disponible.';
  if (/Sign in to confirm|age.?restricted|confirm your age/i.test(text)) return 'Ese video pide iniciar sesión o tiene restricción de edad.';
  if (/Unable to connect to proxy|Tunnel connection failed|Network is unreachable|Temporary failure in name resolution/i.test(text)) {
    return 'El alojamiento no pudo conectarse a internet para buscar la canción.';
  }
  if (/Unsupported URL/i.test(text)) return 'No sé reproducir enlaces de ese sitio.';
  if (/No video results|no results/i.test(text)) return 'No encontré nada con esa búsqueda.';
  const firstError = text.split('\n').find(line => /^ERROR/i.test(line));
  return firstError ? firstError.replace(/^ERROR:\s*/i, '').slice(0, 200) : null;
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Un archivo de audio suelto o una radio se reproducen tal cual, sin yt-dlp.
function directAudio(query) {
  if (!isHttpUrl(query)) return null;
  const url = new URL(query);
  if (!AUDIO_EXTENSIONS.test(url.pathname) && !STREAM_HINTS.test(url.pathname + url.search)) return null;
  const name = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || url.hostname);
  return {
    title: name.replace(AUDIO_EXTENSIONS, '') || url.hostname,
    author: url.hostname,
    duration: 0,
    live: !AUDIO_EXTENSIONS.test(url.pathname),
    pageUrl: url.toString(),
    streamUrl: url.toString(),
    streamExpires: Number.POSITIVE_INFINITY,
    thumbnail: null,
    source: 'directo'
  };
}

function trackFromJson(entry) {
  if (!entry) return null;
  const id = entry.id || entry.url;
  return {
    title: entry.title || entry.fulltitle || 'Sin título',
    author: entry.uploader || entry.channel || entry.artist || entry.extractor_key || 'Desconocido',
    duration: Number(entry.duration) || 0,
    live: Boolean(entry.is_live || entry.live_status === 'is_live'),
    pageUrl: entry.webpage_url || entry.original_url || (id && `https://www.youtube.com/watch?v=${id}`) || null,
    streamUrl: null,
    streamExpires: 0,
    thumbnail: entry.thumbnail || entry.thumbnails?.at(-1)?.url || null,
    source: entry.extractor_key || 'yt-dlp'
  };
}

/**
 * Busca lo que pidió la persona y devuelve una o varias pistas.
 * Solo se piden los datos; la dirección del audio se saca justo antes de
 * sonar, porque caduca en pocos minutos.
 */
async function search(query, { limit = 1 } = {}) {
  const clean = String(query || '').trim();
  if (!clean) throw new Error('Escribe qué quieres escuchar.');

  const direct = directAudio(clean);
  if (direct) return [direct];

  const isUrl = isHttpUrl(clean);
  const isPlaylist = isUrl && /[?&]list=/.test(clean);
  const target = isUrl ? clean : `ytsearch${Math.max(1, Math.min(20, limit))}:${clean}`;

  const args = [
    '--no-warnings', '--ignore-config', '--flat-playlist', '--dump-single-json',
    '--no-check-certificates', '--extractor-args', 'youtube:player_client=android,web'
  ];
  if (!isPlaylist) args.push('--no-playlist');
  args.push(target);

  const raw = await run(ytdlpPath(), args);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('No entendí la respuesta del buscador. Inténtalo otra vez.');
  }

  const entries = Array.isArray(parsed.entries) ? parsed.entries : [parsed];
  const tracks = entries.map(trackFromJson).filter(track => track && track.pageUrl);
  if (!tracks.length) throw new Error('No encontré nada con esa búsqueda.');
  return isPlaylist ? tracks.slice(0, Math.max(1, Math.min(100, limit))) : tracks.slice(0, 1);
}

/**
 * Saca la dirección real del audio, justo antes de reproducirlo.
 */
async function resolveStream(track) {
  if (track.streamUrl && Date.now() < track.streamExpires) return track.streamUrl;
  if (!track.pageUrl) throw new Error('Esa pista no tiene un enlace válido.');

  const output = await run(ytdlpPath(), [
    '--no-warnings', '--ignore-config', '--no-playlist', '--no-check-certificates',
    '--extractor-args', 'youtube:player_client=android,web',
    '-f', 'bestaudio[acodec!=none]/bestaudio/best',
    '-g', track.pageUrl
  ]);

  const url = output.split('\n').map(line => line.trim()).find(Boolean);
  if (!url) throw new Error('No pude obtener el audio de esa pista.');
  track.streamUrl = url;
  track.streamExpires = Date.now() + STREAM_TTL_MS;
  return url;
}

/**
 * Arranca ffmpeg y devuelve un flujo de Ogg/Opus listo para Discord.
 *
 * Se transcodifica directamente a Opus, que es lo que Discord quiere, así no
 * hace falta ninguna librería nativa de codificación ni se gasta CPU de más:
 * importa, porque el bot y la música comparten la única máquina que hay.
 */
function openStream(url, { seekSeconds = 0, volume = 100, live = false } = {}) {
  const gain = Math.max(0, Math.min(200, Number(volume) || 100)) / 100;
  const args = ['-hide_banner', '-loglevel', 'error'];
  // Las emisiones largas se cortan solas y esto las reengancha, pero son
  // opciones del protocolo HTTP: si se le pasan a un archivo local, ffmpeg ni
  // siquiera abre la entrada.
  if (isHttpUrl(url)) args.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
  if (seekSeconds > 0 && !live) args.push('-ss', String(Math.floor(seekSeconds)));
  args.push(
    '-i', url,
    '-vn', '-sn', '-dn',
    '-af', `volume=${gain.toFixed(3)}`,
    '-c:a', 'libopus', '-b:a', '96k', '-ar', '48000', '-ac', '2',
    '-f', 'opus', 'pipe:1'
  );

  const child = spawn(ffmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString().slice(0, 1000); });
  child.on('error', () => { /* lo gestiona quien consume el flujo */ });
  return { process: child, stream: child.stdout, errorText: () => stderr };
}

module.exports = {
  search,
  resolveStream,
  openStream,
  directAudio,
  toolCheck,
  ytdlpPath,
  ffmpegPath,
  friendlyError,
  isHttpUrl,
  STREAM_TTL_MS
};
