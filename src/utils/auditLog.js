async function findRecentAuditEntry(guild, type, targetId, options = {}) {
  const maxAgeMs = Number(options.maxAgeMs || 15_000);
  const limit = Number(options.limit || 6);
  const logs = await guild.fetchAuditLogs({ limit, type });
  const now = Date.now();
  return logs.entries.find(entry => {
    const sameTarget = !targetId || String(entry.target?.id || '') === String(targetId);
    const recent = Number.isFinite(entry.createdTimestamp) && Math.abs(now - entry.createdTimestamp) <= maxAgeMs;
    const extraMatches = typeof options.extraMatches !== 'function' || options.extraMatches(entry.extra);
    return sameTarget && recent && extraMatches;
  }) || null;
}

function auditExecutor(entry) {
  return entry?.executor?.tag || entry?.executor?.username || 'Desconocido';
}

module.exports = { findRecentAuditEntry, auditExecutor };
