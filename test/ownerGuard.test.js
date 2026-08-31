const test = require('node:test');
const assert = require('node:assert/strict');

const { getOwnerIds, isBotOwner } = require('../src/utils/interactionGuards');

test('acepta varios propietarios separados por coma y rechaza otros usuarios', () => {
  process.env.BOT_OWNER_IDS = '111, 222,333';
  assert.deepEqual([...getOwnerIds()], ['111', '222', '333']);
  assert.equal(isBotOwner('222'), true);
  assert.equal(isBotOwner('999'), false);
});
