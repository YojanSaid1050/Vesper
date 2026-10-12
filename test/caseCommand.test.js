const test = require('node:test');
const assert = require('node:assert/strict');
const { ownCaseEmbed, caseEmbed } = require('../src/commands/moderation/case');

const record = {
  caseId: 'K7P2QX', userId: '700000000000000002', moderatorId: '649059737635258389',
  action: 'warning', reason: 'Spam en #general', evidence: 'captura interna', status: 'active', active: true,
  notes: [{ moderatorId: '649059737635258389', text: 'nota interna secreta', createdAt: new Date() }],
  createdAt: new Date(), updatedAt: new Date()
};

test('el miembro ve su caso sin notas internas, evidencia ni moderador', () => {
  const json = JSON.stringify(ownCaseEmbed(record).toJSON());
  assert.match(json, /Spam en #general/);
  assert.doesNotMatch(json, /nota interna secreta/);
  assert.doesNotMatch(json, /captura interna/);
  assert.doesNotMatch(json, /649059737635258389/);
});

test('el moderador sigue viendo el caso completo', () => {
  const json = JSON.stringify(caseEmbed(record).toJSON());
  assert.match(json, /nota interna secreta/);
  assert.match(json, /captura interna/);
});

test('/caso ya no exige moderación para todo: ver es para cada miembro', () => {
  const command = require('../src/commands/moderation/case');
  assert.equal(command.capability, undefined);
});
