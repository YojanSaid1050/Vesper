// src/platforms/tiktok/checks.js
const { getApifyTokenManager } = require('../../utils/apifyTokenManager');

// ==================================================
// CACHÉ MEJORADA
// ==================================================
const userCache = new Map();
const liveCache = new Map();

const CACHE_CONFIG = {
    USER_CACHE_DURATION: 10 * 60 * 1000,   // 10 minutos
    LIVE_CACHE_DURATION: 5 * 60 * 1000,    // 5 minutos
    MAX_CACHE_SIZE: 200
};

const MAX_RETRIES = 2;
const RETRY_DELAY = 5000;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Obtener token manager (singleton)
let tokenManager = null;

function getTokenManager() {
    if (!tokenManager) {
        tokenManager = getApifyTokenManager();
    }
    return tokenManager;
}

async function withRetry(fn, context, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.warn(`⚠️ Intento ${i + 1}/${retries} falló para ${context}: ${error.message}`);
            if (i === retries - 1) throw error;
            await sleep(RETRY_DELAY * (i + 1));
        }
    }
}

function getCachedUser(username) {
    const cached = userCache.get(username);
    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.USER_CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

function setCachedUser(username, data) {
    userCache.set(username, {
        data: JSON.parse(JSON.stringify(data)),
        timestamp: Date.now()
    });
    
    // Limpiar caché si es muy grande
    if (userCache.size > CACHE_CONFIG.MAX_CACHE_SIZE) {
        const now = Date.now();
        for (const [key, value] of userCache.entries()) {
            if (now - value.timestamp > CACHE_CONFIG.USER_CACHE_DURATION) {
                userCache.delete(key);
            }
        }
    }
}

// ==================================================
// CHECK LIVE USERS CON TOKEN MANAGER
// ==================================================
async function checkLiveUsers(usernames = []) {
    if (!Array.isArray(usernames) || !usernames.length) {
        return [];
    }

    const cacheKey = `live_${usernames.sort().join(',')}`;
    const cached = liveCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.LIVE_CACHE_DURATION) {
        console.log(`[TikTok Cache] Usando caché para checkLiveUsers: ${usernames.length} usuarios`);
        return cached.data;
    }

    try {
        const tm = getTokenManager();
        
        const results = await tm.executeWithRetry(
            async (client) => {
                const run = await client.actor('unseenuser/tiktok-live-status-scraper').call({
                    handles: usernames,
                    include_stream_urls: true,
                    timeoutSecs: 30
                });

                if (!run?.defaultDatasetId) {
                    return [];
                }

                const { items } = await client.dataset(run.defaultDatasetId).listItems({ 
                    limit: usernames.length 
                });
                
                return items || [];
            },
            `checkLiveUsers (${usernames.length} usuarios)`,
            { maxAttemptsPerToken: 1 } // Solo 1 intento por token para lives
        );
        
        // Guardar en caché
        if (results && results.length > 0) {
            liveCache.set(cacheKey, {
                data: results,
                timestamp: Date.now()
            });
        }
        
        return results;
    } catch (error) {
        console.error('Error checking TikTok Lives:', error.message);
        return [];
    }
}

// ==================================================
// CHECK USER CON TOKEN MANAGER
// ==================================================
async function checkUser(username) {
    if (!username) {
        return { exists: false, error: 'No username provided' };
    }

    const normalizedUsername = username.toLowerCase();
    const cached = getCachedUser(normalizedUsername);
    if (cached) {
        return cached;
    }

    try {
        const tm = getTokenManager();
        
        const result = await tm.executeWithRetry(
            async (client) => {
                console.log(`[TikTok] Usando token: ${tm.getCurrentToken().substring(0, 20)}...`);
                
                const run = await client.actor('clockworks/tiktok-scraper').call({
                    profiles: [`https://www.tiktok.com/@${normalizedUsername}`],
                    resultsPerPage: 1,
                    maxProfiles: 1,
                    scrapeProfile: true,
                    timeoutSecs: 30
                });

                if (!run?.defaultDatasetId) {
                    return { exists: false, error: 'No dataset returned' };
                }

                const { items } = await client.dataset(run.defaultDatasetId).listItems({ 
                    limit: 1 
                });
                
                if (!items || items.length === 0) {
                    return { exists: false };
                }

                const userData = items[0];
                let authorMeta = userData.authorMeta || userData;
                let username_from_data = authorMeta?.uniqueId || authorMeta?.name || authorMeta?.author;
                
                if (!username_from_data) {
                    return { exists: false, error: 'No username in response' };
                }

                return {
                    exists: true,
                    username: username_from_data,
                    nickname: authorMeta?.nickName || authorMeta?.name || username,
                    avatar: authorMeta?.avatar || authorMeta?.covers?.default,
                    followers: parseInt(authorMeta?.followerCount) || 0,
                    hearts: parseInt(authorMeta?.heartCount) || 0,
                    videos: parseInt(authorMeta?.videoCount) || 0
                };
            },
            `checkUser @${username}`,
            { maxAttemptsPerToken: 2 }
        );
        
        setCachedUser(normalizedUsername, result);
        return result;
    } catch (error) {
        console.error(`Error validating TikTok user @${username}:`, error.message);
        return { exists: false, error: error.message };
    }
}

