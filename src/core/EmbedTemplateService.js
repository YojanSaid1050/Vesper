// src/core/EmbedTemplateService.js
//
// Fuente única de verdad para los textos, colores e imágenes de los embeds de
// bienvenida y despedida. La estructura visual de cada embed NO vive aquí: la
// definen los archivos protegidos (memberAdd/memberRemove para Embers Void) y
// PersonalityService para los Main temáticos. Este módulo solo decide qué
// valor usar en cada hueco: primero lo que el administrador guardó desde el
// panel, y si no hay nada, exactamente el valor que el bot usaba antes.

const EMBED_KINDS = Object.freeze(['welcome', 'goodbye']);

// Las dos formas en que Discord puede pintar un mensaje del bot:
//   - 'classic'        el embed de toda la vida (barra de color + campos).
//   - 'components_v2'  el contenedor de Components V2 que usa Embers Void.
// 'auto' significa "la que trae de fábrica este mensaje en este servidor".
const LAYOUTS = Object.freeze(['auto', 'classic', 'components_v2']);

function normalizeLayout(value, fallback = 'classic') {
  const raw = String(value ?? '').trim();
  if (raw === 'classic' || raw === 'components_v2') return raw;
  return fallback === 'components_v2' ? 'components_v2' : 'classic';
}

const EMBED_FIELD_LIMITS = Object.freeze({
  title: 240,
  message: 3000,
  footer: 200,
  image: 500
});

function defaultEmbedTemplate() {
  return { title: null, message: null, color: null, image: null, footer: null, thumbnail: true };
}

// Nace vacío a propósito: un tipo de mensaje sin entrada usa su diseño
// original. Guardar plantillas vacías para los 30 tipos solo ocuparía espacio.
function defaultEmbedsConfig() {
  return {};
}

// Discord solo convierte <@123…> en una mención azul dentro de la DESCRIPCIÓN
// de un embed. En el título, en el pie y en el nombre del autor lo deja tal
// cual, y el lector ve un número en bruto — era exactamente lo que pasaba en
// la despedida de Ankerie Dimension. Así que en esos huecos {user} se
// sustituye por el nombre de la persona en vez de por la mención.
const MENTION_SAFE_FIELDS = new Set(['description', 'message', 'content']);

function rendersMentions(field, layout) {
  // En el contenedor Components V2 todo es texto de mensaje, y ahí las
  // menciones sí funcionan en cualquier hueco.
  if (layout === 'components_v2') return true;
  return MENTION_SAFE_FIELDS.has(String(field || 'description'));
}

// Sustituye las variables que el administrador puede escribir en el panel.
// Devuelve null si no hay plantilla, para que quien llama aplique su propio
// valor por defecto sin confundirlo con una cadena vacía.
function applyVariables(template, member, options = {}) {
  if (template === null || template === undefined) return null;
  const text = String(template);
  if (!text.trim()) return null;
  const guild = member?.guild;
  const name = member?.displayName ?? member?.user?.username ?? '';
  const mentions = options.mentions !== false;
  return text
    .replaceAll('{user}', mentions ? (member ? member.toString() : '') : (name ? `@${name}` : ''))
    .replaceAll('{username}', member?.user?.username ?? '')
    .replaceAll('{userTag}', member?.user?.tag ?? member?.user?.username ?? '')
    .replaceAll('{displayName}', name)
    .replaceAll('{userId}', member?.id ?? '')
    .replaceAll('{server}', guild?.name ?? '')
    .replaceAll('{memberCount}', guild?.memberCount === undefined ? '' : String(guild.memberCount));
}

function colorNumber(value, fallback) {
  const normalized = String(value ?? '').trim().replace(/^#/, '');
  return /^[0-9A-Fa-f]{6}$/.test(normalized) ? Number.parseInt(normalized, 16) : fallback;
}

function imageUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

// `kind` es 'welcome' o 'goodbye'. `fallbacks` son los valores que el bot
// usaba antes de que esto fuese configurable.
function resolveEmbedTemplate(config, kind, member, fallbacks = {}) {
  const stored = (config?.embeds?.[kind]) || {};
  const layout = normalizeLayout(stored.layout, fallbacks.layout);
  const plain = { mentions: false };
  return {
    title: applyVariables(stored.title, member, rendersMentions('title', layout) ? {} : plain) ?? fallbacks.title ?? null,
    message: applyVariables(stored.message, member) ?? fallbacks.message ?? null,
    footer: applyVariables(stored.footer, member, rendersMentions('footer', layout) ? {} : plain) ?? fallbacks.footer ?? null,
    color: colorNumber(stored.color, fallbacks.color),
    image: imageUrl(stored.image) ?? fallbacks.image ?? null,
    thumbnail: stored.thumbnail === undefined || stored.thumbnail === null
      ? (fallbacks.thumbnail !== false)
      : stored.thumbnail !== false,
    layout
  };
}

module.exports = {
  EMBED_KINDS,
  LAYOUTS,
  MENTION_SAFE_FIELDS,
  rendersMentions,
  normalizeLayout,
  EMBED_FIELD_LIMITS,
  defaultEmbedTemplate,
  defaultEmbedsConfig,
  applyVariables,
  colorNumber,
  imageUrl,
  resolveEmbedTemplate
};
