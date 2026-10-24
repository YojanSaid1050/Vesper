// El controlador fijo de música: el bloque con los botones dentro, cómo cambia
// según suene algo o no, y las peticiones escritas en su canal.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ContainerBuilder } = require('discord.js');

const configs = new Map();
const mongoPath = require.resolve('../src/database/mongoManager');
require.cache[mongoPath] = {
  id: mongoPath, filename: mongoPath, loaded: true,
  exports: {
    getGuildConfig: async guildId => configs.get(guildId) || { guildId, features: { music: true }, music: {} },
    updateGuildSection: async () => null
  }
};

const { controllerPayload, handleMusicRequest, handleMusicButton } = require('../src/core/music/controller');
const { MusicService } = require('../src/core/MusicService');

const MAIN = '1506580021232406540';
const THEMED = '1124871897688055818';
process.env.MAIN_GUILD_ID = MAIN;
process.env.THEMED_MAIN_GUILD_IDS = THEMED;

function partes(payload) {
  return payload.components[0].components;
}

function botones(payload) {
  return partes(payload).filter(part => part.type === 1).flatMap(row => row.components);
}

function textos(payload) {
  return partes(payload).flatMap(part => part.type === 9 ? part.components : [part]).filter(part => part.type === 10).map(part => part.content).join('\n');
}

function sesion(extra = {}) {
  return {
    current: { title: 'Slow Dancing in the Dark', author: 'Joji', duration: 209, pageUrl: 'https://soundcloud.com/joji/sditd', provider: 'soundcloud', thumbnail: 'https://i1.sndcdn.com/artworks-x.jpg', requesterId: '700000000000000002' },
    queue: [], history: [], volume: 50, loop: false, voiceChannelId: '900000000000000010', skipVotes: new Set(), settings: {},
    ...extra
  };
}

test('en espera: un único bloque V2 con los botones dentro y el banner del tema', t => {
  const previous = process.env.WEB_BASE_URL;
  t.after(() => { if (previous === undefined) delete process.env.WEB_BASE_URL; else process.env.WEB_BASE_URL = previous; });
  process.env.WEB_BASE_URL = 'https://vesper-q5jv.onrender.com';

  const payload = controllerPayload({ guild: { id: THEMED, name: 'Ankerie Dimension' }, config: { guildId: THEMED } });
  assert.equal(payload.flags, 32768);
  assert.equal(payload.components.length, 1);
  assert.doesNotThrow(() => new ContainerBuilder(payload.components[0]).toJSON());
  assert.match(textos(payload), /Rocola Limón/);
  const galeria = partes(payload).find(part => part.type === 12);
  assert.equal(galeria.items[0].media.url, 'https://vesper-q5jv.onrender.com/panel/assets/img/musica-limones.png');

  const lista = botones(payload);
  assert.equal(lista.length, 10);
  const reproduccion = lista.filter(button => ['music:pause', 'music:skip', 'music:stop', 'music:volup'].includes(button.custom_id));
  assert.ok(reproduccion.every(button => button.disabled), 'sin canción los controles están apagados');
  assert.ok(lista.some(button => button.url === 'https://vesper-q5jv.onrender.com/panel'), 'enlace al panel');
});

test('cada Main tiene su propio controlador', () => {
  const titulo = guildId => textos(controllerPayload({ guild: { id: guildId, name: 'x' }, config: { guildId } }));
  assert.match(titulo(MAIN), /Resonancia del Vacío/);
  assert.match(titulo(THEMED), /Rocola Limón/);
  assert.match(titulo('999999999999999999'), /Controlador de música/);
});

