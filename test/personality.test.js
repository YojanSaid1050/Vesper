const test = require('node:test');
const assert = require('node:assert/strict');
const { profileForGuild, neutralWelcomePayload, neutralGoodbyePayload } = require('../src/core/PersonalityService');

test('usa personalidad Main únicamente en el servidor principal', () => {
  const previous = process.env.MAIN_GUILD_ID;
  process.env.MAIN_GUILD_ID = 'main';
  assert.equal(profileForGuild('main'), 'main');
  assert.equal(profileForGuild('satellite'), 'neutral');
  if (previous === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = previous;
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
