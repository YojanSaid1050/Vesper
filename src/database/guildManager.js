const fs = require('fs');
const path = require('path');
const { getDataPath } = require('../config/paths');

const guildsPath = getDataPath('server/guilds.json');
fs.mkdirSync(path.dirname(guildsPath), { recursive: true });

let guildCache = null;

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
  const defaults = createDefaultGuild();
  let changed = false;
  for (const section of Object.keys(defaults)) {
    if (!config[section]) {
      config[section] = structuredClone(defaults[section]);
      changed = true;
      continue;
    }
    for (const key of Object.keys(defaults[section])) {
      if (!(key in config[section])) {
        config[section][key] = defaults[section][key];
        changed = true;
      }
    }
  }
  return changed;
}

function loadGuilds() {
  if (guildCache) return guildCache;
  if (!fs.existsSync(guildsPath)) {
    fs.writeFileSync(guildsPath, '{}', 'utf8');
    guildCache = {};
    return guildCache;
  }
  try {
    const raw = fs.readFileSync(guildsPath, 'utf8');
    guildCache = raw && raw.trim() ? JSON.parse(raw) : {};
    return guildCache;
  } catch {
    console.error('⚠️ guilds.json corrupto. Restaurando...');
    guildCache = {};
    fs.writeFileSync(guildsPath, '{}', 'utf8');
    return guildCache;
  }
}

function saveGuilds(data) {
  guildCache = data;
  fs.writeFileSync(guildsPath, JSON.stringify(data, null, 2), 'utf8');
}

function getGuildConfig(guildId) {
  const data = loadGuilds();
  let changed = false;
  if (!data[guildId]) {
    data[guildId] = createDefaultGuild();
    changed = true;
  }
  if (migrateGuildConfig(data[guildId])) changed = true;
  if (changed) saveGuilds(data);
  return data[guildId];
}

function getAllGuildConfigs() {
  const data = loadGuilds();
  let changed = false;
  for (const guildId of Object.keys(data)) {
    if (migrateGuildConfig(data[guildId])) changed = true;
  }
  if (changed) saveGuilds(data);
  return data;
}

function getAllGuilds() {
  return Object.entries(getAllGuildConfigs()).map(([guildId, config]) => ({ guildId, ...config }));
}

function updateGuildConfig(guildId, config) {
  const data = loadGuilds();
  migrateGuildConfig(config);
  data[guildId] = config;
  saveGuilds(data);
}

function updateGuildSection(guildId, section, values) {
  const config = getGuildConfig(guildId);
  if (!config[section]) config[section] = {};
  Object.assign(config[section], values);
  updateGuildConfig(guildId, config);
}

function getGeneralConfig(guildId) {
  return getGuildConfig(guildId).general;
}

module.exports = {
  getGuildConfig, getAllGuildConfigs, getAllGuilds, getGeneralConfig,
  updateGuildConfig, updateGuildSection, createDefaultGuild, migrateGuildConfig
};