// src/platforms/tiktok/index.js
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
    clearAllCache: checks.clearAllCache,
    getCacheStats: checks.getCacheStats,
    
    // Configuración OPTIMIZADA
    config: {
        LIVE_CHECK_INTERVAL: 10 * 60 * 1000,   // 10 minutos
        VIDEO_CHECK_INTERVAL: 20 * 60 * 1000,  // 20 minutos
        CACHE_DURATION: 8 * 60 * 1000,         // 8 minutos
        VIDEO_CACHE_DURATION: 15 * 60 * 1000,  // 15 minutos
        MAX_RETRIES: 2,
        BATCH_SIZE: 5,
        MAX_CONCURRENT_GUILDS: 2,
        OFF_PEAK_ENABLED: true,
        OFF_PEAK_HOURS: { start: 1, end: 6 }   // 1am - 6am
    }
};

console.log('✅ TikTok module initialized (optimizado)');
console.log(`   - Live check interval: ${module.exports.config.LIVE_CHECK_INTERVAL / 1000}s`);
console.log(`   - Video check interval: ${module.exports.config.VIDEO_CHECK_INTERVAL / 1000}s`);
console.log(`   - Cache duration: ${module.exports.config.CACHE_DURATION / 1000}s`);