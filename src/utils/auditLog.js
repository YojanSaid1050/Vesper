// src/utils/auditLog.js
//
// Quién hizo cada cosa. Discord no lo manda con el evento: hay que ir a
// buscarlo al registro de auditoría del servidor.
//
// Dos cosas hacían que casi siempre saliera «Desconocido»:
//
//   1. Discord manda el evento por la pasarela ANTES de que la entrada de
//      auditoría se pueda consultar. Con un solo intento se pierde casi
//      siempre, así que se reintenta un par de veces con una pausa corta.
//   2. Se comparaba `entry.target.id`, y cuando lo borrado es un rol o un
//      canal, Discord ya no puede resolver ese objeto y `target` llega vacío.
//      `entry.targetId` viene igual en crudo y sí sirve.
//
// Y si el bot no tiene permiso para ver la auditoría, se dice en el propio
// aviso en vez de dejar un «Desconocido» que no explica nada.

const { PermissionFlagsBits } = require('discord.js');

const INTENTOS_MS = [0, 800, 2000];

const SIN_PERMISO = 'Vesper no puede ver la auditoría';
const SIN_DATO = 'No quedó registrado';

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));

function puedeVerAuditoria(guild) {
  const yo = guild?.members?.me;
  if (!yo) return true; // sin caché no se puede saber: se intenta igual
  return yo.permissions.has(PermissionFlagsBits.ViewAuditLog);
}

function coincide(entry, targetId, options, ahora, maxAgeMs) {
  const idEntrada = entry.targetId ?? entry.target?.id ?? null;
  const mismoObjetivo = !targetId || String(idEntrada || '') === String(targetId);
  const reciente = Number.isFinite(entry.createdTimestamp) && Math.abs(ahora - entry.createdTimestamp) <= maxAgeMs;
  const extra = typeof options.extraMatches !== 'function' || options.extraMatches(entry.extra);
  return mismoObjetivo && reciente && extra;
}

async function findRecentAuditEntry(guild, type, targetId, options = {}) {
  const maxAgeMs = Number(options.maxAgeMs || 15_000);
  const limit = Number(options.limit || 6);
  if (!puedeVerAuditoria(guild)) return null;

  for (const pausa of INTENTOS_MS) {
    if (pausa) await esperar(pausa);
    let logs;
    try {
      logs = await guild.fetchAuditLogs({ limit, type });
    } catch {
      return null; // sin permiso o Discord caído: no tiene sentido insistir
    }
    const ahora = Date.now();
    const encontrada = logs.entries.find(entry => coincide(entry, targetId, options, ahora, maxAgeMs));
    if (encontrada) return encontrada;
  }
  return null;
}

function auditExecutor(entry) {
  return entry?.executor?.tag || entry?.executor?.username || SIN_DATO;
}

/**
 * Lo que va en «Borrado por», «Baneado por» y demás. Devuelve siempre algo
 * que se puede leer: el nombre de quien lo hizo, o por qué no se sabe.
 */
async function quienLoHizo(guild, type, targetId, options = {}) {
  if (!puedeVerAuditoria(guild)) return SIN_PERMISO;
  try {
    return auditExecutor(await findRecentAuditEntry(guild, type, targetId, options));
  } catch {
    return SIN_DATO;
  }
}

module.exports = { findRecentAuditEntry, auditExecutor, quienLoHizo, SIN_PERMISO, SIN_DATO };
