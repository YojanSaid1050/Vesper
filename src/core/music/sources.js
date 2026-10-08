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

const YTDLP_TIMEOUT_MS = Math.max(5_000, Number(process.env.MUSIC_RESOLVE_TIMEOUT_MS || 45_000));
// El camino completo resuelve el reto JavaScript de YouTube con Node. La
// primera vez, con poca CPU, puede tardar bastante; después queda en caché.
// Matarlo antes de terminar impedía que la caché llegara a escribirse y cada
// intento volvía a empezar de cero.
const FULL_TIMEOUT_MS = Math.max(YTDLP_TIMEOUT_MS, Number(process.env.MUSIC_FULL_RESOLVE_TIMEOUT_MS || 120_000));

// Las direcciones que devuelve YouTube caducan. Se guardan un rato para no
// volver a preguntar por la misma canción, pero nunca más allá de esto.
const STREAM_TTL_MS = 5 * 60 * 1000;

const AUDIO_EXTENSIONS = /\.(mp3|ogg|oga|opus|m4a|aac|flac|wav|webm)(\?|$)/i;
const STREAM_HINTS = /(\/stream\b|\/listen\b|icecast|shoutcast|radio)/i;
const AUDIO_FORMAT = 'bestaudio[acodec!=none]/bestaudio/best';
const CACHE_DIR = path.join(process.env.DATA_PATH || path.join(__dirname, '..', '..', '..', 'data'), 'yt-dlp-cache');
const COMMON_ARGS = Object.freeze(['--no-warnings', '--ignore-config', '--no-check-certificates', '--cache-dir', CACHE_DIR]);

// Camino rápido. El cliente `visionos` de YouTube entrega el audio sin pedir
// el reproductor JavaScript (~3 MB) ni resolver su reto, que es lo que más
// CPU consume: con 0,1 CPU eso solo ya superaba el tiempo de espera.
const FAST_ARGS = Object.freeze([
  ...COMMON_ARGS,
  '--extractor-args', 'youtube:player_client=visionos'
]);

// Camino completo, de respaldo si el rápido falla. Desde yt-dlp 2025.11
// YouTube requiere un runtime JS externo. El bot ya corre sobre Node 24, pero
// yt-dlp no lo habilita automáticamente.
const YTDLP_BASE_ARGS = Object.freeze([...COMMON_ARGS, '--js-runtimes', `node:${process.execPath}`]);

