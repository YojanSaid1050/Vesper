// src/core/KeepAlive.js
//
// El plan gratis de Render apaga el servicio tras 15 minutos sin visitas a la
// web. La conexión con Discord no cuenta como visita, así que el bot se
// quedaba dormido aunque estuviera en servidores con gente, y al despertar
// había perdido la música y todo lo que tenía en memoria.
//
// Para evitarlo, el propio bot visita su página de estado cada 10 minutos por
// su dirección pública (la visita entra por la puerta de Render y cuenta).
// Solo se activa en Render, o donde se indique con KEEP_ALIVE_URL; en un
// servidor propio (Oracle, Google Cloud…) no hace falta y no se activa.

const INTERVAL_MS = Math.max(60_000, Number(process.env.KEEP_ALIVE_INTERVAL_MS || 10 * 60_000));

function keepAliveUrl(env = process.env) {
  if (String(env.KEEP_ALIVE || '').toLowerCase() === 'false') return null;
  const base = env.KEEP_ALIVE_URL || (env.RENDER || env.RENDER_EXTERNAL_URL ? (env.RENDER_EXTERNAL_URL || env.WEB_BASE_URL) : null);
  if (!base || !/^https:\/\//i.test(base)) return null;
  return `${base.replace(/\/+$/, '')}/health`;
}

let timer = null;

function startKeepAlive({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  const url = keepAliveUrl(env);
  if (!url || timer) return null;
  const ping = () => fetchImpl(url, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'Vesper keep-alive' } })
    .then(response => { if (!response.ok) console.warn(`[Activo] ${url} respondió ${response.status}`); })
    .catch(error => console.warn(`[Activo] No se pudo visitar ${url}: ${error.message}`));
  timer = setInterval(ping, INTERVAL_MS);
  timer.unref?.();
  console.log(`⏰ El bot se mantendrá despierto visitando ${url} cada ${Math.round(INTERVAL_MS / 60_000)} min`);
  return url;
}

function stopKeepAlive() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { keepAliveUrl, startKeepAlive, stopKeepAlive, INTERVAL_MS };
