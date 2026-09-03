const MODULE_DEFAULTS = Object.freeze({
  tiktok: true,
  twitch: true,
  youtube: true,
  welcome: true,
  goodbye: true,
  logs: true,
  music: false,
  moderation: false
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

function isApprovedGuild(guildId) {
  if (!guildId) return false;
  if (isMainGuild(guildId)) return true;
  const approved = getApprovedGuildIds();
  // Compatibilidad: si todavía no existe una lista, no se expulsan servidores
  // ya instalados. Al definirla, la política pasa a ser una lista cerrada.
  return approved.size === 0 || approved.has(String(guildId));
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
  if (scope === 'main') return isMainGuild(guildId);
  if (scope === 'satellite') return !isMainGuild(guildId);
  return true;
}

module.exports = {
  MODULE_DEFAULTS,
  csvSet,
  getMainGuildId,
  getApprovedGuildIds,
  isMainGuild,
  isApprovedGuild,
  moduleDefaults,
  isModuleEnabledConfig,
  commandAvailable
};
