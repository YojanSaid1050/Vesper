// src/platforms/tiktok/monitors.js
const { getAllGuildConfigs } = require('../../database/mongoManager');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const CacheManager = require('../../core/CacheManager');
const { checkLiveUsers, checkUsers } = require('./checks');
const { liveEmbed, videoEmbed } = require('./embeds');
const { monitor, monitorError } = require('../../utils/logger');

const cache = new CacheManager('./data/tiktok');

// ==================================================
// CONFIGURACIÓN OPTIMIZADA
// ==================================================
const CONFIG = {
    // Intervalos efectivos (sobrescritos por platforms/index.js)
    LIVE_SKIP_THRESHOLD: 8 * 60 * 1000,     // 8 minutos
    VIDEO_SKIP_THRESHOLD: 15 * 60 * 1000,   // 15 minutos
    
    // Caché de resultados de Apify
    APIFY_CACHE_DURATION: 8 * 60 * 1000,    // 8 minutos
    APIFY_VIDEO_CACHE_DURATION: 15 * 60 * 1000, // 15 minutos
    
    // Procesamiento
    MAX_CONCURRENT_GUILDS: 2,
    MAX_RETRIES: 2,
    RETRY_DELAY: 10000,
    
    // Cooldown de errores
    ERROR_COOLDOWN: 5 * 60 * 1000,
    MAX_CONSECUTIVE_ERRORS: 3,
    
    // Horario nocturno
    OFF_PEAK_HOURS: { start: 1, end: 6 }
};

// ==================================================
// CACHÉ DE RESULTADOS DE APIFY
// ==================================================
const apifyResultCache = new Map();

function getCachedApifyResult(key, maxAge) {
    const cached = apifyResultCache.get(key);
    if (cached && Date.now() - cached.timestamp < maxAge) {
        return cached.data;
    }
    return null;
}

function setCachedApifyResult(key, data, maxAge) {
    apifyResultCache.set(key, {
        data: JSON.parse(JSON.stringify(data)),
        timestamp: Date.now(),
        maxAge: maxAge
    });
    
    if (apifyResultCache.size > 100) {
        const now = Date.now();
        for (const [k, v] of apifyResultCache.entries()) {
            if (now - v.timestamp > v.maxAge) {
                apifyResultCache.delete(k);
            }
        }
    }
}

// ==================================================
// SMART CHECK
// ==================================================
const lastGuildCheck = new Map();

function shouldCheckGuild(guildId, type) {
    const key = `${guildId}_${type}`;
    const last = lastGuildCheck.get(key);
    const threshold = type === 'live' ? CONFIG.LIVE_SKIP_THRESHOLD : CONFIG.VIDEO_SKIP_THRESHOLD;
    
    if (!last) return true;
    return (Date.now() - last) >= threshold;
}

function recordGuildCheck(guildId, type) {
    const key = `${guildId}_${type}`;
    lastGuildCheck.set(key, Date.now());
}

function isOffPeakHour() {
    const hour = new Date().getHours();
    return hour >= CONFIG.OFF_PEAK_HOURS.start && hour < CONFIG.OFF_PEAK_HOURS.end;
}

function shouldSkipDueToHour(lastCheckTime, type) {
    if (!isOffPeakHour()) return false;
    
    const threshold = type === 'live' ? 20 * 60 * 1000 : 30 * 60 * 1000;
    return (Date.now() - lastCheckTime) < threshold;
}

// ==================================================
// ESTADO
// ==================================================
const guildErrors = new Map();
let isRunning = false;

function normalize(username) {
    return (username || '').toLowerCase().replace('@', '').trim();
}

function shouldSkipGuild(guildId, platform) {
    const errors = guildErrors.get(`${guildId}_${platform}`);
    if (!errors) return false;
    
    const now = Date.now();
    if (errors.count >= CONFIG.MAX_CONSECUTIVE_ERRORS && 
        now - errors.lastError < CONFIG.ERROR_COOLDOWN) {
        return true;
    }
    return false;
}

function recordError(guildId, platform, error) {
    const key = `${guildId}_${platform}`;
    const current = guildErrors.get(key) || { count: 0, lastError: 0 };
    current.count++;
    current.lastError = Date.now();
    guildErrors.set(key, current);
    monitorError('TikTok', platform, guildId, error);
}

function resetErrors(guildId, platform) {
    const key = `${guildId}_${platform}`;
    if (guildErrors.has(key)) guildErrors.delete(key);
}

