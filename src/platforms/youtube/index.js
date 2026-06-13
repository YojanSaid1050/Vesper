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
  clearCache: checks.clearCache,
  
  // Configuración
  config: {
    LIVE_CHECK_INTERVAL: 180000,   // 3 minutos
    VIDEO_CHECK_INTERVAL: 180000,  // 3 minutos
    SHORTS_CHECK_INTERVAL: 180000, // 3 minutos
    MAX_RETRIES: 3,
    BATCH_SIZE: 10
  }
};

console.log('✅ YouTube module initialized');