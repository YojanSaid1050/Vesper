const fs = require('fs');
const path = require('path');

// Configuración
const DATA_PATH = process.env.DATA_PATH || path.join(process.cwd(), 'data');
const LOGS_PATH = process.env.LOGS_PATH || path.join(process.cwd(), 'logs');

// Directorios a crear
const directories = [
  // Directorio principal
  DATA_PATH,
  
  // Directorios de caché
  path.join(DATA_PATH, 'server'),
  path.join(DATA_PATH, 'youtube'),
  path.join(DATA_PATH, 'twitch'),
  path.join(DATA_PATH, 'tiktok'),
  
  // Directorios adicionales
  path.join(DATA_PATH, 'temp'),
  path.join(DATA_PATH, 'backups'),
  
  // Directorios de logs
  LOGS_PATH,
  path.join(LOGS_PATH, 'errors'),
  path.join(LOGS_PATH, 'monitors'),
  path.join(LOGS_PATH, 'commands'),
  
  // Directorios de configuración
  path.join(process.cwd(), 'config'),
  path.join(process.cwd(), 'temp')
];

console.log('📁 Creando estructura de directorios...');
console.log(`📂 Ruta de datos: ${DATA_PATH}`);
console.log(`📂 Ruta de logs: ${LOGS_PATH}`);
console.log('');

// Crear directorios
let created = 0;
let existing = 0;

for (const dir of directories) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ CREADO: ${dir}`);
      created++;
    } catch (error) {
      console.error(`❌ ERROR al crear ${dir}:`, error.message);
    }
  } else {
    console.log(`📁 EXISTE: ${dir}`);
    existing++;
  }
}

// Crear archivo .gitkeep para mantener directorios vacíos
const gitkeepPath = path.join(DATA_PATH, '.gitkeep');
if (!fs.existsSync(gitkeepPath)) {
  fs.writeFileSync(gitkeepPath, '# Directorio de datos de Vesper Bot\n# Este archivo mantiene el directorio en el repositorio\n');
  console.log(`📄 CREADO: ${gitkeepPath}`);
}

// Crear archivo README en data
const readmePath = path.join(DATA_PATH, 'README.md');
if (!fs.existsSync(readmePath)) {
  const readmeContent = `# Directorio de Datos de Vesper Bot

Este directorio almacena los datos de caché y estado del bot.

## Estructura

- \`/server/\` - Configuración por servidor
- \`/youtube/\` - Caché de monitoreo de YouTube
- \`/twitch/\` - Caché de monitoreo de Twitch
- \`/tiktok/\` - Caché de monitoreo de TikTok
- \`/temp/\` - Archivos temporales
- \`/backups/\` - Copias de seguridad

## Nota

Este directorio es ignorado por git (excepto este archivo).
Los datos aquí son generados automáticamente por el bot.
`;
  fs.writeFileSync(readmePath, readmeContent);
  console.log(`📄 CREADO: ${readmePath}`);
}

// Crear archivo .gitignore en logs
const gitignorePath = path.join(LOGS_PATH, '.gitignore');
if (!fs.existsSync(gitignorePath)) {
  fs.writeFileSync(gitignorePath, `# Ignorar todos los logs
*.log
*.json
!README.md
`);
  console.log(`📄 CREADO: ${gitignorePath}`);
}

// Resumen
console.log('');
console.log('📊 RESUMEN DE CREACIÓN:');
console.log(`   ✅ Directorios creados: ${created}`);
console.log(`   📁 Directorios existentes: ${existing}`);
console.log(`   📂 Total: ${directories.length} directorios`);
console.log('');
console.log('✅ Estructura de directorios lista para usar');

// Mostrar variables de entorno recomendadas
console.log('');
console.log('💡 RECOMENDACIONES:');
console.log('   Agrega estas variables a tu .env para personalizar:');
console.log('   DATA_PATH=./data');
console.log('   LOGS_PATH=./logs');
console.log('   DEBUG=false');
console.log('   LOG_ERRORS=true');