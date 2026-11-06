const test = require('node:test');
const assert = require('node:assert/strict');

const ModerationCase = require('../src/database/models/ModerationCase');
const CommunityTicket = require('../src/database/models/CommunityTicket');
const Suggestion = require('../src/database/models/Suggestion');
const StarboardEntry = require('../src/database/models/StarboardEntry');
const WebIdentityLink = require('../src/database/models/WebIdentityLink');
const { purgeExpired, RETENTION_DAYS } = require('../src/core/RetentionService');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2027, 0, 1);
const daysAgo = days => new Date(NOW - days * DAY);

// Evalúa los filtros que usa el servicio sobre filas en memoria.
function matches(row, filter) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') return condition.some(part => matches(row, part));
    const value = row[key];
    if (condition === null) return value === null || value === undefined;
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      if ('$lt' in condition) return value instanceof Date && value < condition.$lt;
      if ('$in' in condition) return condition.$in.includes(value);
    }
    return value === condition;
  });
}

function seed(t, Model, rows) {
  t.mock.method(Model, 'deleteMany', async filter => {
    const before = rows.length;
    for (let index = rows.length - 1; index >= 0; index--) if (matches(rows[index], filter)) rows.splice(index, 1);
    return { deletedCount: before - rows.length };
  });
  return rows;
}

test('cada dato se borra al cumplir su plazo, y no antes', async t => {
  const cases = seed(t, ModerationCase, [
    { id: 'cerrado-viejo', status: 'resolved', createdAt: daysAgo(500), updatedAt: daysAgo(400) },
    { id: 'cerrado-reciente', status: 'revoked', createdAt: daysAgo(200), updatedAt: daysAgo(100) },
    { id: 'activo-muy-viejo', status: 'active', createdAt: daysAgo(800), updatedAt: daysAgo(800) },
    { id: 'activo', status: 'active', createdAt: daysAgo(400), updatedAt: daysAgo(400) }
  ]);
  const tickets = seed(t, CommunityTicket, [
    { id: 'cerrado-viejo', status: 'closed', closedAt: daysAgo(200) },
    { id: 'cerrado-reciente', status: 'closed', closedAt: daysAgo(30) },
    { id: 'abierto-viejo', status: 'open', closedAt: null }
  ]);
  const suggestions = seed(t, Suggestion, [{ id: 'vieja', createdAt: daysAgo(400) }, { id: 'nueva', createdAt: daysAgo(10) }]);
  const starboard = seed(t, StarboardEntry, [{ id: 'viejo', createdAt: daysAgo(370) }, { id: 'nuevo', createdAt: daysAgo(5) }]);
  const links = seed(t, WebIdentityLink, [
    { id: 'sin-uso', lastUsedAt: daysAgo(400), updatedAt: daysAgo(400) },
    { id: 'usada', lastUsedAt: daysAgo(3), updatedAt: daysAgo(500) },
    { id: 'antigua-sin-fecha', lastUsedAt: null, updatedAt: daysAgo(400) }
  ]);

  const removed = await purgeExpired(NOW);
  assert.deepEqual(removed, { cases: 2, tickets: 1, suggestions: 1, starboard: 1, links: 2 });
  assert.deepEqual(cases.map(row => row.id), ['cerrado-reciente', 'activo']);
  assert.deepEqual(tickets.map(row => row.id), ['cerrado-reciente', 'abierto-viejo'], 'un ticket abierto nunca caduca');
  assert.deepEqual(suggestions.map(row => row.id), ['nueva']);
  assert.deepEqual(starboard.map(row => row.id), ['nuevo']);
  assert.deepEqual(links.map(row => row.id), ['usada']);
});

test('los plazos son los que dice la política de privacidad', () => {
  const fs = require('node:fs');
  const politica = fs.readFileSync(require('node:path').join(__dirname, '..', 'src', 'web', 'public', 'privacy.html'), 'utf8');
  assert.deepEqual(RETENTION_DAYS, { closedCases: 365, anyCase: 730, closedTickets: 180, suggestions: 365, starboard: 365, unusedLinks: 365 });
  for (const texto of ['un año desde que se cerraron', 'dos años desde que se abrieron', '180 días desde su cierre', 'un año sin iniciar sesión']) {
    assert.ok(politica.includes(texto), `la política debe decir «${texto}»`);
  }
  assert.doesNotMatch(politica, /PENDIENTES? DE|domicilio|tel[eé]fono/i);
});
