const test = require('node:test');
const assert = require('node:assert/strict');
const { profileForGuild, neutralWelcomePayload, neutralGoodbyePayload, themedWelcomePayload, themedGoodbyePayload } = require('../src/core/PersonalityService');

test('usa personalidad Main únicamente en el servidor principal', () => {
  const previous = process.env.MAIN_GUILD_ID;
  process.env.MAIN_GUILD_ID = 'main';
  assert.equal(profileForGuild('main'), 'main');
  assert.equal(profileForGuild('satellite'), 'neutral');
  if (previous === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = previous;
});

test('Ankerie Dimension usa un perfil temático aislado de Embers Void', () => {
  const previousMain = process.env.MAIN_GUILD_ID;
  const previousThemed = process.env.THEMED_MAIN_GUILD_IDS;
  process.env.MAIN_GUILD_ID = 'main';
  process.env.THEMED_MAIN_GUILD_IDS = 'anke';
  assert.equal(profileForGuild('anke'), 'themed_main');
  const member = {
    toString: () => '<@1>',
    guild: { name: 'Ankerie Dimension' },
    user: { username: 'Usuario', displayAvatarURL: () => 'https://example.com/avatar.png' }
  };
  const welcome = themedWelcomePayload(member, { displayName: 'AnkeBot', primaryColor: '#8DDCF4' });
  const goodbye = themedGoodbyePayload(member, { displayName: 'AnkeBot', secondaryColor: '#F8C8DC' });
  assert.match(welcome.embeds[0].footer.text, /AnkeBot/);
  assert.match(welcome.embeds[0].description, /Ankerie Dimension/);
  assert.doesNotMatch(welcome.embeds[0].description, /void|ember/i);
  assert.doesNotMatch(goodbye.embeds[0].description, /void|ember/i);
  if (previousMain === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = previousMain;
  if (previousThemed === undefined) delete process.env.THEMED_MAIN_GUILD_IDS; else process.env.THEMED_MAIN_GUILD_IDS = previousThemed;
});

test('los mensajes satélite son neutrales y usan el nombre del servidor', () => {
  const member = {
    toString: () => '<@1>',
    guild: { name: 'Servidor Secundario' },
    user: { username: 'Usuario', displayAvatarURL: () => 'https://example.com/avatar.png' }
  };
  const welcome = neutralWelcomePayload(member);
  const goodbye = neutralGoodbyePayload(member);
  assert.match(welcome.embeds[0].description, /Servidor Secundario/);
  assert.doesNotMatch(welcome.embeds[0].description, /void|ember/i);
  assert.doesNotMatch(goodbye.embeds[0].description, /void|ember/i);
});
