// src/utils/discordLimits.js
//
// Discord rechaza el mensaje ENTERO con un error 50035 si cualquier pieza se
// pasa de largo: un título de más de 256 caracteres, un valor de campo de más
// de 1024, más de 25 campos… El comando falla y el usuario solo ve «error».
//
// Aquí están los límites reales y las funciones para respetarlos. Se recorta
// por palabras cuando se puede, para no cortar a mitad de una.

const LIMITS = Object.freeze({
  content: 2000,
  title: 256,
  description: 4096,
  fields: 25,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  authorName: 256,
  embedTotal: 6000,
  embeds: 10,
  choices: 25
});

const ELLIPSIS = '…';

function truncate(value, limit) {
  const text = String(value ?? '');
  if (text.length <= limit) return text;
  const hard = text.slice(0, limit - 1);
  // Si hay un espacio cerca del final, se corta ahí: queda mucho más legible
  // que partir una palabra por la mitad.
  const lastSpace = hard.lastIndexOf(' ');
  const cut = lastSpace > limit * 0.6 ? hard.slice(0, lastSpace) : hard;
  return cut.trimEnd() + ELLIPSIS;
}

// Une una lista y, si no cabe entera, dice cuántas quedaron fuera en vez de
// cortar la última a mitad.
function joinWithinLimit(items, { limit = LIMITS.fieldValue, separator = '\n', empty = 'Ninguno' } = {}) {
  const list = (items || []).map(item => String(item ?? '')).filter(Boolean);
  if (!list.length) return empty;

  const kept = [];
  let length = 0;
  for (const item of list) {
    const remaining = list.length - kept.length;
    const note = remaining > 1 ? `${separator}…y ${remaining} más` : '';
    const addition = (kept.length ? separator.length : 0) + item.length;
    if (length + addition + note.length > limit) break;
    kept.push(item);
    length += addition;
  }

  if (kept.length === list.length) return kept.join(separator);
  if (!kept.length) return truncate(list[0], limit);
  return `${kept.join(separator)}${separator}…y ${list.length - kept.length} más`;
}

function clampField(field) {
  return {
    ...field,
    name: truncate(field.name || '​', LIMITS.fieldName),
    value: truncate(field.value || '​', LIMITS.fieldValue)
  };
}

/**
 * Deja un embed dentro de todos los límites de Discord.
 * Acepta tanto objetos planos como EmbedBuilder (usa su `.data`).
 */
function clampEmbed(input) {
  const embed = { ...(input?.data || input || {}) };
  if (embed.title) embed.title = truncate(embed.title, LIMITS.title);
  if (embed.description) embed.description = truncate(embed.description, LIMITS.description);
  if (embed.footer?.text) embed.footer = { ...embed.footer, text: truncate(embed.footer.text, LIMITS.footer) };
  if (embed.author?.name) embed.author = { ...embed.author, name: truncate(embed.author.name, LIMITS.authorName) };
  if (Array.isArray(embed.fields)) {
    const fields = embed.fields
      .filter(field => field && (field.name || field.value))
      .slice(0, LIMITS.fields)
      .map(clampField);
    if (embed.fields.length > LIMITS.fields && fields.length === LIMITS.fields) {
      fields[LIMITS.fields - 1] = clampField({
        name: fields[LIMITS.fields - 1].name,
        value: `${fields[LIMITS.fields - 1].value}\n…y ${embed.fields.length - LIMITS.fields} apartados más`
      });
    }
    embed.fields = fields;
  }

  // El embed completo tampoco puede pasar de 6000 caracteres sumando todo.
  let total = totalLength(embed);
  while (total > LIMITS.embedTotal && embed.fields?.length) {
    embed.fields.pop();
    total = totalLength(embed);
  }
  if (total > LIMITS.embedTotal && embed.description) {
    embed.description = truncate(embed.description, Math.max(0, embed.description.length - (total - LIMITS.embedTotal) - 1));
  }
  return embed;
}

function totalLength(embed) {
  return [
    embed.title || '',
    embed.description || '',
    embed.footer?.text || '',
    embed.author?.name || '',
    ...(embed.fields || []).flatMap(field => [field.name || '', field.value || ''])
  ].reduce((sum, text) => sum + text.length, 0);
}

/**
 * Deja cualquier payload de mensaje dentro de los límites, sin cambiar nada
 * que ya quepa. Es la red de seguridad que se aplica antes de publicar.
 */
function clampPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const safe = { ...payload };
  if (typeof safe.content === 'string') safe.content = truncate(safe.content, LIMITS.content);
  if (Array.isArray(safe.embeds)) safe.embeds = safe.embeds.slice(0, LIMITS.embeds).map(clampEmbed);
  return safe;
}

module.exports = { LIMITS, truncate, joinWithinLimit, clampEmbed, clampField, clampPayload, totalLength };
