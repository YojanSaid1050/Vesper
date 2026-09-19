// «Borrado por: Desconocido» salía casi siempre. Aquí se reproduce por qué.

const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');

const { findRecentAuditEntry, auditExecutor, quienLoHizo, SIN_PERMISO, SIN_DATO } = require('../src/utils/auditLog');

function servidorFalso({ entradas = [], permiso = true, apareceTrasIntentos = 0 } = {}) {
  let intentos = 0;
  return {
    consultas: () => intentos,
    members: { me: { permissions: { has: flag => permiso || flag !== PermissionFlagsBits.ViewAuditLog } } },
    async fetchAuditLogs() {
      intentos += 1;
      const visibles = intentos > apareceTrasIntentos ? entradas : [];
      return { entries: { find: fn => visibles.find(fn) || undefined } };
    }
  };
}

const entrada = (targetId, tag = 'yojan') => ({
  targetId,
  target: null, // es lo que devuelve Discord con un rol o un canal ya borrado
  createdTimestamp: Date.now(),
  executor: { tag },
  extra: null
});

// La causa principal: Discord manda el evento por la pasarela antes de que la
// entrada se pueda consultar, así que el primer intento vuelve vacío.
test('reintenta cuando la auditoría todavía no tiene la entrada', async () => {
  const guild = servidorFalso({ entradas: [entrada('123')], apareceTrasIntentos: 1 });
  assert.equal(await quienLoHizo(guild, 0, '123'), 'yojan');
  assert.ok(guild.consultas() >= 2, 'debería haber preguntado más de una vez');
});

// La segunda causa: al borrar un rol o un canal, Discord ya no puede resolver
// el objeto y `entry.target` llega vacío. `targetId` sí viene.
test('reconoce la entrada aunque Discord no pueda resolver el objeto borrado', async () => {
  const guild = servidorFalso({ entradas: [entrada('987')] });
  assert.equal(await quienLoHizo(guild, 0, '987'), 'yojan');
});

test('no confunde la acción de otro objeto', async () => {
  const guild = servidorFalso({ entradas: [entrada('otro')] });
  assert.equal(await quienLoHizo(guild, 0, '123'), SIN_DATO);
});

// Una entrada vieja es de otra acción parecida, no de esta.
test('descarta las entradas antiguas', async () => {
  const vieja = { ...entrada('123'), createdTimestamp: Date.now() - 60_000 };
  const guild = servidorFalso({ entradas: [vieja] });
  assert.equal(await quienLoHizo(guild, 0, '123'), SIN_DATO);
});

// Sin permiso, «Desconocido» no explicaba nada y nadie sabía qué arreglar.
test('sin permiso lo dice en vez de dejar un desconocido', async () => {
  const guild = servidorFalso({ entradas: [entrada('123')], permiso: false });
  assert.equal(await quienLoHizo(guild, 0, '123'), SIN_PERMISO);
  assert.equal(guild.consultas(), 0, 'ni siquiera debería preguntar');
});

test('si Discord falla, no revienta el aviso', async () => {
  const guild = {
    members: { me: { permissions: { has: () => true } } },
    fetchAuditLogs: async () => { throw new Error('503'); }
  };
  assert.equal(await quienLoHizo(guild, 0, '123'), SIN_DATO);
});

test('sin entrada, auditExecutor devuelve algo legible', () => {
  assert.equal(auditExecutor(null), SIN_DATO);
  assert.equal(auditExecutor({ executor: { username: 'yojan' } }), 'yojan');
});

test('findRecentAuditEntry devuelve la entrada, no un texto', async () => {
  const guild = servidorFalso({ entradas: [entrada('123')] });
  const encontrada = await findRecentAuditEntry(guild, 0, '123');
  assert.equal(encontrada.executor.tag, 'yojan');
});