// ==================================================
// CHECK USERS (BATCH) CON TOKEN MANAGER
// ==================================================
async function checkUsers(usernames = []) {
    if (!Array.isArray(usernames) || !usernames.length) {
        return [];
    }

    const normalizedUsernames = usernames.map(u => u.toLowerCase());
    
    // Separar usuarios cacheados y no cacheados
    const uncachedUsers = [];
    const results = [];
    
    for (const username of normalizedUsernames) {
        const cached = getCachedUser(username);
        if (cached && cached.exists) {
            results.push(cached);
        } else {
            uncachedUsers.push(username);
        }
    }
    
    if (uncachedUsers.length === 0) {
        return results;
    }

    try {
        const tm = getTokenManager();
        
        const freshResults = await tm.executeWithRetry(
            async (client) => {
                console.log(`[TikTok] Batch usando token: ${tm.getCurrentToken().substring(0, 20)}...`);
                
                const profiles = uncachedUsers.map(user => `https://www.tiktok.com/@${user}`);
                
                const run = await client.actor('clockworks/tiktok-scraper').call({
                    profiles,
                    resultsPerPage: 50,
                    maxProfiles: uncachedUsers.length,
                    scrapeProfile: true,
                    timeoutSecs: 60
                });

                if (!run?.defaultDatasetId) {
                    return uncachedUsers.map(u => ({ exists: false, username: u }));
                }

                const { items } = await client.dataset(run.defaultDatasetId).listItems({ 
                    limit: uncachedUsers.length * 50 
                });
                
                if (!items || items.length === 0) {
                    return uncachedUsers.map(u => ({ exists: false, username: u }));
                }

                // Agrupar por usuario
                const userVideosMap = new Map();
                
                for (const userData of items) {
                    const authorMeta = userData.authorMeta || userData;
                    const username = authorMeta?.uniqueId || authorMeta?.name || userData?.uniqueId || userData?.id;
                    
                    if (!username) continue;
                    
                    if (!userVideosMap.has(username)) {
                        userVideosMap.set(username, []);
                    }
                    userVideosMap.get(username).push(userData);
                }
                
                const processedResults = [];
                
                // Procesar cada usuario encontrado
                for (const [username, userItems] of userVideosMap) {
                    const sortedItems = userItems.sort((a, b) => {
                        const timeA = parseInt(a.createTime) || 0;
                        const timeB = parseInt(b.createTime) || 0;
                        return timeB - timeA;
                    });
                    
                    const latestVideo = sortedItems[0];
                    
                    if (latestVideo) {
                        const authorMeta = latestVideo.authorMeta || latestVideo;
                        
                        processedResults.push({
                            exists: true,
                            username: username,
                            nickname: authorMeta?.nickName || authorMeta?.name || username,
                            avatar: authorMeta?.avatar || authorMeta?.covers?.default,
                            followers: parseInt(authorMeta?.followerCount) || 0,
                            hearts: parseInt(authorMeta?.heartCount) || 0,
                            videos: parseInt(authorMeta?.videoCount) || 0,
                            latestVideoId: latestVideo.id?.toString(),
                            latestVideoUrl: latestVideo.webVideoUrl,
                            latestVideoTimestamp: parseInt(latestVideo.createTime) || 0,
                            latestVideoTitle: latestVideo.text,
                            latestVideoThumbnail: latestVideo.videoMeta?.coverUrl,
                            latestVideoPlayCount: latestVideo.playCount,
                            latestVideoCommentCount: latestVideo.commentCount
                        });
                    }
                }
                
                // Marcar usuarios no encontrados
                const foundUsernames = Array.from(userVideosMap.keys());
                for (const username of uncachedUsers) {
                    if (!foundUsernames.includes(username)) {
                        processedResults.push({ exists: false, username: username });
                    }
                }
                
                return processedResults;
            },
            `checkUsers (${uncachedUsers.length} usuarios)`,
            { maxAttemptsPerToken: 2 }
        );
        
        for (const result of freshResults) {
            if (result.exists) {
                setCachedUser(result.username, result);
            }
            results.push(result);
        }
        
        return results;
    } catch (error) {
        console.error('Error batch checking TikTok users:', error.message);
        
        for (const username of uncachedUsers) {
            results.push({ 
                exists: false, 
                error: 'BATCH_CHECK_FAILED',
                message: error.message 
            });
        }
        
        return results;
    }
}

function clearUserCache(username) {
    if (username) {
        userCache.delete(username.toLowerCase());
    }
}

function clearAllCache() {
    userCache.clear();
    liveCache.clear();
    console.log('🗑️ TikTok cache completamente limpiado');
}

function getCacheStats() {
    const now = Date.now();
    let validUserCache = 0;
    let validLiveCache = 0;
    
    for (const value of userCache.values()) {
        if (now - value.timestamp < CACHE_CONFIG.USER_CACHE_DURATION) {
            validUserCache++;
        }
    }
    
    for (const value of liveCache.values()) {
        if (now - value.timestamp < CACHE_CONFIG.LIVE_CACHE_DURATION) {
            validLiveCache++;
        }
    }
    
    const tm = getTokenManager();
    
    return {
        userCache: { total: userCache.size, valid: validUserCache },
        liveCache: { total: liveCache.size, valid: validLiveCache },
        tokens: tm.getStats()
    };
}

module.exports = { 
    checkLiveUsers, 
    checkUser, 
    checkUsers,
    clearUserCache,
    clearAllCache,
    getCacheStats
};