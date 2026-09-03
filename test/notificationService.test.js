const test = require('node:test');
const assert = require('node:assert/strict');
const { eventKey, transientError, endedPayload } = require('../src/core/NotificationService');

test('la clave de notificación evita duplicados por evento', () => {
  const one = eventKey({ guildId: '1', platform: 'twitch', account: 'Canal', eventType: 'live_started', eventId: '99' });
  const two = eventKey({ guildId: '1', platform: 'twitch', account: 'canal', eventType: 'live_started', eventId: '99' });
  assert.equal(one, two);
  assert.notEqual(one, eventKey({ guildId: '2', platform: 'twitch', account: 'canal', eventType: 'live_started', eventId: '99' }));
});

test('solo reintenta errores temporales', () => {
  assert.equal(transientError({ status: 429 }), true);
  assert.equal(transientError({ status: 503 }), true);
  assert.equal(transientError({ code: 'ETIMEDOUT' }), true);
  assert.equal(transientError({ status: 403 }), false);
});

test('al finalizar un directo conserva el payload y elimina menciones', () => {
  const original = { components: [{ type: 17, components: [{ type: 10, content: 'Directo <@&123456789012345678>' }] }] };
  const ended = endedPayload(original, 3720);
  assert.doesNotMatch(ended.components[0].components[0].content, /<@&/);
  assert.match(ended.components[0].components[0].content, /1 h 2 min/);
  assert.match(ended.components[0].components[0].content, /finalizada/);
  assert.match(original.components[0].components[0].content, /<@&/);
});
