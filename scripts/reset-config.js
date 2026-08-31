const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_PATH = process.env.DATA_PATH || path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(DATA_PATH, 'server');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function resetServerConfig(guildId) {
  const configFile = path.join(CONFIG_PATH, `${guildId}.json`);
  
  if (!fs.existsSync(configFile)) {
    console.log(`❌ No existe configuración para el servidor ${guildId}`);
    return false;
  }
  
  const backupFile = path.join(CONFIG_PATH, `${guildId}.backup.${Date.now()}.json`);
  fs.copyFileSync(configFile, backupFile);
  console.log(`💾 Backup guardado en: ${backupFile}`);
  
  const defaultConfig = {
    general: {},
    dashboard: { channel: null, message: null, enabled: false },
    tiktok: { liveChannel: null, videoChannel: null, users: [], showUsers: false },
    twitch: { liveChannel: null, users: [], showUsers: false },
    youtube: { liveChannel: null, videoChannel: null, shortChannel: null, users: [], showUsers: false },
    branding: { name: null, avatar: null },
    testPanel: { activeSection: 'general' }
  };
  
  fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
  console.log(`✅ Configuración del servidor ${guildId} reseteada`);
  return true;
}

async function resetAllConfigs() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log('📁 No hay configuraciones guardadas');
    return;
  }
  
  const files = fs.readdirSync(CONFIG_PATH).filter(f => f.endsWith('.json') && !f.includes('.backup'));
  
  if (files.length === 0) {
    console.log('📁 No hay configuraciones de servidor');
    return;
  }
  
  console.log(`\n📋 Servidores con configuración (${files.length}):`);
  files.forEach(f => console.log(`   - ${f.replace('.json', '')}`));
  
  const answer = await question('\n⚠️ ¿Estás seguro de que quieres resetear TODAS las configuraciones? (yes/no): ');
  
  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Operación cancelada');
    rl.close();
    return;
  }
  
  for (const file of files) {
    const guildId = file.replace('.json', '');
    await resetServerConfig(guildId);
  }
  
  console.log('\n✨ Todas las configuraciones han sido reseteadas');
  rl.close();
}

async function main() {
  const args = process.argv.slice(2);
  const guildId = args[0];
  
  console.log('🧹 LIMPIADOR DE CONFIGURACIÓN\n');
  console.log('═'.repeat(50));
  
  if (guildId) {
    await resetServerConfig(guildId);
    rl.close();
  } else {
    await resetAllConfigs();
  }
}

main().catch(console.error);