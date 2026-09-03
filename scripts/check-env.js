// Script para verificar que las variables de entorno están configuradas
require('dotenv').config();
const requiredEnvVars = [
  'TOKEN',
  'CLIENT_ID',
  'MONGODB_URI'
];

const optionalEnvVars = [
  'GUILD_ID',
  'MAIN_GUILD_ID',
  'APPROVED_GUILD_IDS',
  'BOT_OWNER_IDS',
  'SOCIAL_MANAGER_ROLE_IDS',
  'MODERATOR_ROLE_IDS',
  'MUSIC_DJ_ROLE_IDS',
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET',
  'YOUTUBE_API_KEY',
  'USE_GUILD_COMMANDS',
  'PORT',
  'DEBUG',
  'LOG_ERRORS',
  'DATA_PATH',
  'LOGS_PATH',
  'MONITOR_ERROR_COOLDOWN_MS',
  'TIKTOK_ENABLED',
  'TIKTOK_LIVE_INTERVAL_MINUTES',
  'TIKTOK_VIDEO_INTERVAL_MINUTES',
  'TIKTOK_LIVE_CACHE_MINUTES',
  'TIKTOK_VIDEO_CACHE_MINUTES',
  'TIKTOK_CONCURRENCY',
  'TIKTOK_REQUEST_DELAY_MS',
  'TIKTOK_REQUEST_TIMEOUT_MS',
  'TIKTOK_BROWSER_TIMEOUT_MS',
  'TIKTOK_PAGE_SETTLE_MS',
  'TIKTOK_BROWSER_PATH',
  'NOTIFICATION_HISTORY_DAYS',
  'LAVALINK_URL',
  'LAVALINK_PASSWORD'
];

const sensitiveEnvVars = new Set([
  'TOKEN',
  'MONGODB_URI',
  'TWITCH_CLIENT_SECRET',
  'YOUTUBE_API_KEY',
  'LAVALINK_PASSWORD'
]);

function displayValue(envVar, value) {
  if (!value) return 'no configurado';
  if (!sensitiveEnvVars.has(envVar)) return value;
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

console.log('🔍 Verificando variables de entorno...\n');

let missing = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ FALTA: ${envVar}`);
    missing.push(envVar);
  } else {
    const value = process.env[envVar];
    console.log(`✅ ${envVar}: ${displayValue(envVar, value)}`);
  }
}

if (!process.env.MAIN_GUILD_ID && !process.env.GUILD_ID) {
  console.error('❌ FALTA: MAIN_GUILD_ID (o GUILD_ID como compatibilidad)');
  missing.push('MAIN_GUILD_ID');
}

console.log('\n📋 Variables opcionales:');
for (const envVar of optionalEnvVars) {
  const status = process.env[envVar] ? '✅' : '⚠️';
  console.log(`   ${status} ${envVar}: ${displayValue(envVar, process.env[envVar])}`);
}

if (missing.length > 0) {
  console.error(`\n❌ ERROR: Faltan ${missing.length} variables requeridas`);
  console.error('   Por favor, configura estas variables en tu archivo .env');
  process.exit(1);
}

console.log('\n✨ Todas las variables requeridas están configuradas');
