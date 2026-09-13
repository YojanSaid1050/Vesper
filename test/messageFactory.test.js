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

function withMainGuild(id, fn) {
  const previous = process.env.MAIN_GUILD_ID;
  process.env.MAIN_GUILD_ID = id;
  try { return fn(); }
  finally {
    if (previous === undefined) delete process.env.MAIN_GUILD_ID;
    else process.env.MAIN_GUILD_ID = previous;
  }
}

test('el Main conserva exactamente el constructor visual original', async () => {
  // Se pasa una configuración vacía para no consultar la base de datos.
  const result = await withMainGuild('main', () => factory.twitchLive('main', data, {}));
  assert.deepEqual(result, twitchEmbeds.liveEmbed(data));
});

test('los satélites reciben una alerta neutral sin referencias al void', async () => {
  const result = await withMainGuild('main', () => factory.twitchLive('satellite', data, {}));
  assert.equal(result.embeds.length, 1);
  assert.match(result.embeds[0].title, /directo en Twitch/);
  assert.equal(result.embeds[0].url, data.streamUrl);
  assert.doesNotMatch(JSON.stringify(result), /void|awakened|abyss/i);
});

test('el aviso de un satélite se puede personalizar desde el panel', async () => {
  const config = {
    embeds: {
      notify_twitch_live: {
        title: '🔴 {creator} está en vivo',
        message: 'Jugando a {game} · {viewers} viendo\n{url}',
        color: '#00FFAA'
      }
    }
  };
  const result = await withMainGuild('main', () => factory.twitchLive('satellite', data, config));
  const embed = result.embeds[0];

  assert.equal(embed.title, '🔴 Canal está en vivo');
  assert.equal(embed.description, 'Jugando a Juego · 10 viendo\nhttps://twitch.tv/canal');
  assert.equal(embed.color, 0x00FFAA);
  assert.equal(result.content, data.pingText.trim(), 'el ping al rol se conserva');
});

test('personalizar un satélite no afecta al diseño del Main', async () => {
  const config = { embeds: { notify_twitch_live: { title: 'otro', message: 'otro' } } };
  const result = await withMainGuild('main', () => factory.twitchLive('main', data, config));
  assert.deepEqual(result, twitchEmbeds.liveEmbed(data), 'el Main usa su constructor propio, no la plantilla');
});
