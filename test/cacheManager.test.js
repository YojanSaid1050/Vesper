const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vesper-cache-'));
process.env.DATA_PATH = testDataPath;

const CacheManager = require('../src/core/CacheManager');

test.after(() => {
  fs.rmSync(testDataPath, { recursive: true, force: true });
});

test('normaliza rutas antiguas sin duplicar el directorio data', () => {
  const cache = new CacheManager('./data/twitch');
  assert.equal(cache.baseDir, path.join(testDataPath, 'twitch'));
  assert.equal(cache.baseDir.includes(`${path.sep}data${path.sep}data${path.sep}`), false);
});

test('comparte el estado entre instancias que usan el mismo archivo', () => {
  const first = new CacheManager('./data/twitch');
  const second = new CacheManager('twitch');
  const state = { guild: { streamer: true } };

  first.save('status', state);
  assert.deepEqual(second.load('status', {}), state);

  state.guild.streamer = false;
  second.save('status', state);
  assert.equal(first.load('status', {}).guild.streamer, false);
});
