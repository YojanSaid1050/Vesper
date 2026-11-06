// src/core/PersonalDataService.js
//
// Atiende las solicitudes de «consultar o eliminar mis datos» que llegan por
// correo (ver /eliminacion-datos). Primero se mira qué hay de esa persona y,
// solo si el propietario del bot lo confirma, se borra.
//
// Qué se borra y qué no:
//   · Se borra lo que es solo de esa persona: sus sesiones del panel, sus
//     cuentas vinculadas, el texto de sus sugerencias, sus tickets cerrados y
//     sus entradas del tablón de destacados.
//   · En el historial de cambios del panel se quita su identidad (el cambio
//     sigue constando, sin decir quién lo hizo).
//   · No se tocan los casos de moderación: son registros del servidor que la
//     sancionó y protegen a otros miembros. Se informan para explicarlo en la
//     respuesta.
//   · Tampoco se tocan sus tickets abiertos ni su sala de voz activa: siguen
//     en uso. Se informan para cerrarlos antes.
//   · Lo que esté publicado en Discord (mensajes, transcripciones) se gestiona
//     en Discord; el bot no lo borra desde aquí.

const WebSession = require('../database/models/WebSession');
const WebIdentityLink = require('../database/models/WebIdentityLink');
const WebAuditLog = require('../database/models/WebAuditLog');
const Suggestion = require('../database/models/Suggestion');
const CommunityTicket = require('../database/models/CommunityTicket');
const StarboardEntry = require('../database/models/StarboardEntry');
const ModerationCase = require('../database/models/ModerationCase');
const TemporaryVoiceChannel = require('../database/models/TemporaryVoiceChannel');

const DISCORD_ID = /^\d{17,20}$/;

function validUserId(value) {
  const id = String(value || '').trim().replace(/^<@!?(\d+)>$/, '$1');
  if (!DISCORD_ID.test(id)) {
    const error = new Error('Escribe la cuenta de Discord (mención o número de cuenta).');
    error.statusCode = 400;
    throw error;
  }
  return id;
}

// Cuántos registros hay de esa persona en cada sitio.
async function inventory(userId) {
  const id = validUserId(userId);
  const [sessions, links, suggestions, ticketsClosed, ticketsOpen, starboard, casesAbout, casesBy, rooms, audit] = await Promise.all([
    WebSession.countDocuments({ 'discord.id': id }),
    WebIdentityLink.countDocuments({ 'discord.id': id }),
    Suggestion.countDocuments({ userId: id }),
    CommunityTicket.countDocuments({ userId: id, status: 'closed' }),
    CommunityTicket.countDocuments({ userId: id, status: 'open' }),
    StarboardEntry.countDocuments({ authorId: id }),
    ModerationCase.countDocuments({ userId: id }),
    ModerationCase.countDocuments({ moderatorId: id }),
    TemporaryVoiceChannel.countDocuments({ ownerId: id }),
    WebAuditLog.countDocuments({ actorDiscordId: id })
  ]);
  return {
    userId: id,
    erasable: { sessions, links, suggestions, ticketsClosed, starboard, audit },
    kept: { casesAbout, casesBy, ticketsOpen, rooms }
  };
}

// Borra lo que es solo de esa persona. Devuelve lo que se hizo y lo que quedó.
async function erase(userId) {
  const id = validUserId(userId);
  const [sessions, links, suggestions, ticketsClosed, starboard, audit] = await Promise.all([
    WebSession.deleteMany({ 'discord.id': id }),
    WebIdentityLink.deleteMany({ 'discord.id': id }),
    Suggestion.deleteMany({ userId: id }),
    CommunityTicket.deleteMany({ userId: id, status: 'closed' }),
    StarboardEntry.deleteMany({ authorId: id }),
    WebAuditLog.updateMany({ actorDiscordId: id }, { $set: { actorDiscordId: null, actorGoogleEmail: null, ipHash: null } })
  ]);
  const after = await inventory(id);
  return {
    userId: id,
    removed: {
      sessions: sessions.deletedCount || 0,
      links: links.deletedCount || 0,
      suggestions: suggestions.deletedCount || 0,
      ticketsClosed: ticketsClosed.deletedCount || 0,
      starboard: starboard.deletedCount || 0,
      audit: audit.modifiedCount || 0
    },
    kept: after.kept
  };
}

const LABELS = Object.freeze({
  sessions: 'sesiones del panel',
  links: 'cuentas vinculadas (Discord y Google)',
  suggestions: 'sugerencias escritas',
  ticketsClosed: 'tickets cerrados',
  starboard: 'mensajes en el tablón de destacados',
  audit: 'cambios en el historial del panel (se quita quién los hizo)',
  casesAbout: 'casos de moderación sobre esta persona',
  casesBy: 'casos de moderación que abrió como moderador',
  ticketsOpen: 'tickets abiertos',
  rooms: 'salas de voz activas'
});

const KEPT_REASON = Object.freeze({
  casesAbout: 'son registros del servidor que la sancionó; se conservan para proteger a otros miembros',
  casesBy: 'son registros del servidor; el caso no es de quien lo abrió',
  ticketsOpen: 'siguen en uso: ciérralos primero y vuelve a borrar',
  rooms: 'siguen en uso: se borran solas cuando la sala se queda vacía'
});

function describe(counts, { reasons = false } = {}) {
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `• ${LABELS[key] || key}: **${value}**${reasons && KEPT_REASON[key] ? ` — ${KEPT_REASON[key]}` : ''}`)
    .join('\n');
}

module.exports = { inventory, erase, describe, validUserId, LABELS };
