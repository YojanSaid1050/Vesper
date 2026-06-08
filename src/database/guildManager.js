// guildManager.js - Ahora usa MongoDB en lugar de archivos JSON
const { getGuildConfig, updateGuildConfig, updateGuildSection, getAllGuilds, getGeneralConfig, getAllGuildConfigs } = require('./mongoManager');

// Crear función de compatibilidad para createDefaultGuild
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

// Función de migración vacía (MongoDB maneja esto automáticamente)
function migrateGuildConfig(config) {
  return false;
}

// Re-exportar todas las funciones de mongoManager
module.exports = {
  getGuildConfig,
  updateGuildConfig,
  updateGuildSection,
  getAllGuilds,
  getGeneralConfig,
  getAllGuildConfigs,
  createDefaultGuild,
  migrateGuildConfig
};