async function withRetryAndCache(fn, context, cacheKey, cacheMaxAge, maxRetries = CONFIG.MAX_RETRIES) {
    const cached = getCachedApifyResult(cacheKey, cacheMaxAge);
    if (cached !== null) {
        return cached;
    }
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await fn();
            if (result && (!result.error || result.success !== false)) {
                setCachedApifyResult(cacheKey, result, cacheMaxAge);
            }
            return result;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.warn(`⚠️ [TikTok] Retry ${i + 1}/${maxRetries} for ${context}: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (i + 1)));
        }
    }
}

// ==================================================
// MONITOR LIVES OPTIMIZADO
// ==================================================
async function monitorLives(client) {
    if (isRunning) {
        return { success: false, reason: 'already_running' };
    }
    isRunning = true;
    
    try {
        const startTime = Date.now();
        const liveStatus = cache.load('liveStatus', {});
        const guilds = await getAllGuildConfigs();
        
        let totalGuilds = 0, totalUsers = 0, totalLives = 0, totalErrors = 0;
        let apifyCalls = 0;

        const eligibleGuilds = [];
        
        for (const [guildId, config] of Object.entries(guilds)) {
            const tiktokConfig = config.tiktok || {};
            const users = tiktokConfig.users || [];
            const liveChannelId = tiktokConfig.liveChannel;
            
            if (users.length === 0 || !liveChannelId) continue;
            if (shouldSkipGuild(guildId, 'lives')) continue;
            if (!shouldCheckGuild(guildId, 'live')) continue;
            
            const lastCheckTime = lastGuildCheck.get(`${guildId}_live`) || 0;
            if (shouldSkipDueToHour(lastCheckTime, 'live')) continue;
            
            eligibleGuilds.push({ guildId, config, users, liveChannelId });
        }

        for (let i = 0; i < eligibleGuilds.length; i += CONFIG.MAX_CONCURRENT_GUILDS) {
            const batch = eligibleGuilds.slice(i, i + CONFIG.MAX_CONCURRENT_GUILDS);
            
            for (const guild of batch) {
                try {
                    const result = await processGuildLives(guild, client, liveStatus);
                    if (result) {
                        totalGuilds++;
                        totalUsers += result.users || 0;
                        totalLives += result.lives || 0;
                        apifyCalls += result.apifyCalls || 0;
                    }
                    recordGuildCheck(guild.guildId, 'live');
                } catch (error) {
                    totalErrors++;
                    monitorError('TikTok', 'Monitor Lives Process', guild.guildId, error);
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        cache.save('liveStatus', liveStatus);
        
        const duration = Date.now() - startTime;
        monitor('TikTok', 'Live Monitoring Complete', null, {
            guilds: totalGuilds, users: totalUsers, lives: totalLives,
            errors: totalErrors, apifyCalls, duration: `${duration}ms`
        });
        
        return { success: true, guilds: totalGuilds, users: totalUsers, lives: totalLives,
                 errors: totalErrors, apifyCalls, duration };
    } catch (error) {
        monitorError('TikTok', 'Live Monitor Fatal', null, error);
        return { success: false, error: error.message };
    } finally {
        isRunning = false;
    }
}

async function processGuildLives(guildData, client, liveStatus) {
    const { guildId, config, users, liveChannelId } = guildData;
    const tiktokConfig = config.tiktok || {};
    const pingRole = tiktokConfig.pingRole || null;
    
    try {
        const channel = await client.channels.fetch(liveChannelId).catch(() => null);
        if (!channel) {
            recordError(guildId, 'lives', new Error(`Channel ${liveChannelId} not found`));
            return null;
        }

        const botMember = channel.guild.members.me;
        const permissions = channel.permissionsFor(botMember);
        if (!permissions?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
            recordError(guildId, 'lives', new Error('Missing permissions'));
            return null;
        }

        if (!liveStatus[guildId]) liveStatus[guildId] = {};
        const guildStatus = liveStatus[guildId];
        
        const validUsersSet = new Set(users.map(u => normalize(u)));
        for (const savedUser of Object.keys(guildStatus)) {
            if (!validUsersSet.has(savedUser)) delete guildStatus[savedUser];
        }

        const cacheKey = `live_${guildId}_${users.sort().join(',')}`;
        
        const results = await withRetryAndCache(
            () => checkLiveUsers(users),
            `Check lives for guild ${guildId}`,
            cacheKey,
            CONFIG.APIFY_CACHE_DURATION
        );
        
        if (!results || !Array.isArray(results)) return null;
        
        let newLives = 0;
        let hasChanges = false;
        
        const pingText = pingRole ? `<@&${pingRole}>\n\n` : '';

        for (const user of results) {
            if (!user?.success) continue;

            const username = normalize(user.handle);
            const isLive = Boolean(user.liveRoom?.streamId && user.liveRoomUserInfo?.status !== 4);
            const wasLive = guildStatus[username] === true;

            if (isLive && !wasLive) {
                monitor('TikTok', 'Live Started', guildId, {
                    username, viewers: user.liveRoom?.liveRoomStats?.userCount || 0
                });
                
                try {
                    const embed = liveEmbed({
                        username,
                        nickname: user.liveRoomUserInfo?.nickname || username,
                        viewers: user.liveRoom?.liveRoomStats?.userCount || 0,
                        title: user.liveRoom?.title || 'TikTok Live',
                        cover: user.liveRoom?.coverUrl,
                        liveUrl: `https://www.tiktok.com/@${username}/live`,
                        pingText: pingText
                    });
                    
                    if (embed) {
                        await sendBrandedMessage(channel, embed);
                        newLives++;
                        guildStatus[username] = isLive;
                        hasChanges = true;
                    }
                } catch (error) {
                    monitorError('TikTok', 'Send Live Message', guildId, error, { username });
                }
            } else if (guildStatus[username] !== isLive) {
                guildStatus[username] = isLive;
                hasChanges = true;
            }
        }

        if (hasChanges || Object.keys(guildStatus).length > 0) {
            liveStatus[guildId] = guildStatus;
        }
        
        resetErrors(guildId, 'lives');
        
        return { users: users.length, lives: newLives, apifyCalls: results.length > 0 ? 1 : 0 };
    } catch (error) {
        monitorError('TikTok', 'Process Guild Lives', guildId, error);
        recordError(guildId, 'lives', error);
        return null;
    }
}

