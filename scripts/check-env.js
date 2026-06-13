// Script para verificar que las variables de entorno están configuradas
const requiredEnvVars = [
  'TOKEN',
  'CLIENT_ID',
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET',
  'APIFY_TOKEN',
  'YOUTUBE_API_KEY',
  'MONGODB_URI'
];

const optionalEnvVars = [
  'GUILD_ID',
  'USE_GUILD_COMMANDS',
  'PORT',
  'DEBUG',
  'LOG_ERRORS',
  'DATA_PATH',
  'LOGS_PATH'
];

console.log('🔍 Verificando variables de entorno...\n');

let missing = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ FALTA: ${envVar}`);
    missing.push(envVar);
  } else {
    const value = process.env[envVar];
    const displayValue = value.length > 20 ? `${value.substring(0, 10)}...${value.substring(value.length - 5)}` : value;
    console.log(`✅ ${envVar}: ${displayValue}`);
  }
}

console.log('\n📋 Variables opcionales:');
for (const envVar of optionalEnvVars) {
  const status = process.env[envVar] ? '✅' : '⚠️';
  const value = process.env[envVar] || 'no configurado';
  console.log(`   ${status} ${envVar}: ${value}`);
}

if (missing.length > 0) {
  console.error(`\n❌ ERROR: Faltan ${missing.length} variables requeridas`);
  console.error('   Por favor, configura estas variables en tu archivo .env');
  process.exit(1);
}

console.log('\n✨ Todas las variables requeridas están configuradas');