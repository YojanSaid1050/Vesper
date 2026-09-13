const MODULE_DEFAULTS = Object.freeze({
  tiktok: true,
  twitch: true,
  youtube: true,
  welcome: true,
  goodbye: true,
  logs: true,
  boosts: true,
  deals: false,
  music: false,
  moderation: false,
  tickets: false,
  suggestions: false,
  selfroles: false,
  starboard: false
});

function csvSet(value) {
  return new Set(String(value || '').split(',').map(item => item.trim()).filter(Boolean));
}

function getMainGuildId() {
  return String(process.env.MAIN_GUILD_ID || process.env.GUILD_ID || '').trim();
}

function isMainGuild(guildId) {
  const mainGuildId = getMainGuildId();
  return Boolean(mainGuildId && guildId && String(guildId) === mainGuildId);
}

function getApprovedGuildIds() {
  return csvSet(process.env.APPROVED_GUILD_IDS);
}

function getThemedMainGuildIds() {
  return csvSet(process.env.THEMED_MAIN_GUILD_IDS);
}

function isThemedMainGuild(guildId) {
  return Boolean(guildId && getThemedMainGuildIds().has(String(guildId)) && !isMainGuild(guildId));
}

// Embers Void y Ankerie Dimension son ambos Main: el primero es el principal
// y el segundo un Main temático con identidad propia. Las dos tienen el mismo
// conjunto de funciones; lo único que cambia es la personalización.
function isAnyMainGuild(guildId) {
  return isMainGuild(guildId) || isThemedMainGuild(guildId);
}

function guildTier(guildId) {
  if (isMainGuild(guildId)) return 'primary_main';
  if (isThemedMainGuild(guildId)) return 'themed_main';
  if (getApprovedGuildIds().has(String(guildId || ''))) return 'satellite';
  return 'external';
}

function isApprovedGuild(guildId) {
  if (!guildId) return false;
  if (isMainGuild(guildId)) return true;
  if (isThemedMainGuild(guildId)) return true;
  const approved = getApprovedGuildIds();
  if (approved.has(String(guildId))) return true;
  return String(process.env.ALLOW_UNLISTED_GUILDS || 'false').toLowerCase() === 'true';
}

function moduleDefaults() {
  return { ...MODULE_DEFAULTS };
}

function isModuleEnabledConfig(config, moduleName) {
  if (!Object.hasOwn(MODULE_DEFAULTS, moduleName)) return false;
  const configured = config?.features?.[moduleName];
  return configured === undefined ? MODULE_DEFAULTS[moduleName] : configured === true;
}

function commandAvailable(command, guildId) {
  const scope = command?.scope || 'all';
  if (!isApprovedGuild(guildId)) return false;
  // 'main' significa «cualquier Main», principal o temático.
  if (scope === 'main') return isAnyMainGuild(guildId);
  // 'primary_main' queda para lo que solo tiene sentido en Embers Void.
  if (scope === 'primary_main') return isMainGuild(guildId);
  if (scope === 'themed_main') return isThemedMainGuild(guildId);
  if (scope === 'satellite') return guildTier(guildId) === 'satellite';
  return true;
}

module.exports = {
  MODULE_DEFAULTS,
  csvSet,
  getMainGuildId,
  getApprovedGuildIds,
  getThemedMainGuildIds,
  isMainGuild,
  isThemedMainGuild,
  isAnyMainGuild,
  guildTier,
  isApprovedGuild,
  moduleDefaults,
  isModuleEnabledConfig,
  commandAvailable
};
