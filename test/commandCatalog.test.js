const test = require('node:test');
const assert = require('node:assert/strict');
const BotClient = require('../src/core/BotClient');

test('todos los comandos se cargan, serializan y tienen nombres únicos', async () => {
  const client = new BotClient();
  await client.loadCommands();
  assert.ok(client.commands.size >= 40);
  const names = new Set();
  for (const command of client.commands.values()) {
    const json = command.data.toJSON();
    assert.ok(json.name);
    assert.equal(names.has(json.name), false, `comando duplicado: ${json.name}`);
    names.add(json.name);
  }
  assert.equal(client.commands.get('vesper-control').scope, 'main');
  assert.equal(client.commands.get('musica').scope, undefined);
  client.destroy();
});
