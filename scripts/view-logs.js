const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LOGS_PATH = process.env.LOGS_PATH || path.join(process.cwd(), 'logs');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function showHelp() {
  console.log(`
📋 USO: node scripts/view-logs.js [opciones]

OPCIONES:
  --type, -t      Tipo de log (error, monitor, command, all)
  --lines, -l     Número de líneas a mostrar (default: 50)
  --follow, -f    Seguir logs en tiempo real
  --date, -d      Fecha específica (YYYY-MM-DD)
  --help, -h      Mostrar esta ayuda

EJEMPLOS:
  node scripts/view-logs.js                    # Ver últimos 50 logs de todos los tipos
  node scripts/view-logs.js --type error       # Ver solo logs de errores
  node scripts/view-logs.js --type monitor -l 100  # Ver 100 líneas de monitores
  node scripts/view-logs.js --follow           # Seguir logs en tiempo real
  node scripts/view-logs.js --date 2024-01-15  # Logs de una fecha específica
  `);
}

function getLogFiles(type, date) {
  const files = [];
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const logDirs = {
    error: path.join(LOGS_PATH, 'errors'),
    monitor: path.join(LOGS_PATH, 'monitors'),
    command: path.join(LOGS_PATH, 'commands')
  };
  
  if (type === 'all') {
    for (const [key, dir] of Object.entries(logDirs)) {
      const filePath = path.join(dir, `${targetDate}_${key}.log`);
      if (fs.existsSync(filePath)) {
        files.push({ type: key, path: filePath });
      }
    }
  } else if (logDirs[type]) {
    const filePath = path.join(logDirs[type], `${targetDate}_${type}.log`);
    if (fs.existsSync(filePath)) {
      files.push({ type: type, path: filePath });
    }
  }
  
  return files;
}

async function tailFile(filePath, lines = 50) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      resolve([]);
      return;
    }
    
    const stream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: stream });
    const fileLines = [];
    
    rl.on('line', (line) => {
      fileLines.push(line);
      if (fileLines.length > lines) {
        fileLines.shift();
      }
    });
    
    rl.on('close', () => {
      resolve(fileLines);
    });
    
    rl.on('error', reject);
  });
}

function colorizeLog(line) {
  if (line.includes('[ERROR]')) {
    return `${colors.red}${line}${colors.reset}`;
  }
  if (line.includes('[WARN]')) {
    return `${colors.yellow}${line}${colors.reset}`;
  }
  if (line.includes('[SUCCESS]')) {
    return `${colors.green}${line}${colors.reset}`;
  }
  if (line.includes('[INFO]')) {
    return `${colors.cyan}${line}${colors.reset}`;
  }
  return line;
}

async function viewLogs(options) {
  const { type = 'all', lines = 50, follow = false, date = null } = options;
  
  const logFiles = getLogFiles(type, date);
  
  if (logFiles.length === 0) {
    console.log(`📂 No se encontraron logs para ${type} en la fecha ${date || 'hoy'}`);
    return;
  }
  
  console.log(`\n📋 Mostrando ${type === 'all' ? 'todos los logs' : `logs de ${type}`} (últimas ${lines} líneas)\n`);
  console.log('─'.repeat(80));
  
  for (const file of logFiles) {
    console.log(`\n${colors.magenta}📁 ${file.type.toUpperCase()} LOGS${colors.reset}`);
    console.log(`${colors.gray}📄 ${file.path}${colors.reset}\n`);
    
    const fileLines = await tailFile(file.path, lines);
    
    if (fileLines.length === 0) {
      console.log('   (sin entradas)\n');
    } else {
      for (const line of fileLines) {
        console.log(colorizeLog(line));
      }
      console.log('');
    }
  }
  
  if (follow) {
    console.log(`${colors.yellow}📡 Siguiendo logs en tiempo real... (Ctrl+C para salir)${colors.reset}\n`);
    await followLogs(logFiles);
  }
}

async function followLogs(logFiles) {
  const fileWatchers = [];
  
  for (const file of logFiles) {
    let lastSize = 0;
    
    if (fs.existsSync(file.path)) {
      const stats = fs.statSync(file.path);
      lastSize = stats.size;
    }
    
    const watcher = setInterval(() => {
      if (!fs.existsSync(file.path)) return;
      
      const stats = fs.statSync(file.path);
      if (stats.size > lastSize) {
        const stream = fs.createReadStream(file.path, {
          start: lastSize,
          encoding: 'utf8'
        });
        
        stream.on('data', (chunk) => {
          const lines = chunk.split('\n').filter(l => l.trim());
          for (const line of lines) {
            const colorized = colorizeLog(line);
            console.log(`${colors.gray}[${file.type}]${colors.reset} ${colorized}`);
          }
        });
        
        lastSize = stats.size;
      }
    }, 1000);
    
    fileWatchers.push(watcher);
  }
  
  // Mantener el proceso vivo hasta Ctrl+C
  await new Promise(() => {});
  
  // Limpiar watchers (nunca se ejecuta por el Promise, pero está por si acaso)
  process.on('SIGINT', () => {
    for (const watcher of fileWatchers) {
      clearInterval(watcher);
    }
    console.log(`\n${colors.green}✅ Seguimiento detenido${colors.reset}`);
    process.exit(0);
  });
}

async function listAvailableLogs() {
  console.log('\n📂 Logs disponibles:\n');
  
  const types = ['error', 'monitor', 'command'];
  
  for (const type of types) {
    const dir = path.join(LOGS_PATH, type + 's');
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const logFiles = files.filter(f => f.endsWith('.log'));
      
      console.log(`${colors.cyan}📁 ${type.toUpperCase()} (${logFiles.length} archivos)${colors.reset}`);
      for (const file of logFiles.slice(-5)) {
        const stats = fs.statSync(path.join(dir, file));
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`   📄 ${file} (${sizeKB} KB)`);
      }
      if (logFiles.length > 5) {
        console.log(`   ... y ${logFiles.length - 5} más`);
      }
      console.log('');
    }
  }
}

// Parsear argumentos de línea de comandos
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    type: 'all',
    lines: 50,
    follow: false,
    date: null,
    list: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--type':
      case '-t':
        options.type = args[++i];
        break;
      case '--lines':
      case '-l':
        options.lines = parseInt(args[++i]) || 50;
        break;
      case '--follow':
      case '-f':
        options.follow = true;
        break;
      case '--date':
      case '-d':
        options.date = args[++i];
        break;
      case '--list':
        options.list = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
      default:
        if (!arg.startsWith('-')) {
          options.type = arg;
        }
    }
  }
  
  return options;
}

// Main
async function main() {
  const options = parseArgs();
  
  if (options.list) {
    await listAvailableLogs();
    return;
  }
  
  // Validar tipo
  const validTypes = ['error', 'monitor', 'command', 'all'];
  if (!validTypes.includes(options.type)) {
    console.error(`❌ Tipo inválido: ${options.type}`);
    console.log('Tipos válidos: error, monitor, command, all');
    process.exit(1);
  }
  
  // Validar fecha
  if (options.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    console.error('❌ Formato de fecha inválido. Usa YYYY-MM-DD');
    process.exit(1);
  }
  
  await viewLogs(options);
}

// Ejecutar
main().catch(console.error);