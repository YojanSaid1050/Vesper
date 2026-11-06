// src/core/RetentionService.js
//
// Cuánto tiempo guarda Vesper cada dato y quién lo borra cuando se cumple.
// Lo que ya caduca solo (sesiones del panel, historial del panel, avisos de
// redes) tiene su propio índice de expiración; aquí va lo que necesita una
// regla con condiciones, y se revisa una vez al día.
//
//   Casos de moderación resueltos o revocados   1 año desde que se cerraron
//   Casos de moderación, cualquiera             2 años desde que se abrieron
//   Tickets cerrados                            180 días desde el cierre
//   Sugerencias                                 1 año desde que se enviaron
//   Mensajes destacados                         1 año desde que se destacaron
//   Cuentas vinculadas del panel                1 año sin iniciar sesión
//
// Los tickets abiertos y las salas de voz activas no caducan: siguen en uso.

const ModerationCase = require('../database/models/ModerationCase');
const CommunityTicket = require('../database/models/CommunityTicket');
const Suggestion = require('../database/models/Suggestion');
const StarboardEntry = require('../database/models/StarboardEntry');
const WebIdentityLink = require('../database/models/WebIdentityLink');

const DAY = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = Object.freeze({
  closedCases: 365,
  anyCase: 730,
  closedTickets: 180,
  suggestions: 365,
  starboard: 365,
  unusedLinks: 365
});

function ago(days, now) {
  return new Date(now - days * DAY);
}

async function purgeExpired(now = Date.now()) {
  const [closedCases, oldCases, tickets, suggestions, starboard, links] = await Promise.all([
    ModerationCase.deleteMany({ status: { $in: ['resolved', 'revoked'] }, updatedAt: { $lt: ago(RETENTION_DAYS.closedCases, now) } }),
    ModerationCase.deleteMany({ createdAt: { $lt: ago(RETENTION_DAYS.anyCase, now) } }),
    CommunityTicket.deleteMany({ status: 'closed', closedAt: { $lt: ago(RETENTION_DAYS.closedTickets, now) } }),
    Suggestion.deleteMany({ createdAt: { $lt: ago(RETENTION_DAYS.suggestions, now) } }),
    StarboardEntry.deleteMany({ createdAt: { $lt: ago(RETENTION_DAYS.starboard, now) } }),
    // Una cuenta vinculada antes de existir `lastUsedAt` cuenta desde su
    // última modificación.
    WebIdentityLink.deleteMany({
      $or: [
        { lastUsedAt: { $lt: ago(RETENTION_DAYS.unusedLinks, now) } },
        { lastUsedAt: null, updatedAt: { $lt: ago(RETENTION_DAYS.unusedLinks, now) } }
      ]
    })
  ]);
  const removed = {
    cases: (closedCases.deletedCount || 0) + (oldCases.deletedCount || 0),
    tickets: tickets.deletedCount || 0,
    suggestions: suggestions.deletedCount || 0,
    starboard: starboard.deletedCount || 0,
    links: links.deletedCount || 0
  };
  const total = Object.values(removed).reduce((sum, value) => sum + value, 0);
  if (total) console.log(`[Datos] Borrados por antigüedad: ${JSON.stringify(removed)}`);
  return removed;
}

let timer = null;

// Primera revisión a los 10 minutos del arranque (para no sumar trabajo al
// inicio) y después una vez al día.
function startRetention() {
  if (timer) return;
  const run = () => purgeExpired().catch(error => console.warn(`[Datos] No se pudo revisar la antigüedad: ${error.message}`));
  timer = setTimeout(function tick() {
    run();
    timer = setTimeout(tick, DAY);
    timer.unref?.();
  }, 10 * 60 * 1000);
  timer.unref?.();
}

function stopRetention() {
  if (timer) clearTimeout(timer);
  timer = null;
}

module.exports = { RETENTION_DAYS, purgeExpired, startRetention, stopRetention };
