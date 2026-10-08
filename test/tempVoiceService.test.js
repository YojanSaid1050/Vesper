const test = require('node:test');
const assert = require('node:assert/strict');
const { roomName, cleanChannelName, controlPayload } = require('../src/core/TempVoiceService');

const member = { displayName: 'Nube Azul', user: { username: 'yojan' } };

test('los nombres temporales sustituyen variables y eliminan saltos de línea', () => {
  assert.equal(roomName('Sala de {displayName}', member), 'Sala de Nube Azul');
  assert.equal(roomName('{username}\n privada', member), 'yojan privada');
  assert.equal(cleanChannelName('  hola   mundo  '), 'hola mundo');
});

test('el panel de sala cambia sus acciones según bloqueo y visibilidad', () => {
  const open = controlPayload('123456789012345678', { locked: false, hidden: false }).components[0].toJSON().components;
  assert.equal(open[2].custom_id, 'tempvoice:lock');
  assert.equal(open[3].custom_id, 'tempvoice:hide');
  const closed = controlPayload('123456789012345678', { locked: true, hidden: true }).components[0].toJSON().components;
  assert.equal(closed[2].custom_id, 'tempvoice:unlock');
  assert.equal(closed[3].custom_id, 'tempvoice:show');
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
