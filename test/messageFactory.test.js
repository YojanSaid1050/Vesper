const test = require('node:test');
const assert = require('node:assert/strict');
const factory = require('../src/platforms/messageFactory');
const twitchEmbeds = require('../src/platforms/twitch/embeds');

const data = {
  streamer: 'Canal',
  title: 'Directo de prueba',
  game: 'Juego',
  viewers: 10,
  thumbnail: 'https://example.com/image.jpg',
  streamUrl: 'https://twitch.tv/canal',
  pingText: '<@&123456789012345678>\n\n'
};

test('el Main conserva exactamente el constructor visual original', () => {
  const previous = process.env.MAIN_GUILD_ID;
  process.env.MAIN_GUILD_ID = 'main';
  assert.deepEqual(factory.twitchLive('main', data), twitchEmbeds.liveEmbed(data));
  if (previous === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = previous;
});

test('los satélites reciben una alerta neutral sin referencias al void', () => {
  const previous = process.env.MAIN_GUILD_ID;
  process.env.MAIN_GUILD_ID = 'main';
  const result = factory.twitchLive('satellite', data);
  assert.equal(result.embeds.length, 1);
  assert.match(result.embeds[0].data.title, /directo en Twitch/);
  assert.doesNotMatch(JSON.stringify(result), /void|awakened|abyss/i);
  if (previous === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = previous;
});
