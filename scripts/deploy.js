require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

// Configuración
const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.TOKEN;
const USE_GUILD_COMMANDS = process.env.USE_GUILD_COMMANDS === 'true';
const GUILD_ID = process.env.GUILD_ID;

// Validaciones
if (!CLIENT_ID || !TOKEN) {
  console.error('❌ Faltan CLIENT_ID o TOKEN en .env');
  process.exit(1);
}

if (USE_GUILD_COMMANDS && !GUILD_ID) {
  console.error('❌ Falta GUILD_ID para comandos locales');
  process.exit(1);
}

console.log('🚀 Iniciando despliegue de comandos...');
console.log(`📋 Modo: ${USE_GUILD_COMMANDS ? 'LOCAL (servidor específico)' : 'GLOBAL (todos los servidores)'}`);
if (USE_GUILD_COMMANDS) console.log(`🆔 Servidor: ${GUILD_ID}`);

// IMPORTANTE: La carpeta src está en la raíz, no dentro de scripts
const ROOT_DIR = path.join(__dirname, '..'); // Subir un nivel desde scripts/
const commandsPath = path.join(ROOT_DIR, 'src', 'commands');

console.log(`📂 Buscando comandos en: ${commandsPath}`);

if (!fs.existsSync(commandsPath)) {
  console.error('❌ Carpeta de comandos no existe:', commandsPath);
  console.error('   Estructura esperada:');
  console.error('   📁 Bot Discord/');
  console.error('   └── 📁 src/');
  console.error('       └── 📁 commands/');
  console.error('           ├── 📁 admin/');
  console.error('           ├── 📁 moderation/');
  console.error('           ├── 📁 tiktok/');
  console.error('           ├── 📁 twitch/');
  console.error('           └── 📁 youtube/');
  process.exit(1);
}

// Función recursiva para obtener archivos de comandos
function getCommandFiles(dir) {
  let results = [];
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results = results.concat(getCommandFiles(filePath));
    } else if (file.endsWith('.js') && !file.endsWith('.test.js')) {
      results.push(filePath);
    }
  }
  return results;
}

// Función para limpiar comandos inválidos
function cleanCommand(command) {
  const clean = { ...command };
  
  if (!clean.name || !clean.description) {
    throw new Error('Comando sin nombre o descripción');
  }
  
  if (clean.name.length > 32) {
    console.warn(`⚠️ Nombre muy largo: ${clean.name}, truncando...`);
    clean.name = clean.name.substring(0, 32);
  }
  
  if (clean.description.length > 100) {
    console.warn(`⚠️ Descripción muy larga en ${clean.name}, truncando...`);
    clean.description = clean.description.substring(0, 100);
  }
  
  return clean;
}

const commandFiles = getCommandFiles(commandsPath);
console.log(`📂 Encontrados ${commandFiles.length} archivos de comandos`);

const commands = [];
const failedCommands = [];

// Cargar comandos
for (const filePath of commandFiles) {
  try {
    delete require.cache[require.resolve(filePath)];
    const command = require(filePath);
    
    if (command.data && typeof command.data.toJSON === 'function') {
      const jsonCommand = command.data.toJSON();
      const cleanedCommand = cleanCommand(jsonCommand);
      commands.push(cleanedCommand);
      console.log(`✅ Comando cargado: ${cleanedCommand.name}`);
    } else {
      console.log(`⚠️ ${path.basename(filePath)} no tiene estructura válida`);
      failedCommands.push(path.basename(filePath));
    }
  } catch (error) {
    console.error(`❌ Error cargando comando: ${path.basename(filePath)}`, error.message);
    failedCommands.push(path.basename(filePath));
  }
}

if (commands.length === 0) {
  console.error('❌ No se encontraron comandos válidos para desplegar');
  process.exit(1);
}

console.log(`\n📋 Comandos a desplegar: ${commands.length}`);
commands.slice(0, 20).forEach(cmd => console.log(`   - /${cmd.name}`));
if (commands.length > 20) console.log(`   ... y ${commands.length - 20} más`);

if (failedCommands.length > 0) {
  console.log(`\n⚠️ Comandos fallidos: ${failedCommands.length}`);
  failedCommands.forEach(cmd => console.log(`   - ${cmd}`));
}

// Desplegar comandos
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    const startTime = Date.now();
    
    if (USE_GUILD_COMMANDS) {
      console.log(`\n🏠 Registrando ${commands.length} comandos en el servidor local...`);
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`✅ ${commands.length} comandos locales registrados correctamente`);
    } else {
      console.log(`\n🌍 Registrando ${commands.length} comandos globalmente...`);
      console.log('⏳ Los comandos globales pueden tardar hasta 1 hora en propagarse');
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log(`✅ ${commands.length} comandos globales registrados correctamente`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`\n✨ Despliegue completado en ${duration}ms`);
    
  } catch (error) {
    console.error('\n❌ Error registrando comandos');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
})();