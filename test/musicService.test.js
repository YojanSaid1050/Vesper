const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const { MusicService, lavalinkConfig, normalizeLavalinkUrl, wsUrl, sessionDefaults, voicePermissionIssues } = require('../src/core/MusicService');

test('convierte correctamente las URLs HTTP de Lavalink a WebSocket', () => {
  assert.equal(wsUrl('http://127.0.0.1:2333'), 'ws://127.0.0.1:2333/v4/websocket');
  assert.equal(wsUrl('https://music.example.com'), 'wss://music.example.com/v4/websocket');
});

test('normaliza URLs WebSocket y barras finales para las llamadas REST', () => {
  assert.equal(normalizeLavalinkUrl('wss://music.example.com///'), 'https://music.example.com');
  assert.equal(normalizeLavalinkUrl(' ws://127.0.0.1:2333/ '), 'http://127.0.0.1:2333');
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

test('usa el Lavalink local cuando el modo integrado está activo', () => {
  const previous = {
    embedded: process.env.LAVALINK_EMBEDDED,
    url: process.env.LAVALINK_URL,
    password: process.env.LAVALINK_PASSWORD
  };
  process.env.LAVALINK_EMBEDDED = 'true';
  delete process.env.LAVALINK_URL;
  process.env.LAVALINK_PASSWORD = 'test-password';
  assert.deepEqual(lavalinkConfig(), {
    url: 'http://127.0.0.1:2333',
    password: 'test-password',
    configured: true,
    mode: 'integrado'
  });
  for (const [key, value] of Object.entries({ LAVALINK_EMBEDDED: previous.embedded, LAVALINK_URL: previous.url, LAVALINK_PASSWORD: previous.password })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('informa exactamente los permisos de voz que faltan', () => {
  const allowed = new Set([PermissionFlagsBits.ViewChannel]);
  const guild = { members: { me: { id: 'bot' } } };
  const voiceChannel = { permissionsFor: () => ({ has: permission => allowed.has(permission) }) };
  assert.deepEqual(voicePermissionIssues(guild, voiceChannel), ['Conectar', 'Hablar']);
});

test('espera una conexión Lavalink que termina de iniciar', async () => {
  const service = new MusicService({});
  service.connect = () => setTimeout(() => { service.sessionId = 'ready'; }, 25);
  assert.equal(await service.waitUntilReady(500), true);
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
