// src/index.js
require('dotenv').config();
const express = require('express');
const BotClient = require('./core/BotClient');
const { stopAllMonitors, getMonitorStats } = require('./platforms');
const { connectMongo, disconnectMongo, getMongoStatus } = require('./database/mongoManager');
const { mountWebDashboard } = require('./web/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Servidor web para health checks
app.get('/', (req, res) => res.json({ 
  status: 'online', 
  timestamp: new Date().toISOString(),
  bot: client?.isReady() || false,
  uptime: client?.uptime || 0
}));

function runtimeHealth() {
  const botReady = client?.isReady() || false;
  const database = getMongoStatus();
  const monitors = getMonitorStats();
  const music = client?.music?.status?.() || { configured: false, connected: false, players: 0 };
  const monitorsHealthy = monitors.every(item => !item.disabledUntil);
  const musicRequired = String(process.env.MUSIC_REQUIRED || 'false').toLowerCase() === 'true';
  const musicHealthy = !musicRequired || !music.configured || music.connected;
  const healthy = botReady && database.connected && monitorsHealthy && musicHealthy && !isShuttingDown;

  return { healthy, botReady, database, monitors, music, monitorsHealthy, musicRequired, musicHealthy };
}

app.get('/live', (req, res) => {
  const alive = !isShuttingDown;
  return res.status(alive ? 200 : 503).json({ status: alive ? 'alive' : 'stopping', uptime: client?.uptime || 0 });
});

app.get(['/health', '/ready'], (req, res) => {
  const state = runtimeHealth();

  return res.status(state.healthy ? 200 : 503).json({
    status: state.healthy ? 'ready' : 'degraded',
    bot: state.botReady,
    database: state.database,
    shuttingDown: isShuttingDown,
    uptime: client?.uptime || 0,
    monitors: state.monitors,
    monitorsHealthy: state.monitorsHealthy,
    music: state.music,
    musicRequired: state.musicRequired,
    musicHealthy: state.musicHealthy
  });
});

mountWebDashboard(app, { getClient: () => client, runtimeHealth });

const server = app.listen(PORT, () => console.log(`🌐 Web activa en puerto ${PORT}`));

let client = null;
let isShuttingDown = false;

// Función para apagado graceful
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n🛑 Recibida señal ${signal}, iniciando apagado graceful...`);
  
  console.log('📡 Deteniendo monitores...');
  stopAllMonitors();
  
  if (client && client.timers) {
    for (const timer of Object.values(client.timers)) {
      if (timer) clearInterval(timer);
    }
  }
  
  if (client && client.isReady()) {
    await client.music?.shutdown?.().catch(error => console.error('❌ Error cerrando música:', error.message));
    console.log('🤖 Desconectando bot de Discord...');
    await client.destroy();
  }
  
  await disconnectMongo().catch(error => {
    console.error('❌ Error desconectando MongoDB:', error.message);
  });

  await Promise.race([
    new Promise(resolve => server.close(resolve)),
    new Promise(resolve => setTimeout(resolve, 5000))
  ]);
  console.log('🌐 Servidor web cerrado');
  
  console.log('✅ Apagado completado. ¡Hasta luego!');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (error, promise) => {
  console.error('❌ Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  setTimeout(() => {
    if (!isShuttingDown) {
      console.error('💀 Error fatal, forzando salida...');
      process.exit(1);
    }
  }, 5000);
});

async function startBot() {
  console.log('🚀 Iniciando bot...');
  const startTime = Date.now();
  
  try {
    console.log('📡 Conectando a MongoDB...');
    await connectMongo();
    console.log('✅ Base de datos conectada');

    client = new BotClient();
    global.client = client;

    await client.initialize();
    
    if (process.env.REGISTER_COMMANDS === 'true') {
      console.log('📝 Registrando comandos globalmente...');
      await client.registerCommands();
    }
    
    const duration = Date.now() - startTime;
    console.log(`✨ Bot iniciado correctamente en ${duration}ms`);
    console.log(`🤖 Conectado como ${client.user.tag}`);
    console.log(`📡 En ${client.guilds.cache.size} servidores`);
    
  } catch (error) {
    console.error('❌ Error fatal iniciando el bot:', error);
    
    const errorMessage = String(error.message || error).toLowerCase();
    if (errorMessage.includes('mongodb') || errorMessage.includes('mongoose') || errorMessage.includes('server selection')) {
      console.log('🔄 Intentando reconectar a MongoDB en 5 segundos...');
      setTimeout(() => startBot(), 5000);
    } else {
      console.log('💀 Error fatal, saliendo...');
      process.exit(1);
    }
  }
}

function getClient() {
  return client;
}

async function restartBot() {
  console.log('🔄 Solicitando reinicio del proceso...');
  await gracefulShutdown('RESTART');
}

startBot();

module.exports = { 
  getClient: () => client,
  restartBot,
  gracefulShutdown
};
