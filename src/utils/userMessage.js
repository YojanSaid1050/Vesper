// Lo que ve la persona cuando algo falla.
//
// Los errores que lanza Vesper ya vienen escritos para ella («Ese canal no es
// de texto», «Activa la música en el panel») y se enseñan tal cual. Los que
// vienen de Discord, de una red o de una librería traen códigos y jerga en
// inglés («Missing Permissions», «Request failed with status code 400»), y
// esos se cambian por una frase clara.
//
// Embers Void es el servidor de pruebas: allí, debajo de la frase clara, sale
// también el detalle técnico —el error original, su código y la causa— para
// ver qué falló y por qué sin tener que abrir los registros.

const { isTechnicalGuild } = require('../config/guildPolicy');

const DISCORD_CODES = Object.freeze({
  10003: 'Ese canal ya no existe.',
  10008: 'Ese mensaje ya no existe.',
  10011: 'Ese rol ya no existe.',
  10007: 'Esa persona ya no está en el servidor.',
  30007: 'Este canal ya tiene el máximo de integraciones que permite Discord.',
  50001: 'No tengo acceso a ese canal.',
  50013: 'No tengo permisos suficientes para hacer eso.',
  50034: 'Discord no deja borrar mensajes de más de 14 días.',
  50035: 'Discord no aceptó algún dato. Revisa lo que escribiste.'
});

const TECHNICAL = /\b(undefined|null|NaN|TypeError|ReferenceError|SyntaxError|ECONN\w*|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|E11000|status code|Request failed|Cannot read|is not a function|is not defined|Mongo\w*|JSON|stack|webhook|token|API|HTTP|fetch failed|socket|timeout|yt-dlp|ffmpeg|stderr|exit code)\b|https?:\/\/|\bat \S+ \(/i;
const SPANISH = /[áéíóúñ¿¡]|\b(el|la|los|las|no|que|una?|del|para|con|ese|esa|esta|está|puedo|tienes|hay|ya|tu|su)\b/i;

function plainMessage(error, fallback) {
  const code = Number(error?.code ?? error?.rawError?.code);
  if (DISCORD_CODES[code]) return DISCORD_CODES[code];
  const text = String(error?.message ?? error ?? '').trim();
  if (/Missing Permissions/i.test(text)) return DISCORD_CODES[50013];
  if (/Missing Access/i.test(text)) return DISCORD_CODES[50001];
  if (!text || TECHNICAL.test(text) || !SPANISH.test(text)) return fallback;
  return text.length > 400 ? `${text.slice(0, 397)}…` : text;
}

// De qué servidor viene el fallo: un id, una interacción, un mensaje o un
// servidor de discord.js.
function guildIdOf(context) {
  if (!context) return null;
  if (typeof context === 'string') return context;
  return context.guildId || context.guild?.id || (context.members && context.id) || null;
}

function firstErrorLine(text) {
  return String(text || '').split('\n').map(line => line.trim()).find(line => /ERROR|Error|error/.test(line)) || '';
}

// El error tal cual, con lo que sirve para encontrar la causa: tipo, código
// de Discord o del sistema, la línea de error de la herramienta y, si una
// búsqueda probó varias fuentes, qué contestó cada una.
function technicalDetail(error) {
  if (error === null || error === undefined) return 'sin detalle';
  if (typeof error !== 'object') return String(error).slice(0, 600);
  const parts = [];
  const name = error.name && error.name !== 'Error' ? `${error.name}: ` : '';
  parts.push(`${name}${error.message || String(error)}`);
  const code = error.code ?? error.rawError?.code;
  if (code !== undefined && code !== null) parts.push(`código ${code}`);
  if (error.status) parts.push(`estado ${error.status}`);
  const stderr = firstErrorLine(error.stderr || error.cause?.stderr);
  if (stderr && !parts[0].includes(stderr)) parts.push(stderr);
  if (error.cause && error.cause.message && !parts[0].includes(error.cause.message)) parts.push(`causa: ${error.cause.message}`);
  for (const { provider, error: cause } of error.causes || []) {
    parts.push(`${provider}: ${cause?.message || cause}${cause?.stderr ? ` (${firstErrorLine(cause.stderr)})` : ''}`);
  }
  const where = String(error.stack || '').split('\n').slice(1).map(line => line.trim()).find(line => line.includes('/src/'));
  if (where) parts.push(where.replace(/^at /, 'en ').replace(/\(.*\/src\//, '(src/'));
  return parts.join(' · ').slice(0, 900);
}

/**
 * Frase para la persona. `fallback` es lo que se dice cuando el error no
 * sirve tal cual; `context` (interacción, mensaje, servidor o su id) decide
 * si además se enseña el detalle técnico. Se puede pasar el contexto en el
 * lugar de `fallback`.
 */
function friendlyError(error, fallback = 'Algo falló. Inténtalo de nuevo en un momento.', context = null) {
  if (fallback !== null && typeof fallback === 'object') {
    context = fallback;
    fallback = 'Algo falló. Inténtalo de nuevo en un momento.';
  }
  const plain = plainMessage(error, fallback);
  if (!isTechnicalGuild(guildIdOf(context))) return plain;
  return `${plain}\n-# 🔧 ${technicalDetail(error)}`.trim();
}

module.exports = { friendlyError, technicalDetail, guildIdOf };
