// Llamadas y cuota usadas hoy por cada servicio (YouTube da 10 000 unidades
// al día). Se guardan en la base de datos para que un reinicio no ponga el
// contador a cero y el bot crea que le queda cuota que ya gastó.
const metrics = new Map();
const STATE_KEY = 'metrics:providers';
const SAVE_DELAY_MS = 15_000;
let saveTimer = null;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function recordRequest(provider, units = 1, details = {}) {
  const current = metrics.get(provider);
  const state = current?.day === today() ? current : { day: today(), calls: 0, units: 0, remaining: null, limit: null, resetAt: null, lastRequest: null };
  state.calls++;
  state.units += Number(units || 0);
  if (details.remaining !== undefined && details.remaining !== null) state.remaining = Number(details.remaining);
  if (details.limit !== undefined && details.limit !== null) state.limit = Number(details.limit);
  if (details.resetAt) state.resetAt = details.resetAt;
  state.lastRequest = new Date().toISOString();
  metrics.set(provider, state);
  scheduleSave();
  return { ...state };
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const MonitorState = require('../database/models/MonitorState');
    MonitorState.findOneAndUpdate({ key: STATE_KEY }, { $set: { value: Object.fromEntries(metrics) } }, { upsert: true })
      .catch(error => console.warn(`[Cuotas] No se pudo guardar el uso de hoy: ${error.message}`));
  }, SAVE_DELAY_MS);
  saveTimer.unref?.();
}

// Al arrancar, recupera lo usado hoy antes del reinicio.
async function restoreProviderMetrics() {
  const MonitorState = require('../database/models/MonitorState');
  const saved = (await MonitorState.findOne({ key: STATE_KEY }).lean())?.value || {};
  for (const [provider, state] of Object.entries(saved)) {
    if (state?.day !== today()) continue;
    const current = metrics.get(provider);
    metrics.set(provider, current?.day === today()
      ? { ...state, calls: state.calls + current.calls, units: state.units + current.units }
      : state);
  }
  return getAllProviderMetrics();
}

function getProviderMetrics(provider) {
  const state = metrics.get(provider);
  if (!state || state.day !== today()) return { day: today(), calls: 0, units: 0, remaining: null, limit: null, resetAt: null, lastRequest: null };
  return { ...state };
}

function getAllProviderMetrics() {
  return Object.fromEntries(['twitch', 'youtube', 'tiktok'].map(provider => [provider, getProviderMetrics(provider)]));
}

module.exports = { recordRequest, getProviderMetrics, getAllProviderMetrics, restoreProviderMetrics };
