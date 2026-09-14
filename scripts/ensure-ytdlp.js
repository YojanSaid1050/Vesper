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

const BIN_DIR = path.join(__dirname, '..', 'bin');
const TARGET = path.join(BIN_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

// `yt-dlp_linux` y `yt-dlp.exe` son autocontenidos: no necesitan Python.
const ASSET = {
  linux: 'yt-dlp_linux',
  darwin: 'yt-dlp_macos',
  win32: 'yt-dlp.exe'
}[process.platform] || 'yt-dlp';

const URL = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ASSET}`;
const TIMEOUT_MS = Number(process.env.YTDLP_DOWNLOAD_TIMEOUT_MS || 120_000);

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

async function main() {
  if (process.env.SKIP_YTDLP_DOWNLOAD === 'true') {
    console.log('🎵 Descarga de yt-dlp omitida (SKIP_YTDLP_DOWNLOAD=true).');
    return;
  }
  if (fs.existsSync(TARGET)) {
    console.log('🎵 yt-dlp ya está instalado.');
    return;
  }

  fs.mkdirSync(BIN_DIR, { recursive: true });
  console.log('🎵 Descargando yt-dlp para el reproductor de música…');
  try {
    await download(URL, TARGET);
    console.log(`✅ yt-dlp listo en ${path.relative(process.cwd(), TARGET)}`);
  } catch (error) {
    fs.rmSync(`${TARGET}.parcial`, { force: true });
    console.warn(`⚠️  No se pudo descargar yt-dlp: ${error.message}`);
    console.warn('   El bot arrancará igual; solo la música quedará desactivada.');
    console.warn('   Para reintentarlo más tarde: npm run music:setup');
  }
}

main().catch(error => {
  // Pase lo que pase, este script NO devuelve un código de error: hacerlo
  // tumbaría la instalación completa del bot.
  console.warn(`⚠️  Preparando yt-dlp: ${error.message}`);
});
