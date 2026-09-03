const test = require('node:test');
const assert = require('node:assert/strict');
const { MusicService, lavalinkConfig, wsUrl, sessionDefaults } = require('../src/core/MusicService');

test('convierte correctamente las URLs HTTP de Lavalink a WebSocket', () => {
  assert.equal(wsUrl('http://127.0.0.1:2333'), 'ws://127.0.0.1:2333/v4/websocket');
  assert.equal(wsUrl('https://music.example.com'), 'wss://music.example.com/v4/websocket');
});

test('la música permanece desconfigurada sin URL y contraseña', () => {
  const oldUrl = process.env.LAVALINK_URL;
  const oldPassword = process.env.LAVALINK_PASSWORD;
  delete process.env.LAVALINK_URL;
  delete process.env.LAVALINK_PASSWORD;
  assert.equal(lavalinkConfig().configured, false);
  const session = sessionDefaults({ defaultVolume: 35 });
  assert.equal(session.volume, 35);
  assert.equal(session.queue.length, 0);
  if (oldUrl !== undefined) process.env.LAVALINK_URL = oldUrl;
  if (oldPassword !== undefined) process.env.LAVALINK_PASSWORD = oldPassword;
});

test('rechaza canciones duplicadas y respeta el límite pendiente por usuario', async () => {
  const service = new MusicService({});
  const player = sessionDefaults({ maxQueue: 10, maxPerUser: 1, maxTrackMinutes: 15 });
  const voiceChannel = { id: 'voice' };
  service.ensureAllowed = async () => ({ config: { music: player.settings }, voiceChannel });
  service.join = async () => player;
  service.advance = async () => { if (!player.current) player.current = player.queue.shift() || null; };
  let sequence = 0;
  service.loadTrack = async query => ({ encoded: query, info: { title: query, uri: `https://youtube.com/watch?v=${query}`, length: 1000, isStream: false }, sequence: sequence++ });
  const interaction = { guildId: 'guild', channelId: 'text', user: { id: 'user' }, guild: {} };

  await service.enqueue(interaction, 'one');
  await assert.rejects(() => service.enqueue(interaction, 'one'), /ya está/);
  await service.enqueue(interaction, 'two');
  await assert.rejects(() => service.enqueue(interaction, 'three'), /máximo 1/);
});