test('sonando: la canción con su portada y los controles encendidos', () => {
  const payload = controllerPayload({ guild: { id: MAIN, name: 'Embers Void' }, config: { guildId: MAIN }, player: sesion() });
  assert.doesNotThrow(() => new ContainerBuilder(payload.components[0]).toJSON());
  const seccion = partes(payload).find(part => part.type === 9);
  assert.equal(seccion.accessory.media.url, 'https://i1.sndcdn.com/artworks-x.jpg');
  const texto = textos(payload);
  assert.match(texto, /\[Slow Dancing in the Dark\]\(https:\/\/soundcloud\.com\/joji\/sditd\)/);
  assert.match(texto, /3:29/);
  assert.match(texto, /<@700000000000000002>/);
  assert.match(texto, /SoundCloud/);
  assert.doesNotMatch(texto, /\{\w+\}/, 'sin huecos sin rellenar');

  const porId = Object.fromEntries(botones(payload).filter(button => button.custom_id).map(button => [button.custom_id, button]));
  assert.equal(porId['music:pause'].disabled, false);
  assert.equal(porId['music:previous'].disabled, true, 'sin historial no hay anterior');
  assert.equal(porId['music:shuffle'].disabled, true, 'con menos de dos en cola no se mezcla');

  const pausado = controllerPayload({ guild: { id: MAIN, name: 'x' }, config: { guildId: MAIN }, player: sesion({ history: [{}] }), paused: true });
  const ids = botones(pausado).map(button => button.custom_id);
  assert.ok(ids.includes('music:resume'));
  assert.match(textos(pausado), /En pausa/);
});

test('anterior, mezclar y bucle funcionan sobre la cola', async () => {
  const music = new MusicService({ channels: { cache: new Map() } });
  const changes = [];
  music.onChange = guildId => changes.push(guildId);
  const a = { title: 'A' }; const b = { title: 'B' }; const c = { title: 'C' }; const d = { title: 'D' };
  music.players.set('g', sesion({ current: a, history: [b], queue: [c, d] }));
  await music.previous('g');
  const player = music.players.get('g');
  assert.equal(player.current, b);
  assert.deepEqual(player.queue.map(track => track.title), ['A', 'C', 'D']);
  assert.equal(player.history.length, 0, 'volver atrás no ensucia el historial');
  assert.equal(music.shuffle('g'), 3);
  assert.equal(music.setLoop('g', true), true);
  assert.ok(changes.length >= 2, 'el controlador se entera de los cambios');
  if (player.idleTimer) clearTimeout(player.idleTimer);
});

test('escribir en el canal del controlador pide la canción y limpia el canal', async () => {
  configs.set(MAIN, { guildId: MAIN, features: { music: true }, music: { controllerChannel: 'c1' } });
  const pedidos = [];
  const enviados = [];
  let borrado = false;
  const client = { music: { enqueue: async (request, query) => { pedidos.push([request, query]); return { position: 2, item: { title: 'Hola' } }; } } };
  const message = {
    guild: { id: MAIN }, channelId: 'c1', content: '  joji slow dancing ', author: { id: 'u1', bot: false, toString: () => '<@u1>' }, member: { voice: {} },
    delete: async () => { borrado = true; },
    channel: { sendTyping: async () => null, send: async payload => { enviados.push(payload.content); return { delete: async () => null }; } }
  };
  assert.equal(await handleMusicRequest(message, client), true);
  assert.equal(pedidos[0][1], 'joji slow dancing');
  assert.equal(pedidos[0][0].user, message.author);
  assert.match(enviados[0], /posición 2/);
  await new Promise(resolve => setTimeout(resolve, 1_700));
  assert.equal(borrado, true);

  // En otro canal no se toca nada.
  assert.equal(await handleMusicRequest({ ...message, channelId: 'otro' }, client), false);
});

test('un botón sin estar en el canal de voz explica qué hacer', async () => {
  const respuestas = [];
  const music = { queue: () => sesion(), paused: () => false };
  const interaction = {
    customId: 'music:skip', guildId: 'g2', user: { id: 'u9' }, member: { voice: { channelId: null } },
    reply: async payload => { respuestas.push(payload.content); }
  };
  assert.equal(await handleMusicButton(interaction, { music }), true);
  assert.match(respuestas[0], /Entra a <#900000000000000010>/);
});
