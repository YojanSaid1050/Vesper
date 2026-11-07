const test = require('node:test');
const assert = require('node:assert/strict');
const { keepAliveUrl, startKeepAlive, stopKeepAlive } = require('../src/core/KeepAlive');

test('en Render se visita a sí mismo; en un servidor propio no', () => {
  assert.equal(keepAliveUrl({ RENDER: 'true', RENDER_EXTERNAL_URL: 'https://vesper-q5jv.onrender.com/' }), 'https://vesper-q5jv.onrender.com/health');
  assert.equal(keepAliveUrl({ RENDER: 'true', WEB_BASE_URL: 'https://vesper-q5jv.onrender.com' }), 'https://vesper-q5jv.onrender.com/health');
  assert.equal(keepAliveUrl({ WEB_BASE_URL: 'https://vesper.duckdns.org' }), null, 'fuera de Render no hace falta');
  assert.equal(keepAliveUrl({ KEEP_ALIVE_URL: 'https://otro.example.com' }), 'https://otro.example.com/health');
  assert.equal(keepAliveUrl({ RENDER: 'true', RENDER_EXTERNAL_URL: 'https://x.onrender.com', KEEP_ALIVE: 'false' }), null);
  assert.equal(keepAliveUrl({ RENDER: 'true', WEB_BASE_URL: 'http://localhost:3000' }), null, 'solo direcciones públicas');
});

test('la visita usa la página de estado y no se arranca dos veces', t => {
  const calls = [];
  t.mock.timers.enable({ apis: ['setInterval'] });
  const fetchImpl = async url => { calls.push(url); return { ok: true, status: 200 }; };
  const env = { RENDER: 'true', RENDER_EXTERNAL_URL: 'https://x.onrender.com' };
  assert.equal(startKeepAlive({ fetchImpl, env }), 'https://x.onrender.com/health');
  assert.equal(startKeepAlive({ fetchImpl, env }), null);
  t.mock.timers.tick(10 * 60_000);
  assert.deepEqual(calls, ['https://x.onrender.com/health']);
  stopKeepAlive();
});
