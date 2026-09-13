const test = require('node:test');
const assert = require('node:assert/strict');
const { setupChecks, moduleSummary, mentionList } = require('../src/core/SetupService');

test('el asistente identifica una configuración incompleta', () => {
  const status = setupChecks({
    features: { tiktok: true, twitch: false, youtube: false, welcome: false, goodbye: false, logs: true, music: false },
    general: {},
    tiktok: { users: [] },
    permissions: {}
  });
  assert.ok(status.percentage < 100);
  assert.equal(status.checks.find(check => check.key === 'tiktok').ready, false);
  assert.equal(status.checks.find(check => check.key === 'twitch').ready, true);
});

test('el asistente reconoce canales, cuentas y roles configurados', () => {
  const status = setupChecks({
    features: { tiktok: true, twitch: true, youtube: true, welcome: true, goodbye: true, logs: true, music: true },
    general: { logChannel: '1', welcomeChannel: '2', goodbyeChannel: '3' },
    tiktok: { users: ['user'], liveChannel: '4' },
    twitch: { users: ['user'], liveChannel: '5' },
    youtube: { users: ['channel'], videoChannel: '6' },
    music: { requestChannel: '7' },
    permissions: { moderatorRoles: ['8'] }
  });
  assert.equal(status.percentage, 100);
  assert.match(moduleSummary({ features: { music: true } }), /🟢 music/);
  assert.equal(mentionList(['8']), '<@&8>');
  assert.equal(mentionList(['7'], 'channel'), '<#7>');
});

test('los comandos manuales de moderación están disponibles en satélites', () => {
  for (const path of ['warn', 'timeout', 'modhistory', 'case']) {
    const command = require(`../src/commands/moderation/${path}`);
    assert.notEqual(command.scope, 'main');
  }
});
