const metrics = new Map();

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
  return { ...state };
}

function getProviderMetrics(provider) {
  const state = metrics.get(provider);
  if (!state || state.day !== today()) return { day: today(), calls: 0, units: 0, remaining: null, limit: null, resetAt: null, lastRequest: null };
  return { ...state };
}

function getAllProviderMetrics() {
  return Object.fromEntries(['twitch', 'youtube', 'tiktok'].map(provider => [provider, getProviderMetrics(provider)]));
}

module.exports = { recordRequest, getProviderMetrics, getAllProviderMetrics };