// Se busca en este orden: lo que diga el entorno, el binario que descarga
// `npm run music:setup` dentro del proyecto, y por último el del sistema.
// La versión en carpeta (la que instala `npm run music:setup` en Linux x64)
// va primero porque arranca mucho más rápido que la de un solo archivo.
function ytdlpPath() {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
  const bin = path.join(__dirname, '..', '..', '..', 'bin');
  const onedir = path.join(bin, 'yt-dlp-onedir', 'yt-dlp_linux');
  if (process.platform === 'linux' && fs.existsSync(onedir)) return onedir;
  const local = path.join(bin, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  return fs.existsSync(local) ? local : 'yt-dlp';
}

// `ffmpeg-static` devuelve la ruta aunque su `install` no haya descargado el
// binario (pasa con `npm ci --ignore-scripts`). En ese caso se usa el del
// sistema en vez de apuntar a un archivo que no existe.
function ffmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const bundled = require('ffmpeg-static');
    return bundled && fs.existsSync(bundled) ? bundled : 'ffmpeg';
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

function run(binary, args, { timeoutMs = YTDLP_TIMEOUT_MS, timeoutMessage = 'La búsqueda tardó demasiado. Inténtalo otra vez.' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(Object.assign(new Error(timeoutMessage), { timedOut: true }));
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
  const streamUrl = entry.requested_downloads?.[0]?.url || (entry.formats ? entry.url : null) || null;
  return {
    title: entry.title || entry.fulltitle || 'Sin título',
    author: entry.uploader || entry.channel || entry.artist || entry.extractor_key || 'Desconocido',
    duration: Number(entry.duration) || 0,
    live: Boolean(entry.is_live || entry.live_status === 'is_live'),
    pageUrl: entry.webpage_url || entry.original_url || (id && `https://www.youtube.com/watch?v=${id}`) || null,
    streamUrl,
    streamExpires: streamUrl ? Date.now() + STREAM_TTL_MS : 0,
    acodec: entry.acodec || null,
    thumbnail: entry.thumbnail || entry.thumbnails?.at(-1)?.url || null,
    source: entry.extractor_key || 'yt-dlp'
  };
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('No entendí la respuesta del buscador. Inténtalo otra vez.');
  }
}

function tracksFrom(parsed) {
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [parsed];
  return entries.map(trackFromJson).filter(track => track && track.pageUrl);
}

// Busca y saca la dirección del audio en una sola llamada a yt-dlp. Antes
// eran dos procesos por canción (buscar y luego resolver), y en un
// alojamiento con poca CPU cada arranque cuenta.
async function searchAndResolve(target) {
  const raw = await run(ytdlpPath(), [...FAST_ARGS, '--no-playlist', '-f', AUDIO_FORMAT, '-J', target]);
  const [track] = tracksFrom(parseJson(raw));
  if (track) track.resolvedWith = 'fast';
  return track || null;
}

/**
 * Busca lo que pidió la persona y devuelve una o varias pistas.
 * Para una sola canción se intenta traer ya la dirección del audio; si ese
 * camino rápido falla, se busca solo el título y el audio se resuelve justo
 * antes de sonar con el camino completo.
 */
async function search(query, { limit = 1 } = {}) {
  const clean = String(query || '').trim();
  if (!clean) throw new Error('Escribe qué quieres escuchar.');

  const direct = directAudio(clean);
  if (direct) return [direct];

  const isUrl = isHttpUrl(clean);
  const isPlaylist = isUrl && /[?&]list=/.test(clean);
  const target = isUrl ? clean : `ytsearch${Math.max(1, Math.min(20, limit))}:${clean}`;

  let fastError = null;
  if (!isPlaylist) {
    try {
      const track = await searchAndResolve(isUrl ? clean : `ytsearch1:${clean}`);
      if (track?.streamUrl) return [track];
    } catch (error) {
      // Un video privado o inexistente no se arregla con el camino completo.
      if (!error.timedOut && /privado|no está disponible|iniciar sesión|No sé reproducir/.test(error.message)) throw error;
      fastError = error;
    }
  }

  const args = [...COMMON_ARGS, '--flat-playlist', '--dump-single-json'];
  if (!isPlaylist) args.push('--no-playlist');
  args.push(target);

  const tracks = tracksFrom(parseJson(await run(ytdlpPath(), args)));
  if (!tracks.length) throw fastError || new Error('No encontré nada con esa búsqueda.');
  for (const track of tracks) track.fastFailed = Boolean(fastError);
  return isPlaylist ? tracks.slice(0, Math.max(1, Math.min(100, limit))) : tracks.slice(0, 1);
}

async function resolveWith(args, track, options) {
  const output = await run(ytdlpPath(), [...args, '--no-playlist', '-f', AUDIO_FORMAT, '-g', track.pageUrl], options);
  return output.split('\n').map(line => line.trim()).find(Boolean) || null;
}

/**
 * Saca la dirección real del audio, justo antes de reproducirlo. Primero el
 * camino rápido y, si falla o ya falló antes con esta pista, el completo.
 * `{ full: true }` fuerza el completo (cuando YouTube rechazó la dirección
 * que dio el rápido).
 */
async function resolveStream(track, { full = false } = {}) {
  if (!full && track.streamUrl && Date.now() < track.streamExpires) return track.streamUrl;
  if (!track.pageUrl) throw new Error('Esa pista no tiene un enlace válido.');

  let url = null;
  let mode = 'fast';
  if (!full && !track.fastFailed) {
    url = await resolveWith(FAST_ARGS, track).catch(error => {
      if (!error.timedOut && /privado|no está disponible|iniciar sesión/.test(error.message)) throw error;
      return null;
    });
  }
  if (!url) {
    mode = 'full';
    url = await resolveWith(YTDLP_BASE_ARGS, track, {
      timeoutMs: FULL_TIMEOUT_MS,
      timeoutMessage: 'Preparar el audio tardó demasiado. Vuelve a intentarlo en un momento: la siguiente vez será más rápido.'
    });
  }
  if (!url) throw new Error('No pude obtener el audio de esa pista.');
  track.streamUrl = url;
  track.streamExpires = Date.now() + STREAM_TTL_MS;
  track.resolvedWith = mode;
  return url;
}

/**
 * Arranca ffmpeg y devuelve un flujo de Ogg/Opus listo para Discord.
 *
 * Se transcodifica directamente a Opus, que es lo que Discord quiere, así no
 * hace falta ninguna librería nativa de codificación ni se gasta CPU de más:
 * importa, porque el bot y la música comparten la única máquina que hay.
 */
function openStream(url, { seekSeconds = 0, volume = 100, live = false, codec = null } = {}) {
  const gain = Math.max(0, Math.min(200, Number(volume) || 100)) / 100;
  // Si el original ya es Opus y no hay que tocar el volumen, basta con
  // reempaquetarlo: recodificar consume ~1/3 de la CPU del plan gratuito.
  const passthrough = gain === 1 && !live && codec === 'opus';
  const args = ['-hide_banner', '-loglevel', 'error'];
  // Las emisiones largas se cortan solas y esto las reengancha, pero son
  // opciones del protocolo HTTP: si se le pasan a un archivo local, ffmpeg ni
  // siquiera abre la entrada.
  if (isHttpUrl(url)) args.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
  if (seekSeconds > 0 && !live) args.push('-ss', String(Math.floor(seekSeconds)));
  args.push(
    '-i', url,
    '-vn', '-sn', '-dn',
    ...(passthrough
      ? ['-c:a', 'copy']
      : ['-af', `volume=${gain.toFixed(3)}`, '-c:a', 'libopus', '-b:a', '96k', '-ar', '48000', '-ac', '2']),
    '-f', 'opus', 'pipe:1'
  );

  const child = spawn(ffmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString().slice(0, 1000); });
  child.on('error', () => { /* lo gestiona quien consume el flujo */ });
  return { process: child, stream: child.stdout, errorText: () => stderr };
}

