const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDomain, normalizeAllowedDomain, domainAllowed, repeatedMessage, isExempt, caseIdentifier } = require('../src/core/ModerationService');
const ModerationCase = require('../src/database/models/ModerationCase');

test('normaliza dominios y admite subdominios de la lista segura', () => {
  assert.equal(normalizeDomain('https://www.example.com/path'), 'example.com');
  assert.equal(domainAllowed('cdn.example.com', ['example.com']), true);
  assert.equal(domainAllowed('example.com.attacker.test', ['example.com']), false);
});

test('normaliza dominios de configuración y rechaza protocolos ajenos', () => {
  assert.equal(normalizeAllowedDomain('https://www.Example.com/ruta'), 'example.com');
  assert.equal(normalizeAllowedDomain('sub.example.com'), 'sub.example.com');
  assert.equal(normalizeAllowedDomain('javascript:alert(1)'), null);
});

test('respeta exclusiones de canales, categorías y roles', () => {
  const message = {
    channelId: 'channel',
    channel: { parentId: 'category' },
    member: { roles: { cache: { some: predicate => ['member-role'].some(id => predicate({ id })) } } }
  };
  assert.equal(isExempt(message, { moderation: { exemptChannels: ['channel'] } }), true);
  assert.equal(isExempt(message, { moderation: { exemptChannels: ['category'] } }), true);
  assert.equal(isExempt(message, { moderation: { exemptRoles: ['member-role'] } }), true);
  assert.equal(isExempt(message, { moderation: { exemptChannels: [], exemptRoles: [] } }), false);
});

test('los casos nuevos y heredados tienen un identificador visible', () => {
  assert.equal(caseIdentifier({ caseId: 'ABC123' }), 'ABC123');
  assert.equal(caseIdentifier({ _id: '507f1f77bcf86cd799439011' }), '507F1F77BCF86CD799439011');
  const record = new ModerationCase({ guildId: 'g', userId: 'u', moderatorId: 'm', action: 'warning', reason: 'test' });
  assert.match(record.caseId, /^[A-F0-9]{10}$/);
  assert.equal(record.status, 'active');
});

test('detecta repeticiones dentro de la misma combinación servidor/usuario', () => {
  const message = { guild: { id: 'guild' }, author: { id: 'user' }, content: 'mensaje repetido' };
  assert.equal(repeatedMessage(message, 3), false);
  assert.equal(repeatedMessage(message, 3), false);
  assert.equal(repeatedMessage(message, 3), true);
  const other = { guild: { id: 'guild' }, author: { id: 'other' }, content: 'mensaje repetido' };
  assert.equal(repeatedMessage(other, 3), false);
});
