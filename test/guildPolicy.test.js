const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isMainGuild,
  isApprovedGuild,
  moduleDefaults,
  isModuleEnabledConfig,
  commandAvailable
} = require('../src/config/guildPolicy');

test('separa Main, satélites aprobados y servidores externos', () => {
  const previousMain = process.env.MAIN_GUILD_ID;
  const previousApproved = process.env.APPROVED_GUILD_IDS;
  process.env.MAIN_GUILD_ID = 'main';
  process.env.APPROVED_GUILD_IDS = 'sat-1,sat-2';
  assert.equal(isMainGuild('main'), true);
  assert.equal(isMainGuild('sat-1'), false);
  assert.equal(isApprovedGuild('sat-2'), true);
  assert.equal(isApprovedGuild('external'), false);
  assert.equal(commandAvailable({ scope: 'main' }, 'sat-1'), false);
  assert.equal(commandAvailable({ scope: 'main' }, 'main'), true);
  assert.equal(commandAvailable({}, 'sat-1'), true);
  if (previousMain === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = previousMain;
  if (previousApproved === undefined) delete process.env.APPROVED_GUILD_IDS; else process.env.APPROVED_GUILD_IDS = previousApproved;
});

test('los módulos conservan valores seguros y permiten anulación por servidor', () => {
  const defaults = moduleDefaults();
  assert.equal(defaults.music, false);
  assert.equal(defaults.moderation, false);
  assert.equal(defaults.tiktok, true);
  assert.equal(isModuleEnabledConfig({}, 'youtube'), true);
  assert.equal(isModuleEnabledConfig({ features: { youtube: false } }, 'youtube'), false);
  assert.equal(isModuleEnabledConfig({ features: { music: true } }, 'music'), true);
});
