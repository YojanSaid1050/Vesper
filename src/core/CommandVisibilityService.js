const WEB_MANAGED_COMMANDS = new Set([
  'branding', 'cache', 'resetalldb', 'vesper-comunidad', 'config-dashboard', 'forcecheck',
  'resetbranding', 'resetconfig', 'serverconfig', 'setbotavatar', 'setbotlog', 'setbotname',
  'setbotrole', 'setgoodbye', 'setlog', 'vesper-setup', 'setwelcome', 'testbranding',
  'vesper-historial', 'vesper-mod-config', 'vesper-modulo', 'vesper-musica-config',
  'tiktok-add', 'tiktok-clear', 'tiktok-list', 'tiktok-remove', 'tiktok-setchannel', 'tiktok-setpingrole',
  'twitch-add', 'twitch-clear', 'twitch-list', 'twitch-remove', 'twitch-setchannel', 'twitch-setpingrole',
  'youtube-add', 'youtube-clear', 'youtube-list', 'youtube-remove', 'youtube-setchannel', 'youtube-setpingrole'
]);

function webAdminMode() {
  const requested = String(process.env.WEB_ADMIN_MODE || 'false').toLowerCase() === 'true';
  const dashboardEnabled = String(process.env.WEB_DASHBOARD_ENABLED || 'false').toLowerCase() === 'true';
  const baseUrl = String(process.env.WEB_BASE_URL || '').trim();
  const sessionSecret = String(process.env.WEB_SESSION_SECRET || '');
  const discordOAuthSecret = String(process.env.DISCORD_OAUTH_CLIENT_SECRET || '');

  // Nunca ocultar los comandos de recuperación si el panel no está realmente
  // listo. Así un error de variables en Render no bloquea la administración.
  return requested
    && dashboardEnabled
    && /^https?:\/\//i.test(baseUrl)
    && sessionSecret.length >= 32
    && discordOAuthSecret.length > 0;
}

function commandVisible(command) {
  if (!webAdminMode()) return true;
  return !WEB_MANAGED_COMMANDS.has(command?.data?.name || command?.name);
}

module.exports = { WEB_MANAGED_COMMANDS, webAdminMode, commandVisible };
