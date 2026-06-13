const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_PATH = process.env.DATA_PATH || path.join(process.cwd(), 'data');
const LOGS_PATH = process.env.LOGS_PATH || path.join(process.cwd(), 'logs');

function showHelp() {
  console.log(`
🧹 LIMPIEZA DE CACHÉ

USO: node scripts/clean-cache.js [opciones]

OPCIONES:
  --all, -a       Limpiar toda la caché (por defecto)
  --youtube, -y   Limpiar solo caché de YouTube
  --twitch, -t    Limpiar solo caché de Twitch
  --tiktok, -k    Limpiar solo caché de TikTok
  --logs, -l      Limpiar logs antiguos (más de 7 días)
  --temp, -m      Limpiar archivos temporales
  --help, -h      Mostrar esta ayuda

EJEMPLOS:
  node scripts/clean-cache.js                    # Limpiar toda la caché
  node scripts/clean-cache.js --youtube          # Limpiar solo YouTube
  node scripts/clean-cache.js --logs --keep 30   # Logs de más de 30 días
  `);
}

function deleteDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`✅ Eliminado: ${dir}`);
    return true;
  }
  return false;
}

function recreateDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Recreado: ${dir}`);
  }
}

function cleanCache(type) {
  let cleaned = false;
  
  const cacheDirs = {
    youtube: path.join(DATA_PATH, 'youtube'),
    twitch: path.join(DATA_PATH, 'twitch'),
    tiktok: path.join(DATA_PATH, 'tiktok'),
    temp: path.join(DATA_PATH, 'temp'),
    server: path.join(DATA_PATH, 'server')
  };
  
  if (type === 'all') {
    console.log('\n🧹 Limpiando toda la caché...\n');
    for (const [name, dir] of Object.entries(cacheDirs)) {
      if (deleteDirectory(dir)) {
        recreateDirectory(dir);
        cleaned = true;
      }
    }
  } else if (cacheDirs[type]) {
    console.log(`\n🧹 Limpiando caché de ${type}...\n`);
    if (deleteDirectory(cacheDirs[type])) {
      recreateDirectory(cacheDirs[type]);
      cleaned = true;
    }
  }
  
  return cleaned;
}

async function cleanOldLogs(daysToKeep = 7) {
  console.log(`\n🧹 Limpiando logs de más de ${daysToKeep} días...\n`);
  
  let cleaned = 0;
  const now = Date.now();
  const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
  
  function cleanDirectory(dir) {
    if (!fs.existsSync(dir)) return 0;
    
    let count = 0;
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile() && (now - stats.mtimeMs) > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`   🗑️ Eliminado: ${file}`);
        count++;
      }
    }
    return count;
  }
  
  const logDirs = [
    path.join(LOGS_PATH, 'errors'),
    path.join(LOGS_PATH, 'monitors'),
    path.join(LOGS_PATH, 'commands')
  ];
  
  for (const dir of logDirs) {
    if (fs.existsSync(dir)) {
      const count = cleanDirectory(dir);
      if (count > 0) {
        console.log(`✅ ${path.basename(dir)}: ${count} archivos eliminados`);
      }
      cleaned += count;
    }
  }
  
  return cleaned;
}

function cleanTemp() {
  console.log('\n🧹 Limpiando archivos temporales...\n');
  
  const tempDir = path.join(DATA_PATH, 'temp');
  let cleaned = 0;
  
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      fs.unlinkSync(filePath);
      console.log(`   🗑️ Eliminado: ${file}`);
      cleaned++;
    }
    console.log(`\n✅ ${cleaned} archivos temporales eliminados`);
  } else {
    console.log('📁 No hay directorio temporal');
  }
  
  return cleaned;
}

function showStats() {
  console.log('\n📊 ESTADÍSTICAS DE CACHÉ:\n');
  
  const cacheDirs = {
    YouTube: path.join(DATA_PATH, 'youtube'),
    Twitch: path.join(DATA_PATH, 'twitch'),
    TikTok: path.join(DATA_PATH, 'tiktok'),
    Server: path.join(DATA_PATH, 'server'),
    Temp: path.join(DATA_PATH, 'temp')
  };
  
  let totalSize = 0;
  
  for (const [name, dir] of Object.entries(cacheDirs)) {
    if (fs.existsSync(dir)) {
      let size = 0;
      let fileCount = 0;
      
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        size += stats.size;
        fileCount++;
      }
      
      const sizeKB = (size / 1024).toFixed(2);
      totalSize += size;
      
      console.log(`   ${name}: ${fileCount} archivos (${sizeKB} KB)`);
    } else {
      console.log(`   ${name}: No existe`);
    }
  }
  
  console.log(`\n   📦 TOTAL: ${(totalSize / 1024).toFixed(2)} KB`);
}

// Parsear argumentos
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    type: 'all',
    logs: false,
    temp: false,
    keepDays: 7,
    stats: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--all':
      case '-a':
        options.type = 'all';
        break;
      case '--youtube':
      case '-y':
        options.type = 'youtube';
        break;
      case '--twitch':
      case '-t':
        options.type = 'twitch';
        break;
      case '--tiktok':
      case '-k':
        options.type = 'tiktok';
        break;
      case '--logs':
      case '-l':
        options.logs = true;
        if (args[i + 1] === '--keep' || args[i + 1] === '-k') {
          options.keepDays = parseInt(args[i + 2]) || 7;
          i += 2;
        }
        break;
      case '--temp':
      case '-m':
        options.temp = true;
        break;
      case '--stats':
      case '-s':
        options.stats = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
    }
  }
  
  return options;
}

// Main
async function main() {
  const options = parseArgs();
  
  console.log('🧹 LIMPIADOR DE CACHÉ DE VESPER BOT\n');
  console.log('═'.repeat(50));
  
  if (options.stats) {
    showStats();
    return;
  }
  
  if (options.logs) {
    const cleaned = await cleanOldLogs(options.keepDays);
    console.log(`\n✅ ${cleaned} archivos de log eliminados`);
  }
  
  if (options.temp) {
    cleanTemp();
  }
  
  if (!options.logs && !options.temp) {
    const cleaned = cleanCache(options.type);
    if (!cleaned) {
      console.log('\n⚠️ No se encontró caché para limpiar');
    }
  }
  
  console.log('\n✨ Limpieza completada');
}

// Ejecutar
main().catch(console.error);