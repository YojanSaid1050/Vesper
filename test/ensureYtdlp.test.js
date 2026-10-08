const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { extractZip } = require('../scripts/ensure-ytdlp');

// Construye un .zip mínimo (guardado o con deflate) para probar el extractor.
function buildZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, content, deflate = false, mode = 0o644 } of files) {
    const data = deflate ? zlib.deflateRawSync(content) : content;
    const nameBuffer = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(((0o100000 | mode) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuffer, data);
    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}

test('el extractor de yt-dlp descomprime archivos guardados y con deflate', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vesper-zip-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const big = Buffer.from('x'.repeat(5000));
  extractZip(buildZip([
    { name: 'yt-dlp_linux', content: Buffer.from('#!/bin/sh\n'), mode: 0o755 },
    { name: '_internal/lib.js', content: big, deflate: true }
  ]), dir);
  assert.equal(fs.readFileSync(path.join(dir, 'yt-dlp_linux'), 'utf8'), '#!/bin/sh\n');
  assert.deepEqual(fs.readFileSync(path.join(dir, '_internal', 'lib.js')), big);
  assert.ok(fs.statSync(path.join(dir, 'yt-dlp_linux')).mode & 0o100);
});

test('el extractor rechaza rutas que salen de la carpeta', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vesper-zip-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  assert.throws(() => extractZip(buildZip([{ name: '../fuera.txt', content: Buffer.from('no') }]), dir), /no permitida/);
  assert.equal(fs.existsSync(path.join(dir, '..', 'fuera.txt')), false);
});
