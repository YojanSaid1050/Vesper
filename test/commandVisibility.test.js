const test = require('node:test');
const assert = require('node:assert/strict');
const { WEB_MANAGED_COMMANDS, webAdminMode, commandVisible } = require('../src/core/CommandVisibilityService');

test('el modo web oculta comandos administrativos pero conserva los de uso diario', () => {
  const names = [
    'WEB_ADMIN_MODE',
    'WEB_DASHBOARD_ENABLED',
    'WEB_BASE_URL',
    'WEB_SESSION_SECRET',
    'DISCORD_OAUTH_CLIENT_SECRET'
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));

  try {
    process.env.WEB_ADMIN_MODE = 'true';
    process.env.WEB_DASHBOARD_ENABLED = 'true';
    process.env.WEB_BASE_URL = 'https://vesper.example.com';
    process.env.WEB_SESSION_SECRET = 'x'.repeat(48);
    process.env.DISCORD_OAUTH_CLIENT_SECRET = 'oauth-secret';

    assert.equal(webAdminMode(), true);
    assert.equal(commandVisible({ data: { name: 'vesper-setup' } }), false);
    assert.equal(commandVisible({ data: { name: 'twitch-add' } }), false);
    assert.equal(commandVisible({ data: { name: 'musica' } }), true);
    assert.equal(commandVisible({ data: { name: 'ticket' } }), true);
    assert.equal(WEB_MANAGED_COMMANDS.size, 40);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test('conserva los comandos de recuperación si el panel está incompleto', () => {
  const previousMode = process.env.WEB_ADMIN_MODE;
  const previousDashboard = process.env.WEB_DASHBOARD_ENABLED;
  process.env.WEB_ADMIN_MODE = 'true';
  process.env.WEB_DASHBOARD_ENABLED = 'false';

  try {
    assert.equal(webAdminMode(), false);
    assert.equal(commandVisible({ data: { name: 'vesper-setup' } }), true);
  } finally {
    if (previousMode === undefined) delete process.env.WEB_ADMIN_MODE;
    else process.env.WEB_ADMIN_MODE = previousMode;
    if (previousDashboard === undefined) delete process.env.WEB_DASHBOARD_ENABLED;
    else process.env.WEB_DASHBOARD_ENABLED = previousDashboard;
  }
});
