// src/platforms/index.js
const MonitorService = require('../core/MonitorService');
const youtubeMonitors = require('./youtube/monitors');
const twitchMonitors = require('./twitch/monitors');
const tiktokMonitors = require('./tiktok/monitors');
const { shutdownTikTokProvider } = require('./tiktok/checks');

function minutesFromEnv(name, fallbackMinutes) {
    const value = Number(process.env[name]);
    return (Number.isFinite(value) && value > 0 ? value : fallbackMinutes) * 60 * 1000;
}

// ==================================================
// CONFIGURACIÓN DE INTERVALOS MODIFICADA
// ==================================================
const INTERVALS = {
    // YouTube
    YOUTUBE_LIVE: 5 * 60 * 1000,      // 5 minutos (cambié de 3 a 5)
    YOUTUBE_VIDEO: 10 * 60 * 1000,    // 10 minutos (cambié de 3 a 10)
    YOUTUBE_SHORTS: 10 * 60 * 1000,   // 10 minutos (cambié de 3 a 10)
    
    // Twitch
    TWITCH_STREAM: 2 * 60 * 1000,     // 2 minutos (sin cambios)
    
    // TikTok
    TIKTOK_LIVE: minutesFromEnv('TIKTOK_LIVE_INTERVAL_MINUTES', 10),
    TIKTOK_VIDEO: minutesFromEnv('TIKTOK_VIDEO_INTERVAL_MINUTES', 60),
};

const monitors = [];
let started = false;

function startAllMonitors(client) {
    if (started) {
        console.log('ℹ️ Los monitores ya estaban iniciados; se omite un arranque duplicado');
        return monitors;
    }

    started = true;
    // ==================================================
    // YOUTUBE MONITORS
    // ==================================================
    if (process.env.YOUTUBE_API_KEY) {
        monitors.push(new MonitorService({
            name: 'YouTube Lives',
            interval: INTERVALS.YOUTUBE_LIVE,
            maxConsecutiveErrors: 5,
            executeFunction: youtubeMonitors.monitorLives
        }));
        monitors.push(new MonitorService({
            name: 'YouTube Videos',
            interval: INTERVALS.YOUTUBE_VIDEO,
            maxConsecutiveErrors: 5,
            executeFunction: youtubeMonitors.monitorVideos
        }));
        monitors.push(new MonitorService({
            name: 'YouTube Shorts',
            interval: INTERVALS.YOUTUBE_SHORTS,
            maxConsecutiveErrors: 5,
            executeFunction: youtubeMonitors.monitorShorts
        }));
    } else {
        console.log('⚠️ YOUTUBE_API_KEY no configurada, omitiendo monitores de YouTube');
    }

    // ==================================================
    // TWITCH MONITORS
    // ==================================================
    if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
        monitors.push(new MonitorService({
            name: 'Twitch Streams',
            interval: INTERVALS.TWITCH_STREAM,
            maxConsecutiveErrors: 5,
            executeFunction: twitchMonitors.monitorStreams
        }));
    } else {
        console.log('⚠️ Credenciales de Twitch no configuradas, omitiendo monitores de Twitch');
    }

    // ==================================================
    // TIKTOK MONITORS
    // ==================================================
    if (String(process.env.TIKTOK_ENABLED || 'true').toLowerCase() !== 'false') {
        monitors.push(new MonitorService({
            name: 'TikTok Lives',
            interval: INTERVALS.TIKTOK_LIVE,
            maxConsecutiveErrors: 3,
            executeFunction: tiktokMonitors.monitorLives
        }));
        monitors.push(new MonitorService({
            name: 'TikTok Videos',
            interval: INTERVALS.TIKTOK_VIDEO,
            maxConsecutiveErrors: 3,
            executeFunction: tiktokMonitors.monitorVideos
        }));
    } else {
        console.log('ℹ️ TikTok desactivado mediante TIKTOK_ENABLED=false');
    }

    // Iniciar todos los monitores
    for (const monitor of monitors) {
        monitor.start(client);
    }
    
    console.log(`✅ Iniciados ${monitors.length} monitores`);
    console.log(`   📊 YouTube: lives cada ${INTERVALS.YOUTUBE_LIVE / 1000}s, videos y shorts cada ${INTERVALS.YOUTUBE_VIDEO / 1000}s`);
    console.log(`   📺 Twitch: streams cada ${INTERVALS.TWITCH_STREAM / 1000}s`);
    console.log(`   🎵 TikTok: lives cada ${INTERVALS.TIKTOK_LIVE / 1000}s, videos cada ${INTERVALS.TIKTOK_VIDEO / 1000}s`);

    return monitors;
}

function stopAllMonitors() {
    for (const monitor of monitors) {
        monitor.stop();
    }
    shutdownTikTokProvider();
    monitors.length = 0;
    started = false;
    console.log('🛑 Todos los monitores detenidos');
}

function getMonitorStats() {
    return monitors.map(m => m.getStats());
}

module.exports = { startAllMonitors, stopAllMonitors, getMonitorStats };
