// src/database/guildManager.js
const {
  getGuildConfig, 
  updateGuildConfig, 
  updateGuildSection, 
  getAllGuilds, 
  getAllGuildConfigs,
  getGeneralConfig,
  deleteGuild,
  cleanDuplicateUsers,
  connectMongo
} = require('./mongoManager');
const { moduleDefaults } = require('../config/guildPolicy');

function createDefaultGuild() {
  return {
    general: { welcomeChannel: null, goodbyeChannel: null, logChannel: null, botLogChannel: null, botRole: null },
    dashboard: { channel: null, message: null, enabled: false, currentPanel: 'main', currentMode: 'default' },
    tiktok: { liveChannel: null, videoChannel: null, users: [], showUsers: false, pingRole: null },
    twitch: { liveChannel: null, users: [], showUsers: false, pingRole: null },
    youtube: { liveChannel: null, videoChannel: null, shortChannel: null, users: [], showUsers: false, pingRole: null },
    branding: { name: null, avatar: null },
    features: moduleDefaults(),
    permissions: { socialManagerRoles: [], moderatorRoles: [], musicDjRoles: [] },
    moderation: { filterLinks: false, allowedDomains: [], blockInvites: true, maxMentions: 5, repeatLimit: 4, action: 'warn' },
    music: { requestChannel: null, defaultVolume: 50, maxQueue: 100, maxPerUser: 3, maxTrackMinutes: 15, idleSeconds: 180 },
    testPanel: { activeSection: 'general' }
  };
}

async function migrateGuildConfig(guildId) {
  return false;
}

async function getDashboardConfig(guildId) {
  const config = await getGuildConfig(guildId);
  return config.dashboard || { channel: null, message: null, enabled: false };
}

async function updateDashboardConfig(guildId, channelId, messageId) {
  return await updateGuildSection(guildId, 'dashboard', { 
    channel: channelId, 
    message: messageId,
    enabled: !!(channelId && messageId)
  });
}

async function hasDashboard(guildId) {
  const dashboard = await getDashboardConfig(guildId);
  return !!(dashboard.channel && dashboard.message);
}

module.exports = {
  getGuildConfig,
  updateGuildConfig,
  updateGuildSection,
  getAllGuilds,
  getAllGuildConfigs,
  getGeneralConfig,
  deleteGuild,
  cleanDuplicateUsers,
  connectMongo,
  createDefaultGuild,
  migrateGuildConfig,
  getDashboardConfig,
  updateDashboardConfig,
  hasDashboard
};
