const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isMainGuild,
  isThemedMainGuild,
  guildTier,
  isApprovedGuild,
  moduleDefaults,
  isModuleEnabledConfig,
  commandAvailable
} = require('../src/config/guildPolicy');

test('separa Main, satélites aprobados y servidores externos', () => {
  const previousMain = process.env.MAIN_GUILD_ID;
  const previousApproved = process.env.APPROVED_GUILD_IDS;
  const previousThemed = process.env.THEMED_MAIN_GUILD_IDS;
  process.env.MAIN_GUILD_ID = 'main';
  process.env.APPROVED_GUILD_IDS = 'sat-1,sat-2';
  process.env.THEMED_MAIN_GUILD_IDS = 'anke';
  assert.equal(isMainGuild('main'), true);
  assert.equal(isMainGuild('sat-1'), false);
  assert.equal(isApprovedGuild('sat-2'), true);
  assert.equal(isThemedMainGuild('anke'), true);
  assert.equal(isApprovedGuild('anke'), true);
  assert.equal(guildTier('main'), 'primary_main');
  assert.equal(guildTier('anke'), 'themed_main');
  assert.equal(guildTier('sat-1'), 'satellite');
  assert.equal(isApprovedGuild('external'), false);
  assert.equal(commandAvailable({ scope: 'main' }, 'sat-1'), false);
  assert.equal(commandAvailable({ scope: 'main' }, 'main'), true);
  assert.equal(commandAvailable({ scope: 'main' }, 'anke'), false);
  assert.equal(commandAvailable({ scope: 'themed_main' }, 'anke'), true);
  assert.equal(commandAvailable({ scope: 'satellite' }, 'anke'), false);
  assert.equal(commandAvailable({}, 'sat-1'), true);
  if (previousMain === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = previousMain;
  if (previousApproved === undefined) delete process.env.APPROVED_GUILD_IDS; else process.env.APPROVED_GUILD_IDS = previousApproved;
  if (previousThemed === undefined) delete process.env.THEMED_MAIN_GUILD_IDS; else process.env.THEMED_MAIN_GUILD_IDS = previousThemed;
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

test('la lista de servidores es cerrada por defecto', () => {
  const previousMain = process.env.MAIN_GUILD_ID;
  const previousApproved = process.env.APPROVED_GUILD_IDS;
  const previousCompatibility = process.env.ALLOW_UNLISTED_GUILDS;
  process.env.MAIN_GUILD_ID = 'main';
  delete process.env.APPROVED_GUILD_IDS;
  delete process.env.ALLOW_UNLISTED_GUILDS;
  assert.equal(isApprovedGuild('main'), true);
  assert.equal(isApprovedGuild('external'), false);
  process.env.ALLOW_UNLISTED_GUILDS = 'true';
  assert.equal(isApprovedGuild('external'), true);
  if (previousMain === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = previousMain;
  if (previousApproved === undefined) delete process.env.APPROVED_GUILD_IDS; else process.env.APPROVED_GUILD_IDS = previousApproved;
  if (previousCompatibility === undefined) delete process.env.ALLOW_UNLISTED_GUILDS; else process.env.ALLOW_UNLISTED_GUILDS = previousCompatibility;
});
