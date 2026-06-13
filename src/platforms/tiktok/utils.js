// src/platforms/tiktok/utils.js

function normalizeUsername(username) {
    return (username || '').toLowerCase().replace('@', '').trim();
}

function formatNumber(num) {
    if (!num) return '0';
    const number = typeof num === 'number' ? num : parseInt(num);
    if (isNaN(number)) return '0';
    if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
    if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
    return number.toString();
}

function isValidUrl(url) {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    normalizeUsername,
    formatNumber,
    isValidUrl,
    sleep
};