// src/index.js
require('dotenv').config();
const express = require('express');
const BotClient = require('./core/BotClient');
const { startAllMonitors, stopAllMonitors } = require('./platforms');
const { connectMongo } = require('./database/mongoManager');
const { updateDashboard } = require('./dashboard/updater');

const app = express();
const PORT = process.env.PORT || 3000;

// Servidor web para health checks
app.get('/', (req, res) => res.json({ 
  status: 'online', 
  timestamp: new Date().toISOString(),
  bot: client?.isReady() || false,
  uptime: client?.uptime || 0
}));

app.get('/health', (req, res) => res.json({ 
  status: 'healthy',
  bot: client?.isReady() || false,
  uptime: client?.uptime || 0,
  monitors: client?.monitorsStats || {}
}));

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
    console.log('🤖 Desconectando bot de Discord...');
    await client.destroy();
  }
  
  server.close(() => {
    console.log('🌐 Servidor web cerrado');
  });
  
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
    
    console.log('🔧 Actualizando dashboards...');
    try {
      const result = await updateDashboard(client);
      console.log(`✅ Dashboards actualizados: ${result.updated} servidores`);
    } catch (error) {
      console.error('❌ Error actualizando dashboards:', error);
    }
    
    console.log('🚀 Iniciando monitores...');
    startAllMonitors(client);
    
    const duration = Date.now() - startTime;
    console.log(`✨ Bot iniciado correctamente en ${duration}ms`);
    console.log(`🤖 Conectado como ${client.user.tag}`);
    console.log(`📡 En ${client.guilds.cache.size} servidores`);
    
    client.user.setPresence({
      activities: [{ 
        name: 'the embers beyond the void', 
        type: 4,
      }],
      status: 'dnd'
    });
    
  } catch (error) {
    console.error('❌ Error fatal iniciando el bot:', error);
    
    if (error.message?.includes('MongoDB') || error.message?.includes('mongoose')) {
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
  console.log('🔄 Reiniciando bot...');
  await gracefulShutdown('RESTART');
  setTimeout(() => startBot(), 2000);
}

startBot();

module.exports = { 
  getClient: () => client,
  restartBot,
  gracefulShutdown
};