// src/utils/logCache.js
const recentLogs = new Map();
const DEFAULT_DURATION = 5000; // 5 segundos

function createLog(key, duration = DEFAULT_DURATION) {
    if (recentLogs.has(key)) {
        const logData = recentLogs.get(key);
        if (Date.now() - logData.timestamp < logData.duration) {
            return false;
        }
    }
    
    recentLogs.set(key, {
        timestamp: Date.now(),
        duration: duration
    });
    
    setTimeout(() => {
        if (recentLogs.has(key) && Date.now() - recentLogs.get(key).timestamp >= duration) {
            recentLogs.delete(key);
        }
    }, duration);
    
    return true;
}

function startLogCleaner(interval = 60000) {
    setInterval(() => {
        const now = Date.now();
        for (const [key, value] of recentLogs.entries()) {
            if (now - value.timestamp >= value.duration) {
                recentLogs.delete(key);
            }
        }
    }, interval);
}

function getCacheStats() {
    return {
        size: recentLogs.size,
        keys: Array.from(recentLogs.keys())
    };
}

module.exports = { 
    createLog, 
    startLogCleaner, 
    getCacheStats 
};