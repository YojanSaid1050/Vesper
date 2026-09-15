// src/web/health.js
//
// Estado de salud del proceso, aparte de index.js para poder probarlo sin
// arrancar el bot entero.
//
// La distinción importante:
//   - `healthy` → ¿el proceso debe seguir vivo? Es lo que consulta el
//     alojamiento. Un monitor en pausa o una reconexión de MongoDB son
//     situaciones transitorias que Vesper resuelve solo; si contaran aquí,
//     Render reiniciaría el contenedor en bucle por un fallo pasajero de
//     TikTok o de Atlas.
//   - `ready` → ¿está todo operativo? Es la señal estricta, para diagnóstico,
//     para el panel y para validar un despliegue.

const path = require('node:path');

function buildRuntimeHealth({ getClient, getMongoStatus, getMonitorStats, isShuttingDown }) {
  return function runtimeHealth() {
    const client = getClient();
    const botReady = client?.isReady?.() || false;
    const database = getMongoStatus();
    const monitors = getMonitorStats();
    const music = client?.music?.status?.() || { configured: false, connected: false, available: false, players: 0 };
    const monitorsHealthy = monitors.every(item => !item.disabledUntil);
    const musicRequired = String(process.env.MUSIC_REQUIRED || 'false').toLowerCase() === 'true';
    const musicHealthy = !musicRequired || music.available !== false;
    const stopping = isShuttingDown();

    const healthy = botReady && !stopping;
    const ready = healthy && database.connected && monitorsHealthy && musicHealthy;

    return {
      healthy, ready, botReady, database, monitors, music,
      monitorsHealthy, musicRequired, musicHealthy, shuttingDown: stopping
    };
  };
}

function mountHealthRoutes(app, { runtimeHealth, getClient, isShuttingDown }) {
  // La raíz la abre una persona en el navegador, no una sonda. Antes redirigía
  // al panel, que pide iniciar sesión: quien llega por primera vez se topaba
  // con un formulario sin saber siquiera qué hace el bot. Ahora ve la portada,
  // con un botón bien visible al panel. Los monitores de uptime que apunten a
  // "/" y pidan JSON siguen recibiendo el estado de siempre.
  app.get('/', (req, res) => {
    const wantsJson = req.accepts(['html', 'json']) === 'json';
    if (!wantsJson) return res.sendFile(path.join(__dirname, 'public', 'landing.html'));
    return res.json({
      status: 'online',
      timestamp: new Date().toISOString(),
      bot: getClient()?.isReady?.() || false,
      uptime: getClient()?.uptime || 0
    });
  });

  app.get('/live', (req, res) => {
    const alive = !isShuttingDown();
    return res.status(alive ? 200 : 503).json({ status: alive ? 'alive' : 'stopping', uptime: getClient()?.uptime || 0 });
  });

  app.get(['/health', '/ready'], (req, res) => {
    const state = runtimeHealth();
    const strict = req.path === '/ready';
    const ok = strict ? state.ready : state.healthy;

    return res.status(ok ? 200 : 503).json({
      status: ok ? (strict ? 'ready' : 'healthy') : 'degraded',
      bot: state.botReady,
      ready: state.ready,
      database: state.database,
      shuttingDown: state.shuttingDown,
      uptime: getClient()?.uptime || 0,
      monitors: state.monitors,
      monitorsHealthy: state.monitorsHealthy,
      music: state.music,
      musicRequired: state.musicRequired,
      musicHealthy: state.musicHealthy
    });
  });
}

module.exports = { buildRuntimeHealth, mountHealthRoutes };
