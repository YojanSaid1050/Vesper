const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { buildRuntimeHealth, mountHealthRoutes } = require('../src/web/health');

function scenario({ botReady = true, dbConnected = true, monitors = [], music, stopping = false, musicRequired = false } = {}) {
  const previous = process.env.MUSIC_REQUIRED;
  process.env.MUSIC_REQUIRED = musicRequired ? 'true' : 'false';

  const client = {
    isReady: () => botReady,
    uptime: 1000,
    music: { status: () => music || { configured: false, connected: false, players: 0 } }
  };
  const runtimeHealth = buildRuntimeHealth({
    getClient: () => (botReady || stopping ? client : null),
    getMongoStatus: () => ({ connected: dbConnected, readyState: dbConnected ? 1 : 0 }),
    getMonitorStats: () => monitors,
    isShuttingDown: () => stopping
  });

  const state = runtimeHealth();
  if (previous === undefined) delete process.env.MUSIC_REQUIRED;
  else process.env.MUSIC_REQUIRED = previous;
  return state;
}

test('un monitor en pausa NO marca el proceso como enfermo', () => {
  // Este es el fallo que reiniciaba el contenedor en bucle: bastaba con que
  // TikTok fallase tres veces seguidas para que el alojamiento matara el bot.
  const state = scenario({
    monitors: [
      { name: 'TikTok Lives', disabledUntil: new Date(Date.now() + 300000).toISOString() },
      { name: 'Twitch Streams', disabledUntil: null }
    ]
  });

  assert.equal(state.healthy, true, '/health debe seguir respondiendo 200');
  assert.equal(state.ready, false, '/ready sí debe avisar de que algo va mal');
  assert.equal(state.monitorsHealthy, false);
});

test('una reconexión de MongoDB tampoco tumba el servicio', () => {
  const state = scenario({ dbConnected: false });
  assert.equal(state.healthy, true);
  assert.equal(state.ready, false);
  assert.equal(state.database.connected, false);
});

test('con todo en orden, ambos estados son verdaderos', () => {
  const state = scenario({ monitors: [{ name: 'Twitch Streams', disabledUntil: null }] });
  assert.equal(state.healthy, true);
  assert.equal(state.ready, true);
});

test('el bot desconectado o el apagado sí marcan el proceso como enfermo', () => {
  assert.equal(scenario({ botReady: false }).healthy, false);
  const stopping = scenario({ stopping: true });
  assert.equal(stopping.healthy, false);
  assert.equal(stopping.shuttingDown, true);
});

test('la música solo afecta al estado si MUSIC_REQUIRED está activo', () => {
  const opcional = scenario({ music: { configured: true, connected: false, players: 0 } });
  assert.equal(opcional.ready, true, 'una avería musical no debe degradar el bot entero');

  const obligatoria = scenario({ musicRequired: true, music: { configured: true, connected: false, players: 0 } });
  assert.equal(obligatoria.healthy, true, 'ni siquiera así se debe reiniciar el contenedor');
  assert.equal(obligatoria.ready, false);
});

test('los endpoints devuelven los códigos correctos', async () => {
  const app = express();
  let stopping = false;
  let paused = false;

  const runtimeHealth = buildRuntimeHealth({
    getClient: () => ({ isReady: () => true, uptime: 42, music: { status: () => ({ configured: false, connected: false, players: 0 }) } }),
    getMongoStatus: () => ({ connected: true, readyState: 1 }),
    getMonitorStats: () => [{ name: 'TikTok Lives', disabledUntil: paused ? new Date().toISOString() : null }],
    isShuttingDown: () => stopping
  });
  mountHealthRoutes(app, { runtimeHealth, getClient: () => ({ isReady: () => true, uptime: 42 }), isShuttingDown: () => stopping });

  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;
  const get = async path => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return { status: response.status, body: await response.json() };
  };

  try {
    assert.equal((await get('/health')).status, 200);
    assert.equal((await get('/ready')).status, 200);
    assert.equal((await get('/live')).status, 200);

    paused = true;
    const conMonitorEnPausa = await get('/health');
    assert.equal(conMonitorEnPausa.status, 200, 'el alojamiento no debe reiniciar por esto');
    assert.equal(conMonitorEnPausa.body.ready, false, 'pero el payload sí lo reporta');
    assert.equal((await get('/ready')).status, 503);

    stopping = true;
    assert.equal((await get('/live')).status, 503);
    assert.equal((await get('/health')).status, 503);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
