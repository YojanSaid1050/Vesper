const path = require('path');

const DATA_PATH = process.env.DATA_PATH || path.join(process.cwd(), 'data');

function getDataPath(subpath = '') {
  return path.join(DATA_PATH, subpath);
}

function ensureDataDirectory() {
  const fs = require('fs');
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH, { recursive: true });
    console.log(`📁 Directorio de datos creado: ${DATA_PATH}`);
  }
}

// Asegurar que el directorio existe al importar
ensureDataDirectory();

module.exports = {
  DATA_PATH,
  getDataPath,
  ensureDataDirectory
};