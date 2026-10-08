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
