// guildManager.js - Ahora usa MongoDB
const { 
  getGuildConfig, 
  updateGuildConfig, 
  updateGuildSection, 
  getAllGuilds, 
  getAllGuildConfigs,
  getGeneralConfig 
} = require('./mongoManager');

function createDefaultGuild() {
  return {
    general: { welcomeChannel: null, goodbyeChannel: null, logChannel: null, botLogChannel: null, botRole: null },
    dashboard: { channel: null, message: null, enabled: false },
    tiktok: { liveChannel: null, videoChannel: null, users: [], showUsers: false },
    twitch: { liveChannel: null, users: [], showUsers: false },
    youtube: { liveChannel: null, videoChannel: null, shortChannel: null, users: [], showUsers: false },
    branding: { name: null, avatar: null },
    testPanel: { activeSection: 'general' }
  };
}

function migrateGuildConfig(config) {
  return false;
}

module.exports = {
  getGuildConfig,
  updateGuildConfig,
  updateGuildSection,
  getAllGuilds,
  getAllGuildConfigs,
  getGeneralConfig,
  createDefaultGuild,
  migrateGuildConfig
};