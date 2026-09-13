// src/index.js
require('dotenv').config();
const express = require('express');
const BotClient = require('./core/BotClient');
const { stopAllMonitors, getMonitorStats } = require('./platforms');
const { connectMongo, disconnectMongo, getMongoStatus } = require('./database/mongoManager');
const { mountWebDashboard } = require('./web/routes');
const { buildRuntimeHealth, mountHealthRoutes } = require('./web/health');

let client = null;
let isShuttingDown = false;
let retryTimer = null;

const app = express();
const PORT = process.env.PORT || 3000;

const runtimeHealth = buildRuntimeHealth({
  getClient: () => client,
  getMongoStatus,
  getMonitorStats,
  isShuttingDown: () => isShuttingDown
});

mountHealthRoutes(app, { runtimeHealth, getClient: () => client, isShuttingDown: () => isShuttingDown });

mountWebDashboard(app, { getClient: () => client, runtimeHealth });

const server = app.listen(PORT, () => console.log(`🌐 Web activa en puerto ${PORT}`));

// Función para apagado graceful
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 Recibida señal ${signal}, iniciando apagado graceful...`);

  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  console.log('📡 Deteniendo monitores...');
  stopAllMonitors();

  if (client && client.timers) {
    for (const timer of Object.values(client.timers)) {
      if (timer) clearInterval(timer);
    }
  }

  if (client && client.isReady()) {
    await Promise.resolve(client.music?.shutdown?.()).catch(error => console.error('❌ Error cerrando música:', error.message));
    console.log('🤖 Desconectando bot de Discord...');
    await client.destroy().catch(error => console.error('❌ Error cerrando el cliente de Discord:', error.message));
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

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // El proceso queda en un estado indeterminado: se cierra ordenadamente y el
  // alojamiento lo reinicia. Un margen corto permite vaciar los logs.
  if (isShuttingDown) return;
  setTimeout(() => {
    console.error('💀 Error fatal, forzando salida...');
    process.exit(1);
  }, 1000).unref();
});

// Evita acumular clientes de Discord (y sus sockets y listeners) cuando el
// arranque se reintenta porque MongoDB todavía no responde.
async function discardPendingClient() {
  if (!client) return;
  const previous = client;
  client = null;
  global.client = null;
  await Promise.resolve(previous.music?.shutdown?.()).catch(() => null);
  await previous.destroy().catch(() => null);
}

async function startBot() {
  if (isShuttingDown) return;
  console.log('🚀 Iniciando bot...');
  const startTime = Date.now();

  try {
    console.log('📡 Conectando a MongoDB...');
    await connectMongo();
    console.log('✅ Base de datos conectada');

    await discardPendingClient();

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
    await discardPendingClient();

    const errorMessage = String(error.message || error).toLowerCase();
    if (errorMessage.includes('mongodb') || errorMessage.includes('mongoose') || errorMessage.includes('server selection')) {
      console.log('🔄 Intentando reconectar a MongoDB en 5 segundos...');
      retryTimer = setTimeout(() => {
        retryTimer = null;
        startBot();
      }, 5000);
    } else {
      console.log('💀 Error fatal, saliendo...');
      process.exit(1);
    }
  }
}

async function restartBot() {
  console.log('🔄 Solicitando reinicio del proceso...');
  await gracefulShutdown('RESTART');
}

startBot();

module.exports = {
  getClient: () => client,
  restartBot,
  gracefulShutdown,
  runtimeHealth
};
