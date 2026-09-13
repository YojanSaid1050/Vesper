// src/core/EmbedLayouts.js
//
// Las dos formas en que Vesper puede publicar un mismo mensaje:
//
//   'classic'        el embed de siempre — barra de color a la izquierda,
//                    título, descripción, campos, miniatura, imagen y pie.
//   'components_v2'  el contenedor de Components V2 que estrenó Embers Void —
//                    un bloque con borde de color, títulos grandes hechos con
//                    Markdown y un separador entre las piezas.
//
// Ambas aceptan exactamente el mismo contenido, así que el administrador puede
// cambiar de una a otra en cualquier mensaje y en cualquier servidor sin
// perder nada de lo que escribió. Lo único que no viaja es la miniatura: el
// contenedor V2 no tiene ese hueco.

const CONTAINER = 17;   // contenedor con borde de color
const TEXT = 10;        // texto con Markdown
const SEPARATOR = 14;   // línea separadora
const MEDIA = 12;       // galería de imágenes
const IS_COMPONENTS_V2 = 32768;

/**
 * Contenedor Components V2 a partir de las piezas ya resueltas.
 */
function containerPayload({ title, message, fields = [], footer, image, color } = {}) {
  const parts = [];
  if (title) parts.push({ type: TEXT, content: title });
  if (title && (message || fields.length)) parts.push({ type: SEPARATOR, spacing: 1 });
  if (message) parts.push({ type: TEXT, content: message });
  for (const field of fields) {
    if (!field || !field.name || !field.value) continue;
    parts.push({ type: TEXT, content: `**${field.name}**\n${field.value}` });
  }
  if (image) parts.push({ type: MEDIA, items: [{ media: { url: image } }] });
  // El pie no existe como pieza propia en V2: su equivalente visual es el
  // texto pequeño de Markdown, que es exactamente para lo que Discord lo creó.
  if (footer) parts.push({ type: TEXT, content: `-# ${footer}` });
  if (!parts.length) parts.push({ type: TEXT, content: '​' });

  return {
    flags: IS_COMPONENTS_V2,
    components: [{
      type: CONTAINER,
      accent_color: color,
      spoiler: false,
      components: parts
    }]
  };
}

/**
 * Embed clásico a partir de las piezas ya resueltas.
 */
function classicPayload({ title, message, fields = [], footer, image, color, thumbnailUrl } = {}) {
  const embed = { color, timestamp: new Date().toISOString() };
  if (title) embed.title = title;
  if (message) embed.description = message;
  const usable = fields.filter(field => field && field.name && field.value);
  if (usable.length) embed.fields = usable;
  if (thumbnailUrl) embed.thumbnail = { url: thumbnailUrl };
  if (image) embed.image = { url: image };
  if (footer) embed.footer = { text: footer };
  return { embeds: [embed] };
}

// Atajos para bienvenida y despedida, que trabajan con el objeto que devuelve
// `resolveEmbedTemplate`.
function classicFromTemplate(template, member) {
  return classicPayload({
    title: template.title,
    message: template.message,
    footer: template.footer,
    image: template.image,
    color: template.color,
    thumbnailUrl: template.thumbnail ? member?.user?.displayAvatarURL?.() : null
  });
}

function containerFromTemplate(template) {
  return containerPayload({
    title: template.title,
    message: template.message,
    footer: template.footer,
    image: template.image,
    color: template.color
  });
}

module.exports = {
  containerPayload,
  classicPayload,
  classicFromTemplate,
  containerFromTemplate,
  IS_COMPONENTS_V2
};
