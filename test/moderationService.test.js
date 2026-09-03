const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDomain, domainAllowed, repeatedMessage } = require('../src/core/ModerationService');

test('normaliza dominios y admite subdominios de la lista segura', () => {
  assert.equal(normalizeDomain('https://www.example.com/path'), 'example.com');
  assert.equal(domainAllowed('cdn.example.com', ['example.com']), true);
  assert.equal(domainAllowed('example.com.attacker.test', ['example.com']), false);
});

test('detecta repeticiones dentro de la misma combinación servidor/usuario', () => {
  const message = { guild: { id: 'guild' }, author: { id: 'user' }, content: 'mensaje repetido' };
  assert.equal(repeatedMessage(message, 3), false);
  assert.equal(repeatedMessage(message, 3), false);
  assert.equal(repeatedMessage(message, 3), true);
  const other = { guild: { id: 'guild' }, author: { id: 'other' }, content: 'mensaje repetido' };
  assert.equal(repeatedMessage(other, 3), false);
});
