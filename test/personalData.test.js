const test = require('node:test');
const assert = require('node:assert/strict');

const WebSession = require('../src/database/models/WebSession');
const WebIdentityLink = require('../src/database/models/WebIdentityLink');
const WebAuditLog = require('../src/database/models/WebAuditLog');
const Suggestion = require('../src/database/models/Suggestion');
const CommunityTicket = require('../src/database/models/CommunityTicket');
const StarboardEntry = require('../src/database/models/StarboardEntry');
const ModerationCase = require('../src/database/models/ModerationCase');
const TemporaryVoiceChannel = require('../src/database/models/TemporaryVoiceChannel');
const { inventory, erase, describe, validUserId } = require('../src/core/PersonalDataService');

const ANA = '111111111111111111';
const OTRA = '222222222222222222';

// Una base de datos de juguete: cada modelo guarda sus filas en memoria y
// entiende los filtros sencillos que usa el servicio.
function fakeCollections(t) {
  const get = (row, key) => key.split('.').reduce((value, part) => value?.[part], row);
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => get(row, key) === value);
  const tables = new Map();
  const seed = (Model, rows) => {
    tables.set(Model, rows);
    t.mock.method(Model, 'countDocuments', async filter => rows.filter(row => matches(row, filter)).length);
    t.mock.method(Model, 'deleteMany', async filter => {
      const before = rows.length;
      for (let index = rows.length - 1; index >= 0; index--) if (matches(rows[index], filter)) rows.splice(index, 1);
      return { deletedCount: before - rows.length };
    });
    t.mock.method(Model, 'updateMany', async (filter, { $set }) => {
      const hit = rows.filter(row => matches(row, filter));
      hit.forEach(row => Object.assign(row, $set));
      return { modifiedCount: hit.length };
    });
  };
  seed(WebSession, [{ discord: { id: ANA } }, { discord: { id: ANA } }, { discord: { id: OTRA } }]);
  seed(WebIdentityLink, [{ discord: { id: ANA } }]);
  seed(Suggestion, [{ userId: ANA, text: 'más canales' }, { userId: OTRA, text: 'otra' }]);
  seed(CommunityTicket, [{ userId: ANA, status: 'closed' }, { userId: ANA, status: 'open' }]);
  seed(StarboardEntry, [{ authorId: ANA }]);
  seed(ModerationCase, [{ userId: ANA, moderatorId: OTRA }, { userId: OTRA, moderatorId: ANA }]);
  seed(TemporaryVoiceChannel, [{ ownerId: ANA }]);
  seed(WebAuditLog, [{ actorDiscordId: ANA, actorGoogleEmail: 'ana@example.com', ipHash: 'x' }, { actorDiscordId: OTRA }]);
  return tables;
}

test('consultar muestra qué se puede borrar y qué se conserva', async t => {
  fakeCollections(t);
  const found = await inventory(`<@${ANA}>`);
  assert.equal(found.userId, ANA);
  assert.deepEqual(found.erasable, { sessions: 2, links: 1, suggestions: 1, ticketsClosed: 1, starboard: 1, audit: 1 });
  assert.deepEqual(found.kept, { casesAbout: 1, casesBy: 1, ticketsOpen: 1, rooms: 1 });
  assert.match(describe(found.kept, { reasons: true }), /casos de moderación sobre esta persona: \*\*1\*\* — son registros del servidor/);
});

test('borrar quita solo lo de esa persona y conserva lo que protege a otros', async t => {
  const tables = fakeCollections(t);
  const result = await erase(ANA);
  assert.deepEqual(result.removed, { sessions: 2, links: 1, suggestions: 1, ticketsClosed: 1, starboard: 1, audit: 1 });
  // Lo de otras personas sigue igual.
  assert.equal(tables.get(WebSession).length, 1);
  assert.equal(tables.get(Suggestion)[0].userId, OTRA);
  // Los casos de moderación y lo que sigue en uso no se tocan.
  assert.equal(tables.get(ModerationCase).length, 2);
  assert.equal(tables.get(CommunityTicket).length, 1);
  assert.deepEqual(result.kept, { casesAbout: 1, casesBy: 1, ticketsOpen: 1, rooms: 1 });
  // El historial del panel conserva el cambio, sin decir quién lo hizo.
  assert.deepEqual(tables.get(WebAuditLog)[0], { actorDiscordId: null, actorGoogleEmail: null, ipHash: null });
});

test('una cuenta mal escrita no borra nada', async () => {
  assert.throws(() => validUserId('ana'), /cuenta de Discord/);
  await assert.rejects(erase('123'), /cuenta de Discord/);
});