// ==================================================
// MONITOR VIDEOS OPTIMIZADO
// ==================================================
async function monitorVideos(client) {
    if (isRunning) {
        return { success: false, reason: 'already_running' };
    }
    isRunning = true;
    
    try {
        const startTime = Date.now();
        const videos = cache.load('videos', {});
        const guilds = await getAllGuildConfigs();
        
        let totalGuilds = 0, totalUsers = 0, totalNewVideos = 0, totalErrors = 0;
        let apifyCalls = 0;

        const eligibleGuilds = [];
        
        for (const [guildId, config] of Object.entries(guilds)) {
            const tiktokConfig = config.tiktok || {};
            const users = tiktokConfig.users || [];
            const videoChannelId = tiktokConfig.videoChannel;
            
            if (users.length === 0 || !videoChannelId) continue;
            if (shouldSkipGuild(guildId, 'videos')) continue;
            if (!shouldCheckGuild(guildId, 'video')) continue;
            
            const lastCheckTime = lastGuildCheck.get(`${guildId}_video`) || 0;
            if (shouldSkipDueToHour(lastCheckTime, 'video')) continue;
            
            eligibleGuilds.push({ guildId, config, users, videoChannelId });
        }

        for (let i = 0; i < eligibleGuilds.length; i += CONFIG.MAX_CONCURRENT_GUILDS) {
            const batch = eligibleGuilds.slice(i, i + CONFIG.MAX_CONCURRENT_GUILDS);
            
            for (const guild of batch) {
                try {
                    const result = await processGuildVideos(guild, client, videos);
                    if (result) {
                        totalGuilds++;
                        totalUsers += result.users || 0;
                        totalNewVideos += result.videos || 0;
                        apifyCalls += result.apifyCalls || 0;
                    }
                    recordGuildCheck(guild.guildId, 'video');
                } catch (error) {
                    totalErrors++;
                    monitorError('TikTok', 'Monitor Videos Process', guild.guildId, error);
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        cache.save('videos', videos);
        
        const duration = Date.now() - startTime;
        monitor('TikTok', 'Video Monitoring Complete', null, {
            guilds: totalGuilds, users: totalUsers, videos: totalNewVideos,
            errors: totalErrors, apifyCalls, duration: `${duration}ms`
        });
        
        return { success: true, guilds: totalGuilds, users: totalUsers, videos: totalNewVideos,
                 errors: totalErrors, apifyCalls, duration };
    } catch (error) {
        monitorError('TikTok', 'Video Monitor Fatal', null, error);
        return { success: false, error: error.message };
    } finally {
        isRunning = false;
    }
}

async function processGuildVideos(guildData, client, videos) {
    const { guildId, config, users, videoChannelId } = guildData;
    const tiktokConfig = config.tiktok || {};
    const pingRole = tiktokConfig.pingRole || null;
    
    try {
        const channel = await client.channels.fetch(videoChannelId).catch(() => null);
        if (!channel) {
            recordError(guildId, 'videos', new Error(`Channel ${videoChannelId} not found`));
            return null;
        }

        const botMember = channel.guild.members.me;
        const permissions = channel.permissionsFor(botMember);
        if (!permissions?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
            recordError(guildId, 'videos', new Error('Missing permissions'));
            return null;
        }

        const guildVideos = videos[guildId] || {};
        
        const validUsersSet = new Set(users.map(u => normalize(u)));
        for (const savedUser of Object.keys(guildVideos)) {
            if (!validUsersSet.has(savedUser)) delete guildVideos[savedUser];
        }

        const cacheKey = `videos_${guildId}_${users.sort().join(',')}`;
        
        const results = await withRetryAndCache(
            () => checkUsers(users),
            `Check videos for guild ${guildId}`,
            cacheKey,
            CONFIG.APIFY_VIDEO_CACHE_DURATION
        );
        
        if (!results || !Array.isArray(results)) return null;

        let newVideos = 0;
        let hasChanges = false;
        
        const pingText = pingRole ? `<@&${pingRole}>\n\n` : '';

        for (const user of results) {
            if (!user?.exists) continue;
            
            const username = normalize(user.username);
            const lastVideoId = guildVideos[username];
            const latestVideoId = user.latestVideoId;
            
            if (!latestVideoId) continue;

            if (!lastVideoId) {
                guildVideos[username] = latestVideoId;
                hasChanges = true;
                continue;
            }

            if (lastVideoId !== latestVideoId) {
                monitor('TikTok', 'New Video', guildId, {
                    username, views: user.latestVideoPlayCount || 0
                });
                
                try {
                    const embed = videoEmbed({
                        username,
                        nickname: user.nickname,
                        description: user.latestVideoTitle,
                        thumbnail: user.latestVideoThumbnail,
                        url: user.latestVideoUrl,
                        playCount: user.latestVideoPlayCount,
                        commentCount: user.latestVideoCommentCount,
                        pingText: pingText
                    });
                    
                    if (embed) {
                        await sendBrandedMessage(channel, embed);
                        newVideos++;
                        guildVideos[username] = latestVideoId;
                        hasChanges = true;
                    }
                } catch (error) {
                    monitorError('TikTok', 'Send Video Message', guildId, error, { username });
                }
            }
        }

        if (hasChanges || Object.keys(guildVideos).length > 0) {
            videos[guildId] = guildVideos;
        }
        
        resetErrors(guildId, 'videos');
        
        return { users: users.length, videos: newVideos, apifyCalls: results.length > 0 ? 1 : 0 };
    } catch (error) {
        monitorError('TikTok', 'Process Guild Videos', guildId, error);
        recordError(guildId, 'videos', error);
        return null;
    }
}

// ==================================================
// FUNCIONES AUXILIARES
// ==================================================
async function clearGuildCache(guildId) {
    const liveStatus = cache.load('liveStatus', {});
    const videos = cache.load('videos', {});
    
    delete liveStatus[guildId];
    delete videos[guildId];
    
    cache.save('liveStatus', liveStatus);
    cache.save('videos', videos);
    
    for (const [key] of apifyResultCache.entries()) {
        if (key.includes(guildId)) apifyResultCache.delete(key);
    }
    
    monitor('TikTok', 'Cache Cleared', guildId, { action: 'Manual cache clear' });
}

async function getMonitorStats() {
    const liveStatus = cache.load('liveStatus', {});
    const videos = cache.load('videos', {});
    
    let totalLiveEntries = 0, totalVideoEntries = 0;
    for (const guild of Object.values(liveStatus)) totalLiveEntries += Object.keys(guild).length;
    for (const guild of Object.values(videos)) totalVideoEntries += Object.keys(guild).length;
    
    const now = Date.now();
    let validApifyCache = 0;
    for (const v of apifyResultCache.values()) {
        if (now - v.timestamp < v.maxAge) validApifyCache++;
    }
    
    return {
        guilds: { live: Object.keys(liveStatus).length, videos: Object.keys(videos).length },
        entries: { live: totalLiveEntries, videos: totalVideoEntries },
        apifyCache: { total: apifyResultCache.size, valid: validApifyCache },
        errors: Array.from(guildErrors.entries()).map(([key, data]) => ({
            key, count: data.count, lastError: new Date(data.lastError).toISOString()
        }))
    };
}

// Limpiador periódico
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of apifyResultCache.entries()) {
        if (now - value.timestamp > value.maxAge) {
            apifyResultCache.delete(key);
        }
    }
}, 60 * 60 * 1000);

module.exports = { 
    monitorLives, 
    monitorVideos, 
    clearGuildCache, 
    getMonitorStats 
};