// scripts/ensure-ytdlp.js
//
// Descarga yt-dlp, el programa que busca y extrae el audio de la música.
//
// Es un script aparte y NO PUEDE hacer fallar la instalación. La librería que
// se usaba antes descargaba este mismo binario dentro de su `postinstall`, y
// si GitHub no respondía —una red con salida restringida, un corte de un
// minuto— `npm install` terminaba con error y el despliegue entero se caía
// por no poder poner música. Aquí, si la descarga falla, se avisa y el bot
// arranca igual: lo único que no funcionará es la música, y lo dirá.

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const zlib = require('node:zlib');

const BIN_DIR = path.join(__dirname, '..', 'bin');
const TARGET = path.join(BIN_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

// `yt-dlp_linux` y `yt-dlp.exe` son autocontenidos: no necesitan Python.
const ASSET = {
  linux: 'yt-dlp_linux',
  darwin: 'yt-dlp_macos',
  win32: 'yt-dlp.exe'
}[process.platform] || 'yt-dlp';

const RELEASES = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download';
const URL = `${RELEASES}/${ASSET}`;
const TIMEOUT_MS = Number(process.env.YTDLP_DOWNLOAD_TIMEOUT_MS || 120_000);

// En Linux x64 se prefiere la versión «en carpeta» (onedir). El binario de un
// solo archivo se descomprime entero (40 MB) cada vez que se ejecuta: en el
// plan gratuito de Render, con 0,1 CPU, eso eran ~11 s solo para arrancar y
// la búsqueda de una canción agotaba el tiempo. La carpeta arranca al momento.
const ONEDIR_DIR = path.join(BIN_DIR, 'yt-dlp-onedir');
const ONEDIR_TARGET = path.join(ONEDIR_DIR, 'yt-dlp_linux');
const ONEDIR_URL = `${RELEASES}/yt-dlp_linux.zip`;
const USE_ONEDIR = process.platform === 'linux' && process.arch === 'x64';

// YouTube cambia a menudo y yt-dlp lo sigue con versiones nuevas: una copia
// de más de una semana se vuelve a descargar en el siguiente despliegue.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function download(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('demasiadas redirecciones'));
    const request = https.get(url, { timeout: TIMEOUT_MS }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        return resolve(download(response.headers.location, destination, redirects + 1));
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      const file = fs.createWriteStream(`${destination}.parcial`);
      response.pipe(file);
      file.on('finish', () => file.close(() => {
        // Solo se renombra al final: así nunca queda medio binario que
        // parezca válido y falle al ejecutarse.
        fs.renameSync(`${destination}.parcial`, destination);
        fs.chmodSync(destination, 0o755);
        resolve(destination);
      }));
      file.on('error', reject);
    });
    request.on('timeout', () => { request.destroy(new Error('la descarga tardó demasiado')); });
    request.on('error', reject);
  });
}

// Extrae un .zip sin dependencias externas: lee el directorio central y
// descomprime cada entrada (guardada o con deflate). Rechaza rutas que se
// salgan de la carpeta de destino.
function extractZip(buffer, destination) {
  const root = path.resolve(destination);
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('el zip no tiene directorio central');
  const entries = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);

  for (let index = 0; index < entries; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('zip dañado');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const mode = buffer.readUInt32LE(offset + 38) >>> 16;
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    const target = path.resolve(root, name);
    if (target !== root && !target.startsWith(root + path.sep)) throw new Error(`ruta no permitida en el zip: ${name}`);
    if (name.endsWith('/')) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    let content;
    if (method === 0) content = data;
    else if (method === 8) content = zlib.inflateRawSync(data);
    else throw new Error(`método de compresión ${method} no soportado`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, { mode: (mode & 0o777) || 0o644 });
  }
}

function isFresh(file) {
  try {
    return Date.now() - fs.statSync(file).mtimeMs < MAX_AGE_MS;
  } catch {
    return false;
  }
}

async function installOnedir() {
  const archive = path.join(BIN_DIR, 'yt-dlp_linux.zip');
  const staging = `${ONEDIR_DIR}.parcial`;
  try {
    await download(ONEDIR_URL, archive);
    fs.rmSync(staging, { recursive: true, force: true });
    extractZip(fs.readFileSync(archive), staging);
    fs.chmodSync(path.join(staging, 'yt-dlp_linux'), 0o755);
    fs.rmSync(ONEDIR_DIR, { recursive: true, force: true });
    fs.renameSync(staging, ONEDIR_DIR);
    return true;
  } finally {
    fs.rmSync(archive, { force: true });
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

async function main() {
  if (process.env.SKIP_YTDLP_DOWNLOAD === 'true') {
    console.log('🎵 Descarga de yt-dlp omitida (SKIP_YTDLP_DOWNLOAD=true).');
    return;
  }
  if (isFresh(USE_ONEDIR ? ONEDIR_TARGET : TARGET)) {
    console.log('🎵 yt-dlp ya está instalado y al día.');
    return;
  }

  fs.mkdirSync(BIN_DIR, { recursive: true });
  if (USE_ONEDIR) {
    console.log('🎵 Descargando yt-dlp (versión rápida en carpeta)…');
    try {
      await installOnedir();
      console.log(`✅ yt-dlp listo en ${path.relative(process.cwd(), ONEDIR_TARGET)}`);
      return;
    } catch (error) {
      console.warn(`⚠️  La versión en carpeta falló (${error.message}); se usa la de un solo archivo.`);
    }
  }

  console.log('🎵 Descargando yt-dlp para el reproductor de música…');
  try {
    await download(URL, TARGET);
    console.log(`✅ yt-dlp listo en ${path.relative(process.cwd(), TARGET)}`);
  } catch (error) {
    fs.rmSync(`${TARGET}.parcial`, { force: true });
    if (fs.existsSync(TARGET)) {
      console.warn(`⚠️  No se pudo actualizar yt-dlp (${error.message}); se mantiene la copia anterior.`);
      return;
    }
    console.warn(`⚠️  No se pudo descargar yt-dlp: ${error.message}`);
    console.warn('   El bot arrancará igual; solo la música quedará desactivada.');
    console.warn('   Para reintentarlo más tarde: npm run music:setup');
  }
}

if (require.main === module) {
  main().catch(error => {
    // Pase lo que pase, este script NO devuelve un código de error: hacerlo
    // tumbaría la instalación completa del bot.
    console.warn(`⚠️  Preparando yt-dlp: ${error.message}`);
  });
}

module.exports = { extractZip, ONEDIR_TARGET };
