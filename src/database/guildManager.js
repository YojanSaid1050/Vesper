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
const { CURRENT_SCHEMA_VERSION, createDefaultGuildConfig, defaultProfileConfig } = require('../config/defaultGuild');
const Guild = require('./models/Guild');

function createDefaultGuild() {
  return createDefaultGuildConfig();
}

async function migrateGuildConfig(guildId) {
  await connectMongo();
  const current = await Guild.findOne({ guildId }).lean();
  if (!current) {
    await Guild.create(createDefaultGuildConfig(guildId));
    return true;
  }
  if (Number(current.schemaVersion || 0) >= CURRENT_SCHEMA_VERSION) return false;
  await Guild.updateOne(
    { guildId, $or: [{ schemaVersion: { $lt: CURRENT_SCHEMA_VERSION } }, { schemaVersion: { $exists: false } }] },
    { $set: { schemaVersion: CURRENT_SCHEMA_VERSION, profile: defaultProfileConfig(guildId) } }
  );
  return true;
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
