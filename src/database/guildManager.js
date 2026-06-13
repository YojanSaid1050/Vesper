// guildManager.js - Re-exporta desde mongoManager con funciones adicionales
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

// Función para crear configuración por defecto
function createDefaultGuild() {
  return {
    general: { welcomeChannel: null, goodbyeChannel: null, logChannel: null, botLogChannel: null, botRole: null },
    dashboard: { channel: null, message: null, enabled: false, currentPanel: 'main', currentMode: 'default' },
    tiktok: { liveChannel: null, videoChannel: null, users: [], showUsers: false },
    twitch: { liveChannel: null, users: [], showUsers: false },
    youtube: { liveChannel: null, videoChannel: null, shortChannel: null, users: [], showUsers: false },
    branding: { name: null, avatar: null },
    testPanel: { activeSection: 'general' }
  };
}

// Función de migración (placeholder)
async function migrateGuildConfig(guildId) {
  // Aquí puedes implementar lógica de migración si es necesario
  return false;
}

// Función para obtener el dashboard de una guild
async function getDashboardConfig(guildId) {
  const config = await getGuildConfig(guildId);
  return config.dashboard || { channel: null, message: null, enabled: false };
}

// Función para actualizar el dashboard
async function updateDashboardConfig(guildId, channelId, messageId) {
  return await updateGuildSection(guildId, 'dashboard', { 
    channel: channelId, 
    message: messageId,
    enabled: !!(channelId && messageId)
  });
}

// Función para verificar si una guild tiene dashboard activo
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