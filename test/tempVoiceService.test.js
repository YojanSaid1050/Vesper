const test = require('node:test');
const assert = require('node:assert/strict');
const { ContainerBuilder } = require('discord.js');
const { roomName, cleanChannelName, interfacePayload, BUTTONS } = require('../src/core/TempVoiceService');

const member = { displayName: 'Nube Azul', user: { username: 'yojansaid1050', globalName: 'xyojansaidx' } };

test('la sala usa el nombre visible del perfil, no el @usuario', () => {
  assert.equal(roomName('Sala de {username}', member), 'Sala de xyojansaidx');
  assert.equal(roomName('Sala de {displayName}', member), 'Sala de Nube Azul');
  assert.equal(roomName('{handle}\n privada', member), 'yojansaid1050 privada');
  // Sin nombre visible se usa el @usuario.
  assert.equal(roomName('Sala de {username}', { user: { username: 'solo' } }), 'Sala de solo');
  assert.equal(cleanChannelName('  hola   mundo  '), 'hola mundo');
});

function botonesDe(payload) {
  const container = payload.components[0];
  return container.components.filter(part => part.type === 1).flatMap(row => row.components);
}

test('la interfaz lleva los 15 botones dentro del contenedor', () => {
  const payload = interfacePayload({ guild: { name: 'Ankerie Dimension' }, config: { tempVoice: { generatorChannel: '900000000000000009' } } });
  assert.equal(payload.flags, 32768, 'Components V2');
  assert.equal(payload.components.length, 1, 'todo va dentro de un único bloque');
  assert.doesNotThrow(() => new ContainerBuilder(payload.components[0]).toJSON());
  const ids = botonesDe(payload).map(button => button.custom_id);
  assert.equal(ids.length, 15);
  assert.deepEqual(ids, BUTTONS.flat().map(([action]) => `tempvoice:${action}`));
  const texto = payload.components[0].components.filter(part => part.type === 10).map(part => part.content).join('\n');
  assert.match(texto, /<#900000000000000009>/);
});

test('cada Main ve la interfaz con su tema', t => {
  const previous = { main: process.env.MAIN_GUILD_ID, themed: process.env.THEMED_MAIN_GUILD_IDS };
  t.after(() => {
    for (const [key, value] of [['MAIN_GUILD_ID', previous.main], ['THEMED_MAIN_GUILD_IDS', previous.themed]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.MAIN_GUILD_ID = '1506580021232406540';
  process.env.THEMED_MAIN_GUILD_IDS = '1124871897688055818';
  const titulo = guildId => interfacePayload({ guild: { name: 'x' }, config: { guildId } }).components[0].components[0].content;
  assert.match(titulo('1506580021232406540'), /Cámaras del Vacío/);
  assert.match(titulo('1124871897688055818'), /Salitas Limón/);
  assert.match(titulo('999999999999999999'), /Salas de voz/);
  // Lo escrito en el panel manda sobre el tema.
  const propio = interfacePayload({ guild: { name: 'x' }, config: { guildId: '1124871897688055818', embeds: { tempvoice_interface: { title: '## Mis salas' } } } });
  assert.equal(propio.components[0].components[0].content, '## Mis salas');
});

test('la copia de cada sala dice de quién es y en qué estado está', () => {
  const payload = interfacePayload({ guild: { name: 'x' }, config: null, room: { ownerId: '100000000000000001', channelId: '900000000000000001', locked: true, hidden: false } });
  const texto = payload.components[0].components.filter(part => part.type === 10).map(part => part.content).join('\n');
  assert.match(texto, /<@100000000000000001>/);
  assert.match(texto, /Cerrada/);
  assert.equal(botonesDe(payload).length, 15);
});

function fakeCollection(entries) {
  const map = new Map(entries);
  map.filter = predicate => fakeCollection([...map].filter(([, value]) => predicate(value)));
  map.first = () => map.values().next().value;
  return map;
}

test('la sala se transfiere aunque el último en salir no sea el propietario', async t => {
  const TemporaryVoiceChannel = require('../src/database/models/TemporaryVoiceChannel');
  const record = { channelId: '900000000000000001', ownerId: '100000000000000001', controlMessageId: null, saved: 0 };
  record.save = async () => { record.saved++; };
  t.mock.method(TemporaryVoiceChannel, 'findOne', async () => record);
  const edits = [];
  const deletes = [];
  const channel = {
    members: fakeCollection([['100000000000000003', { id: '100000000000000003', user: { bot: false } }]]),
    permissionOverwrites: {
      edit: async (id, perms) => { edits.push([id, perms]); },
      delete: async id => { deletes.push(id); }
    }
  };
  const guild = { channels: { cache: new Map([[record.channelId, channel]]), fetch: async () => null } };

  const { settleRoom } = require('../src/core/TempVoiceService');
  await settleRoom(guild, record.channelId);

  assert.equal(record.ownerId, '100000000000000003');
  assert.equal(record.saved, 1);
  assert.deepEqual(deletes, ['100000000000000001']);
  assert.equal(edits[0][0], '100000000000000003');
});

test('una sala vacía se elimina con su registro', async t => {
  const TemporaryVoiceChannel = require('../src/database/models/TemporaryVoiceChannel');
  const record = { channelId: '900000000000000002', ownerId: '100000000000000001' };
  t.mock.method(TemporaryVoiceChannel, 'findOne', async () => record);
  const removed = t.mock.method(TemporaryVoiceChannel, 'deleteOne', async () => ({ deletedCount: 1 }));
  let deleted = false;
  const channel = { members: fakeCollection([['bot', { id: 'bot', user: { bot: true } }]]), delete: async () => { deleted = true; } };
  const guild = { channels: { cache: new Map([[record.channelId, channel]]), fetch: async () => null } };

  const { settleRoom } = require('../src/core/TempVoiceService');
  await settleRoom(guild, record.channelId);

  assert.equal(removed.mock.callCount(), 1);
  assert.equal(deleted, true);
});

test('una sala cerrada desde el botón no se vuelve a procesar', async t => {
  const TemporaryVoiceChannel = require('../src/database/models/TemporaryVoiceChannel');
  t.mock.method(TemporaryVoiceChannel, 'findOne', async () => null);
  const removed = t.mock.method(TemporaryVoiceChannel, 'deleteOne', async () => ({ deletedCount: 0 }));
  const guild = { channels: { cache: new Map(), fetch: async () => { throw new Error('no debería consultarse'); } } };

  const { settleRoom } = require('../src/core/TempVoiceService');
  await settleRoom(guild, '900000000000000003');

  assert.equal(removed.mock.callCount(), 0);
});
