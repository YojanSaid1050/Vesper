const fs = require('fs');
const path = require('path');

const DATA_PATH = process.env.DATA_PATH || path.join(process.cwd(), 'data');

const dirs = [
  DATA_PATH,
  path.join(DATA_PATH, 'server'),
  path.join(DATA_PATH, 'youtube'),
  path.join(DATA_PATH, 'twitch'),
  path.join(DATA_PATH, 'tiktok')
];

console.log('📁 Creando estructura de datos en:', DATA_PATH);

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Creada: ${dir}`);
  }
}

console.log('✅ Estructura de datos lista');