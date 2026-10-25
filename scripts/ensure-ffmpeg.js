// scripts/ensure-ffmpeg.js
//
// Comprueba que ffmpeg pueda leer MPEG-TS, el formato de muchas emisiones
// HLS (SoundCloud entre ellas). El ffmpeg de `ffmpeg-static` es una
// compilación estática que en algunos sistemas se cae (SIGSEGV) al leerlo:
// la canción se encontraba pero no llegaba a sonar.
//
// Si falla, se descarga la compilación de BtbN (la de los builds oficiales
// de FFmpeg en GitHub), se deja solo lo necesario y se verifica. Igual que
// con yt-dlp, NUNCA hace fallar la instalación.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { download } = require('./ensure-ytdlp');

const BIN_DIR = path.join(__dirname, '..', 'bin');
const TARGET_DIR = path.join(BIN_DIR, 'ffmpeg-btbn');
const TARGET = path.join(TARGET_DIR, 'bin', 'ffmpeg');
// BtbN publica la misma compilación para Intel/AMD (linux64) y para ARM
// (linuxarm64), que es lo que dan los servidores gratis de Oracle Cloud.
function btbnUrl(arch = process.arch) {
  const target = arch === 'arm64' ? 'linuxarm64' : 'linux64';
  return `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-${target}-lgpl-shared.tar.xz`;
}
const URL = btbnUrl();
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function bundledFfmpeg() {
  try {
    const bundled = require('ffmpeg-static');
    return bundled && fs.existsSync(bundled) ? bundled : null;
  } catch {
    return null;
  }
}

// Codifica un segundo de audio en MPEG-TS y lo vuelve a leer.
function readsMpegTs(binary) {
  if (!binary) return false;
  const encoded = spawnSync(binary, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=duration=1', '-c:a', 'aac', '-f', 'mpegts', 'pipe:1'], { maxBuffer: 8 * 1024 * 1024, timeout: 20_000 });
  if (encoded.status !== 0 || !encoded.stdout?.length) return false;
  const decoded = spawnSync(binary, ['-hide_banner', '-loglevel', 'error', '-f', 'mpegts', '-i', 'pipe:0', '-c:a', 'libopus', '-f', 'opus', 'pipe:1'], { input: encoded.stdout, maxBuffer: 8 * 1024 * 1024, timeout: 20_000 });
  return decoded.status === 0 && decoded.stdout?.length > 0;
}

function isFresh(file) {
  try { return Date.now() - fs.statSync(file).mtimeMs < MAX_AGE_MS; } catch { return false; }
}

async function installBtbn() {
  const archive = path.join(BIN_DIR, 'ffmpeg-btbn.tar.xz');
  const staging = `${TARGET_DIR}.parcial`;
  try {
    await download(URL, archive);
    fs.rmSync(staging, { recursive: true, force: true });
    fs.mkdirSync(staging, { recursive: true });
    // Node no trae descompresor xz: se usa el tar del sistema.
    const tar = spawnSync('tar', ['-xJf', archive, '-C', staging, '--strip-components=1'], { timeout: 300_000 });
    if (tar.status !== 0) throw new Error(`tar no pudo descomprimir (${String(tar.stderr || tar.error?.message || '').trim().slice(0, 120)})`);
    // Solo hace falta el ejecutable y sus bibliotecas.
    for (const extra of ['bin/ffplay', 'bin/ffprobe', 'include', 'doc', 'man', 'lib/pkgconfig']) {
      fs.rmSync(path.join(staging, extra), { recursive: true, force: true });
    }
    if (!readsMpegTs(path.join(staging, 'bin', 'ffmpeg'))) throw new Error('la compilación descargada tampoco lee MPEG-TS');
    fs.rmSync(TARGET_DIR, { recursive: true, force: true });
    fs.renameSync(staging, TARGET_DIR);
  } finally {
    fs.rmSync(archive, { force: true });
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

async function main() {
  if (process.env.FFMPEG_PATH || process.env.SKIP_FFMPEG_DOWNLOAD === 'true') return;
  if (process.platform !== 'linux' || !['x64', 'arm64'].includes(process.arch)) return;
  if (fs.existsSync(TARGET) && isFresh(TARGET) && readsMpegTs(TARGET)) {
    console.log('🎚️  ffmpeg alternativo ya instalado.');
    return;
  }
  if (readsMpegTs(bundledFfmpeg())) {
    console.log('🎚️  ffmpeg incluido lee MPEG-TS correctamente.');
    return;
  }
  console.log('🎚️  El ffmpeg incluido no lee MPEG-TS en este sistema; descargando una compilación compatible…');
  try {
    await installBtbn();
    console.log(`✅ ffmpeg listo en ${path.relative(process.cwd(), TARGET)}`);
  } catch (error) {
    console.warn(`⚠️  No se pudo preparar el ffmpeg alternativo: ${error.message}`);
    console.warn('   La música funciona con formatos directos (MP3/WebM); las emisiones HLS pueden fallar.');
  }
}

if (require.main === module) {
  main().catch(error => console.warn(`⚠️  Preparando ffmpeg: ${error.message}`));
}

module.exports = { readsMpegTs, btbnUrl, TARGET };
