// src/core/EmbedTemplateService.js
//
// Fuente única de verdad para los textos, colores e imágenes de los embeds de
// bienvenida y despedida. La estructura visual de cada embed NO vive aquí: la
// definen los archivos protegidos (memberAdd/memberRemove para Embers Void) y
// PersonalityService para los Main temáticos. Este módulo solo decide qué
// valor usar en cada hueco: primero lo que el administrador guardó desde el
// panel, y si no hay nada, exactamente el valor que el bot usaba antes.

const EMBED_KINDS = Object.freeze(['welcome', 'goodbye']);

const EMBED_FIELD_LIMITS = Object.freeze({
  title: 240,
  message: 3000,
  footer: 200,
  image: 500
});

function defaultEmbedTemplate() {
  return { title: null, message: null, color: null, image: null, footer: null, thumbnail: true };
}

function defaultEmbedsConfig() {
  return { welcome: defaultEmbedTemplate(), goodbye: defaultEmbedTemplate() };
}

// Sustituye las variables que el administrador puede escribir en el panel.
// Devuelve null si no hay plantilla, para que quien llama aplique su propio
// valor por defecto sin confundirlo con una cadena vacía.
function applyVariables(template, member) {
  if (template === null || template === undefined) return null;
  const text = String(template);
  if (!text.trim()) return null;
  const guild = member?.guild;
  return text
    .replaceAll('{user}', member ? member.toString() : '')
    .replaceAll('{username}', member?.user?.username ?? '')
    .replaceAll('{displayName}', member?.displayName ?? member?.user?.username ?? '')
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
  return {
    title: applyVariables(stored.title, member) ?? fallbacks.title ?? null,
    message: applyVariables(stored.message, member) ?? fallbacks.message ?? null,
    footer: applyVariables(stored.footer, member) ?? fallbacks.footer ?? null,
    color: colorNumber(stored.color, fallbacks.color),
    image: imageUrl(stored.image) ?? fallbacks.image ?? null,
    thumbnail: stored.thumbnail === undefined || stored.thumbnail === null
      ? (fallbacks.thumbnail !== false)
      : stored.thumbnail !== false
  };
}

module.exports = {
  EMBED_KINDS,
  EMBED_FIELD_LIMITS,
  defaultEmbedTemplate,
  defaultEmbedsConfig,
  applyVariables,
  colorNumber,
  imageUrl,
  resolveEmbedTemplate
};
