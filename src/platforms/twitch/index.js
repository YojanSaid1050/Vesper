const utils = require('./utils');
const embeds = require('./embeds');
const checks = require('./checks');
const monitors = require('./monitors');

module.exports = {
  // Utilidades
  ...utils,
  
  // Embeds
  ...embeds,
  
  // Checks
  ...checks,
  
  // Monitors
  ...monitors,
  
  // Funciones adicionales
  clearGuildCache: monitors.clearGuildCache,
  getMonitorStats: monitors.getMonitorStats,
  clearStreamerCache: checks.clearStreamerCache,
  
  // Configuración
  config: {
    CHECK_INTERVAL: 120000, // 2 minutos
    MAX_RETRIES: 3,
    BATCH_SIZE: 10
  }
};

console.log('✅ Twitch module initialized');