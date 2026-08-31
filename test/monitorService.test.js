const test = require('node:test');
const assert = require('node:assert/strict');

process.env.LOG_ERRORS = 'false';
const MonitorService = require('../src/core/MonitorService');

test('un error del monitor no genera una promesa rechazada sin manejar', async () => {
  const monitor = new MonitorService({
    name: 'Prueba',
    maxConsecutiveErrors: 1,
    errorCooldown: 1000,
    executeFunction: async () => {
      throw new Error('fallo controlado');
    }
  });

  const result = await monitor.run();
  assert.equal(result.success, false);
  assert.equal(result.error, 'fallo controlado');
  assert.equal(monitor.getStats().consecutiveErrors, 1);
  assert.ok(monitor.getStats().disabledUntil);
});

test('un monitor en cooldown no vuelve a llamar la API', async () => {
  let calls = 0;
  const monitor = new MonitorService({
    name: 'Cooldown',
    maxConsecutiveErrors: 1,
    errorCooldown: 5000,
    executeFunction: async () => {
      calls++;
      throw new Error('temporal');
    }
  });

  await monitor.run();
  const result = await monitor.run();
  assert.equal(result.reason, 'error_cooldown');
  assert.equal(calls, 1);
});

test('un resultado success false cuenta como fallo del monitor', async () => {
  const service = new MonitorService({
    name: 'Resultado fallido',
    maxConsecutiveErrors: 2,
    executeFunction: async () => ({ success: false, reason: 'provider_down' })
  });

  const result = await service.run();
  assert.equal(result.success, false);
  assert.equal(service.failedRuns, 1);
  assert.equal(service.successfulRuns, 0);
});
