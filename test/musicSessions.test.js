const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MAIN_GUILD_ID = '1506580021232406540';
const GUILD = '1506580021232406540';

const MonitorState = require('../src/database/models/MonitorState');
const sessions = require('../src/core/music/sessionStore');
const { MusicService, sessionDefaults } = require('../src/core/MusicService');

// MonitorState en memoria.
function fakeStore(t, rows = new Map()) {
  t.mock.method(MonitorState, 'findOneAndUpdate', async ({ key }, { $set }) => { rows.set(key, $set.value); return null; });
  t.mock.method(MonitorState, 'deleteOne', async ({ key }) => { rows.delete(key); return { deletedCount: 1 }; });
  t.mock.method(MonitorState, 'find', () => ({ lean: async () => [...rows].map(([key, value]) => ({ key, value })) }));
  return rows;
}

function guildWith(listeners) {
  const members = new Map(listeners.map(id => [id, { user: { id, bot: false } }]));
  members.filter = fn => ({ size: [...members.values()].filter(fn).length });
  const voice = { id: 'v1', members };
  return { id: GUILD, channels: { cache: new Map([['v1', voice]]) } };
}

const TRACK = { title: 'Slow Dancing', author: 'Joji', duration: 209, provider: 'audius', streamUrl: 'https://a/1', streamExpires: Number.POSITIVE_INFINITY, requesterId: 'u1', info: { title: 'Slow Dancing' } };

test('la sesión guardada lleva lo necesario para volver y nada interno', () => {
  const player = { ...sessionDefaults({}), voiceChannelId: 'v1', textChannelId: 't1', volume: 70, loop: true, current: { ...TRACK, process: {}, prefetching: true }, queue: [{ ...TRACK, title: 'Otra' }] };
  const state = sessions.snapshot(player, 93.7);
  assert.equal(state.elapsed, 93);
  assert.equal(state.current.title, 'Slow Dancing');
  assert.equal(state.current.process, undefined);
  assert.ok(Number.isFinite(state.current.streamExpires), 'se puede guardar en JSON');
  assert.deepEqual(state.queue.map(track => track.title), ['Otra']);
  assert.equal(JSON.parse(JSON.stringify(state)).current.streamExpires, state.current.streamExpires);
});

test('tras un reinicio la música vuelve donde iba si hay alguien escuchando', async t => {
  const rows = fakeStore(t);
  rows.set(`music:${GUILD}`, { voiceChannelId: 'v1', textChannelId: 't1', volume: 70, loop: false, elapsed: 93, current: TRACK, queue: [{ ...TRACK, title: 'Otra' }], savedAt: Date.now() - 60_000 });
  const service = new MusicService({ guilds: { cache: new Map([[GUILD, guildWith(['u1'])]]) } });
  service.tools = { ok: true };
  t.mock.method(service, 'loadConfig', async () => ({ guildId: GUILD, features: { music: true }, music: {} }));
  const seeks = [];
  const anuncios = [];
  t.mock.method(service, 'join', async () => { const player = sessionDefaults({}); service.players.set(GUILD, player); return player; });
  t.mock.method(service, 'playCurrent', async (guildId, seek) => { seeks.push(seek); });
  t.mock.method(service, 'announce', (player, text) => { anuncios.push(text); });

  assert.equal(await service.restoreSessions(), 1);
  const player = service.players.get(GUILD);
  assert.equal(player.current.title, 'Slow Dancing');
  assert.deepEqual(player.queue.map(track => track.title), ['Otra']);
  assert.equal(player.volume, 70);
  assert.deepEqual(seeks, [93], 'sigue por el segundo 93');
  assert.match(anuncios[0], /Volví: sigo con \*\*Slow Dancing\*\*/);
  service.shuttingDown = true; // que la prueba no deje guardados pendientes
});

test('sin nadie en el canal, o si pasó demasiado tiempo, la sesión se descarta', async t => {
  const rows = fakeStore(t);
  rows.set(`music:${GUILD}`, { voiceChannelId: 'v1', elapsed: 10, current: TRACK, queue: [], savedAt: Date.now() });
  const empty = new MusicService({ guilds: { cache: new Map([[GUILD, guildWith([])]]) } });
  empty.tools = { ok: true };
  t.mock.method(empty, 'loadConfig', async () => ({ guildId: GUILD, features: { music: true }, music: {} }));
  assert.equal(await empty.restoreSessions(), 0);
  assert.equal(rows.size, 0, 'canal vacío: no se retoma y se borra');

  rows.set(`music:${GUILD}`, { voiceChannelId: 'v1', elapsed: 10, current: TRACK, queue: [], savedAt: Date.now() - sessions.RESTORE_WINDOW_MS - 1 });
  const late = new MusicService({ guilds: { cache: new Map([[GUILD, guildWith(['u1'])]]) } });
  late.tools = { ok: true };
  t.mock.method(late, 'loadConfig', async () => ({ guildId: GUILD, features: { music: true }, music: {} }));
  assert.equal(await late.restoreSessions(), 0);
  assert.equal(rows.size, 0, 'más de dos horas: se descarta');
});

test('al apagarse se guarda por dónde iba cada servidor', async t => {
  const rows = fakeStore(t);
  const service = new MusicService({});
  const player = { ...sessionDefaults({}), voiceChannelId: 'v1', textChannelId: 't1', current: { ...TRACK }, startedAt: Date.now() - 40_000 };
  service.players.set(GUILD, player);
  await service.shutdown();
  const saved = rows.get(`music:${GUILD}`);
  assert.equal(saved.current.title, 'Slow Dancing');
  assert.ok(saved.elapsed >= 39 && saved.elapsed <= 41, `posición ${saved.elapsed}`);
});
