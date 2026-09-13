const { MODULE_DEFAULTS, isModuleEnabledConfig } = require('../config/guildPolicy');

function configured(value) {
  return Boolean(Array.isArray(value) ? value.length : value);
}

function setupChecks(config = {}) {
  const checks = [
    { key: 'logs', label: 'Canal de registros', ready: configured(config.general?.logChannel) },
    { key: 'welcome', label: 'Canal de bienvenida', ready: !isModuleEnabledConfig(config, 'welcome') || configured(config.general?.welcomeChannel) },
    { key: 'goodbye', label: 'Canal de despedida', ready: !isModuleEnabledConfig(config, 'goodbye') || configured(config.general?.goodbyeChannel) },
    // El agradecimiento por boosts cae en el canal de bienvenida si no se le
    // asigna uno propio, así que basta con tener cualquiera de los dos.
    { key: 'boosts', label: 'Canal de boosts', ready: !isModuleEnabledConfig(config, 'boosts') || configured(config.general?.boostChannel) || configured(config.general?.welcomeChannel) },
    { key: 'tiktok', label: 'TikTok', ready: !isModuleEnabledConfig(config, 'tiktok') || (configured(config.tiktok?.users) && (configured(config.tiktok?.liveChannel) || configured(config.tiktok?.videoChannel))) },
    { key: 'twitch', label: 'Twitch', ready: !isModuleEnabledConfig(config, 'twitch') || (configured(config.twitch?.users) && configured(config.twitch?.liveChannel)) },
    { key: 'youtube', label: 'YouTube', ready: !isModuleEnabledConfig(config, 'youtube') || (configured(config.youtube?.users) && (configured(config.youtube?.liveChannel) || configured(config.youtube?.videoChannel) || configured(config.youtube?.shortChannel))) },
    { key: 'music', label: 'Música', ready: !isModuleEnabledConfig(config, 'music') || configured(config.music?.requestChannel) },
    { key: 'tickets', label: 'Tickets', ready: !isModuleEnabledConfig(config, 'tickets') || (configured(config.community?.tickets?.panelChannel) && configured(config.community?.tickets?.staffRoles)) },
    { key: 'suggestions', label: 'Sugerencias', ready: !isModuleEnabledConfig(config, 'suggestions') || configured(config.community?.suggestions?.channel) },
    { key: 'selfroles', label: 'Autorroles', ready: !isModuleEnabledConfig(config, 'selfroles') || configured(config.community?.selfRoles?.roles) },
    { key: 'starboard', label: 'Starboard', ready: !isModuleEnabledConfig(config, 'starboard') || configured(config.community?.starboard?.channel) },
    { key: 'permissions', label: 'Roles de capacidad', ready: ['socialManagerRoles', 'moderatorRoles', 'musicDjRoles'].some(key => configured(config.permissions?.[key])) }
  ];
  const ready = checks.filter(check => check.ready).length;
  return { checks, ready, total: checks.length, percentage: Math.round((ready / checks.length) * 100) };
}

function moduleSummary(config = {}) {
  return Object.keys(MODULE_DEFAULTS)
    .map(name => `${isModuleEnabledConfig(config, name) ? '🟢' : '⚫'} ${name}`)
    .join('\n');
}

function mentionList(ids = [], kind = 'role') {
  if (!ids.length) return 'Sin configurar';
  return ids.map(id => kind === 'channel' ? `<#${id}>` : `<@&${id}>`).join(', ').slice(0, 1000);
}

module.exports = { setupChecks, moduleSummary, mentionList };
