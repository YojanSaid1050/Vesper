const test = require('node:test');
const assert = require('node:assert/strict');
const { readsMpegTs } = require('../scripts/ensure-ffmpeg');
const sources = require('../src/core/music/sources');

test('la comprobación de MPEG-TS responde sí o no sin lanzar', () => {
  assert.equal(readsMpegTs(null), false);
  assert.equal(readsMpegTs('/no/existe/ffmpeg'), false);
  assert.equal(typeof readsMpegTs(sources.ffmpegPath()), 'boolean');
});
