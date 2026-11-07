const test = require('node:test');
const assert = require('node:assert/strict');
const MonitorState = require('../src/database/models/MonitorState');
const metrics = require('../src/core/ProviderMetrics');

test('el uso de cuota de hoy se recupera tras un reinicio y se suma a lo nuevo', async t => {
  const day = new Date().toISOString().slice(0, 10);
  t.mock.method(MonitorState, 'findOne', () => ({ lean: async () => ({ value: {
    youtube: { day, calls: 40, units: 4200, remaining: null, limit: null, resetAt: null, lastRequest: null },
    twitch: { day: '2000-01-01', calls: 99, units: 99 }
  } }) }));
  t.mock.method(MonitorState, 'findOneAndUpdate', async () => null);
  metrics.recordRequest('youtube', 100);
  const after = await metrics.restoreProviderMetrics();
  assert.equal(after.youtube.units, 4300, 'lo de antes del reinicio más lo de ahora');
  assert.equal(after.youtube.calls, 41);
  assert.equal(after.twitch.units, 0, 'lo de otro día no cuenta');
});