// Espera a que ffmpeg entregue el primer audio. Si se cierra antes —YouTube
// rechazó la dirección, el formato no sirve— devuelve false para poder
// reintentar en vez de mandar a Discord un flujo vacío.
function waitForAudio(handle, timeoutMs = 20_000) {
  return new Promise(resolve => {
    let timer = null;
    const done = ok => {
      clearTimeout(timer);
      handle.stream.off('readable', onReadable);
      handle.process.off('close', onClose);
      resolve(ok);
    };
    const onReadable = () => { if (handle.stream.readableLength > 0) done(true); };
    const onClose = () => done(handle.stream.readableLength > 0);
    timer = setTimeout(() => done(true), timeoutMs);
    handle.stream.on('readable', onReadable);
    handle.process.once('close', onClose);
  });
}

function friendlyFfmpegError(stderr) {
  const text = String(stderr || '');
  if (/403 Forbidden|Server returned 403/i.test(text)) return 'El enlace de audio caducó o YouTube lo rechazó; vuelve a pedir la canción.';
  if (/404 Not Found/i.test(text)) return 'La fuente de audio ya no está disponible.';
  if (/Invalid data found|could not find codec parameters/i.test(text)) return 'El formato de audio no es compatible.';
  if (/Connection timed out|Network is unreachable|Temporary failure/i.test(text)) return 'Se perdió la conexión con la fuente de audio.';
  return text.split('\n').find(line => line.trim())?.trim().slice(0, 220) || 'ffmpeg no pudo reproducir el audio.';
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
  friendlyFfmpegError,
  waitForAudio,
  isHttpUrl,
  STREAM_TTL_MS,
  YTDLP_BASE_ARGS,
  FAST_ARGS,
  CACHE_DIR
};
