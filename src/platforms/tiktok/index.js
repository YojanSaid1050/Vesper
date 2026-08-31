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
    
    // Configuración autohospedada sin consumo de APIs pagas
    config: {
        LIVE_CHECK_INTERVAL: (Number(process.env.TIKTOK_LIVE_INTERVAL_MINUTES) || 10) * 60 * 1000,
        VIDEO_CHECK_INTERVAL: (Number(process.env.TIKTOK_VIDEO_INTERVAL_MINUTES) || 60) * 60 * 1000,
        PROVIDER: checks.CONFIG.PROVIDER,
        COST_USD: 0
    }
};

console.log('✅ TikTok module initialized (autohospedado, sin Apify)');
console.log(`   - Live check interval: ${module.exports.config.LIVE_CHECK_INTERVAL / 1000}s`);
console.log(`   - Video check interval: ${module.exports.config.VIDEO_CHECK_INTERVAL / 1000}s`);
