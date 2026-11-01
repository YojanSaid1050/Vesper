// Lo que ve la persona cuando algo falla.
//
// Los errores que lanza Vesper ya vienen escritos para ella («Ese canal no es
// de texto», «Activa la música en el panel») y se enseñan tal cual. Los que
// vienen de Discord, de una red o de una librería traen códigos y jerga en
// inglés («Missing Permissions», «Request failed with status code 400»), y
// esos se cambian por una frase clara.

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

function friendlyError(error, fallback = 'Algo falló. Inténtalo de nuevo en un momento.') {
  const code = Number(error?.code ?? error?.rawError?.code);
  if (DISCORD_CODES[code]) return DISCORD_CODES[code];
  const text = String(error?.message ?? error ?? '').trim();
  if (/Missing Permissions/i.test(text)) return DISCORD_CODES[50013];
  if (/Missing Access/i.test(text)) return DISCORD_CODES[50001];
  if (!text || TECHNICAL.test(text) || !SPANISH.test(text)) return fallback;
  return text.length > 400 ? `${text.slice(0, 397)}…` : text;
}

module.exports = { friendlyError };
