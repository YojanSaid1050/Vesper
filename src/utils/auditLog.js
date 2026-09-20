// src/utils/auditLog.js
//
// Discord emite algunos eventos antes de que su entrada de auditoría esté
// disponible. Además, una entrada puede llegar parcialmente resuelta: con
// `targetId`/`executorId`, pero sin los objetos `target`/`executor`.

const { PermissionFlagsBits } = require('discord.js');

// Son tiempos absolutos desde que comenzó la búsqueda, no pausas acumuladas.
// Ocho segundos cubren la propagación habitual de Discord sin retrasar en
// exceso el aviso. Los tests pueden inyectar una lista más corta.
const INTENTOS_MS = [0, 750, 2_000, 4_500, 8_000];
const DISCORD_EPOCH = 1_420_070_400_000;

const SIN_PERMISO = 'El bot no puede ver la auditoría';
const SIN_DATO = 'Discord no indicó quién realizó la acción';
const ERROR_AUDITORIA = 'No se pudo consultar la auditoría de Discord';

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));

function puedeVerAuditoria(guild) {
  const yo = guild?.members?.me;
  if (!yo) return true; // sin caché no se puede saber: se intenta igual
  return yo.permissions.has(PermissionFlagsBits.ViewAuditLog);
}

function snowflakeTimestamp(id) {
  try {
    if (!/^\d{17,20}$/.test(String(id || ''))) return null;
    return Number(BigInt(id) >> 22n) + DISCORD_EPOCH;
  } catch {
    return null;
  }
}

function entryTimestamp(entry) {
  if (Number.isFinite(entry?.createdTimestamp)) return entry.createdTimestamp;
  const createdAt = entry?.createdAt instanceof Date ? entry.createdAt.getTime() : Date.parse(entry?.createdAt);
  if (Number.isFinite(createdAt)) return createdAt;
  return snowflakeTimestamp(entry?.id);
}

function entryTargetId(entry) {
  return entry?.targetId ?? entry?.target?.id ?? entry?.target?.value ?? null;
}

function entriesOf(logs) {
  const entries = logs?.entries;
  if (!entries) return [];
  if (Array.isArray(entries)) return entries;
  if (typeof entries.values === 'function') return [...entries.values()];
  if (typeof entries.find === 'function') {
    // Collection#find es suficiente para la ruta normal. Este adaptador
    // conserva compatibilidad con dobles sencillos usados en pruebas.
    return { find: predicate => entries.find(predicate) };
  }
  return [];
}

function findEntry(logs, predicate) {
  const entries = entriesOf(logs);
  return typeof entries.find === 'function' ? entries.find(predicate) : undefined;
}

function coincide(entry, targetId, options, ahora, maxAgeMs) {
  const idEntrada = entryTargetId(entry);
  const mismoObjetivo = !targetId || String(idEntrada || '') === String(targetId);
  const timestamp = entryTimestamp(entry);
  const reciente = Number.isFinite(timestamp) && Math.abs(ahora - timestamp) <= maxAgeMs;
  const extra = typeof options.extraMatches !== 'function' || options.extraMatches(entry.extra);
  return mismoObjetivo && reciente && extra;
}

async function buscarEntrada(guild, type, targetId, options = {}) {
  const maxAgeMs = Number(options.maxAgeMs || 60_000);
  const limit = Number(options.limit || 25);
  const intentos = Array.isArray(options.attemptDelaysMs) && options.attemptDelaysMs.length
    ? options.attemptDelaysMs
    : INTENTOS_MS;
  let ultimaPausa = 0;
  let ultimoError = null;
  let huboRespuesta = false;

  if (!puedeVerAuditoria(guild)) return { entry: null, error: null };

  for (const pausaObjetivo of intentos) {
    const pausaActual = Math.max(0, Number(pausaObjetivo) || 0);
    const pausa = Math.max(0, pausaActual - ultimaPausa);
    if (pausa) await esperar(pausa);
    ultimaPausa = pausaActual;

    try {
      const logs = await guild.fetchAuditLogs({ limit, type });
      huboRespuesta = true;
      const encontrada = findEntry(logs, entry => coincide(entry, targetId, options, Date.now(), maxAgeMs));
      if (encontrada) return { entry: encontrada, error: null };
    } catch (error) {
      // Un 5xx, timeout o rate limit puntual no debe convertir el actor en
      // «no registrado». Se conserva el error y se prueban los demás turnos.
      ultimoError = error;
    }
  }

  return { entry: null, error: huboRespuesta ? null : ultimoError };
}

async function findRecentAuditEntry(guild, type, targetId, options = {}) {
  return (await buscarEntrada(guild, type, targetId, options)).entry;
}

function auditExecutor(entry) {
  return entry?.executor?.globalName
    || entry?.executor?.tag
    || entry?.executor?.username
    || (entry?.executorId ? `Usuario ${entry.executorId}` : SIN_DATO);
}

async function resolveAuditExecutor(guild, entry) {
  const directo = entry?.executor?.globalName || entry?.executor?.tag || entry?.executor?.username;
  if (directo) return directo;

  const executorId = entry?.executorId ?? entry?.executor?.id;
  if (!executorId) return SIN_DATO;

  const miembroCache = guild?.members?.cache?.get?.(executorId);
  if (miembroCache) {
    return miembroCache.displayName || miembroCache.user?.globalName || miembroCache.user?.tag
      || miembroCache.user?.username || `Usuario ${executorId}`;
  }

  try {
    const miembro = await guild?.members?.fetch?.(executorId);
    if (miembro) {
      return miembro.displayName || miembro.user?.globalName || miembro.user?.tag
        || miembro.user?.username || `Usuario ${executorId}`;
    }
  } catch {
    // Puede ser un usuario que ya salió del servidor; se prueba la caché/API
    // global de usuarios antes de recurrir al ID.
  }

  const usuarioCache = guild?.client?.users?.cache?.get?.(executorId);
  if (usuarioCache) return usuarioCache.globalName || usuarioCache.tag || usuarioCache.username || `Usuario ${executorId}`;

  try {
    const usuario = await guild?.client?.users?.fetch?.(executorId);
    if (usuario) return usuario.globalName || usuario.tag || usuario.username || `Usuario ${executorId}`;
  } catch {
    // El ID sigue siendo más útil y verificable que «desconocido».
  }

  return `Usuario ${executorId}`;
}

/**
 * Lo que va en «Borrado por», «Baneado por» y demás. Devuelve siempre algo
 * legible y distingue ausencia de datos, permisos y fallos de Discord.
 */
async function quienLoHizo(guild, type, targetId, options = {}) {
  if (!puedeVerAuditoria(guild)) return SIN_PERMISO;
  try {
    const resultado = await buscarEntrada(guild, type, targetId, options);
    if (resultado.entry) return resolveAuditExecutor(guild, resultado.entry);
    return resultado.error ? ERROR_AUDITORIA : SIN_DATO;
  } catch {
    return ERROR_AUDITORIA;
  }
}

module.exports = {
  findRecentAuditEntry,
  auditExecutor,
  resolveAuditExecutor,
  quienLoHizo,
  SIN_PERMISO,
  SIN_DATO,
  ERROR_AUDITORIA
};
