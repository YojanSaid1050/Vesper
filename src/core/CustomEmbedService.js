const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const { isPrivateHostname } = require('../utils/imageUrlValidator');

class CustomEmbedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CustomEmbedError';
    this.statusCode = 400;
  }
}

const LIMITS = Object.freeze({
  content: 2000,
  authorName: 256,
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  fields: 25,
  footer: 2048,
  buttons: 5,
  buttonLabel: 80,
  url: 500,
  embedTotal: 6000
});

function plainObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CustomEmbedError(`${path} no es válido.`);
  }
  return value;
}

function optionalText(value, max, path) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) throw new CustomEmbedError(`${path} admite máximo ${max} caracteres.`);
  return text;
}

function requiredText(value, max, path) {
  const text = optionalText(value, max, path);
  if (!text) throw new CustomEmbedError(`${path} es obligatorio.`);
  return text;
}

function httpsUrl(value, path) {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim();
  if (raw.length > LIMITS.url) throw new CustomEmbedError(`${path} es demasiado largo.`);
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || isPrivateHostname(url.hostname)) throw new Error('invalid');
    return url.toString();
  } catch {
    throw new CustomEmbedError(`${path} debe ser una URL HTTPS pública y válida.`);
  }
}

function colorNumber(value) {
  const raw = String(value || '#5865F2').trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(raw)) {
    throw new CustomEmbedError('El color debe tener el formato #5865F2.');
  }
  return Number.parseInt(raw, 16);
}

function buttonEmoji(value, path) {
  const raw = optionalText(value, 100, path);
  if (!raw) return null;
  const custom = raw.match(/^<(a?):([A-Za-z0-9_]{2,32}):(\d{16,22})>$/);
  if (custom) return { animated: custom[1] === 'a', name: custom[2], id: custom[3] };
  if ([...raw].length > 8 || /[<>]/.test(raw)) {
    throw new CustomEmbedError(`${path} debe ser un emoji normal o uno personalizado como <:nombre:ID>.`);
  }
  return { name: raw };
}

function sanitizeFields(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > LIMITS.fields) {
    throw new CustomEmbedError(`Puedes añadir máximo ${LIMITS.fields} campos.`);
  }
  return value.map((entry, index) => {
    const field = plainObject(entry, `El campo ${index + 1}`);
    return {
      name: requiredText(field.name, LIMITS.fieldName, `El nombre del campo ${index + 1}`),
      value: requiredText(field.value, LIMITS.fieldValue, `El contenido del campo ${index + 1}`),
      inline: field.inline === true
    };
  });
}

function sanitizeButtons(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > LIMITS.buttons) {
    throw new CustomEmbedError(`Puedes añadir máximo ${LIMITS.buttons} botones.`);
  }
  return value.map((entry, index) => {
    const button = plainObject(entry, `El botón ${index + 1}`);
    const url = httpsUrl(button.url, `El enlace del botón ${index + 1}`);
    if (!url) throw new CustomEmbedError(`El enlace del botón ${index + 1} es obligatorio.`);
    return {
      label: requiredText(button.label, LIMITS.buttonLabel, `La etiqueta del botón ${index + 1}`),
      url,
      emoji: buttonEmoji(button.emoji, `El emoji del botón ${index + 1}`)
    };
  });
}

function sanitizeCustomEmbed(input) {
  const source = plainObject(input, 'La publicación');
  const embedInput = source.embed === undefined ? source : plainObject(source.embed, 'El embed');
  const authorInput = embedInput.author == null ? {} : plainObject(embedInput.author, 'El autor');
  const footerInput = embedInput.footer == null ? {} : plainObject(embedInput.footer, 'El pie');

  const result = {
    channelId: requiredText(source.channelId, 22, 'El canal'),
    content: optionalText(source.content, LIMITS.content, 'El texto exterior'),
    embed: {
      author: {
        name: optionalText(authorInput.name, LIMITS.authorName, 'El nombre del autor'),
        url: httpsUrl(authorInput.url, 'El enlace del autor'),
        iconUrl: httpsUrl(authorInput.iconUrl, 'El icono del autor')
      },
      title: optionalText(embedInput.title, LIMITS.title, 'El título'),
      url: httpsUrl(embedInput.url, 'El enlace del título'),
      description: optionalText(embedInput.description, LIMITS.description, 'La descripción'),
      color: colorNumber(embedInput.color),
      thumbnail: httpsUrl(embedInput.thumbnail, 'La miniatura'),
      image: httpsUrl(embedInput.image, 'La imagen principal'),
      fields: sanitizeFields(embedInput.fields),
      footer: {
        text: optionalText(footerInput.text, LIMITS.footer, 'El pie'),
        iconUrl: httpsUrl(footerInput.iconUrl, 'El icono del pie')
      },
      timestamp: embedInput.timestamp === true
    },
    buttons: sanitizeButtons(source.buttons)
  };

  if (!/^\d{16,22}$/.test(result.channelId)) throw new CustomEmbedError('El canal seleccionado no es válido.');
  if (result.embed.url && !result.embed.title) throw new CustomEmbedError('Escribe un título antes de añadirle un enlace.');
  if ((result.embed.author.url || result.embed.author.iconUrl) && !result.embed.author.name) {
    throw new CustomEmbedError('Escribe el nombre del autor antes de añadir su enlace o icono.');
  }
  if (result.embed.footer.iconUrl && !result.embed.footer.text) {
    throw new CustomEmbedError('Escribe el pie antes de añadirle un icono.');
  }

  const hasEmbed = Boolean(
    result.embed.author.name || result.embed.title || result.embed.description ||
    result.embed.thumbnail || result.embed.image || result.embed.fields.length || result.embed.footer.text
  );
  if (!hasEmbed) throw new CustomEmbedError('El embed necesita un título, una descripción, una imagen o al menos un campo.');

  const total = [
    result.embed.author.name,
    result.embed.title,
    result.embed.description,
    result.embed.footer.text,
    ...result.embed.fields.flatMap(field => [field.name, field.value])
  ].reduce((sum, text) => sum + (text?.length || 0), 0);
  if (total > LIMITS.embedTotal) {
    throw new CustomEmbedError(`El contenido total del embed supera los ${LIMITS.embedTotal} caracteres permitidos por Discord.`);
  }

  return result;
}

function buildCustomEmbedPayload(input) {
  const safe = sanitizeCustomEmbed(input);
  const embed = new EmbedBuilder().setColor(safe.embed.color);

  if (safe.embed.author.name) {
    embed.setAuthor({
      name: safe.embed.author.name,
      ...(safe.embed.author.url ? { url: safe.embed.author.url } : {}),
      ...(safe.embed.author.iconUrl ? { iconURL: safe.embed.author.iconUrl } : {})
    });
  }
  if (safe.embed.title) embed.setTitle(safe.embed.title);
  if (safe.embed.url) embed.setURL(safe.embed.url);
  if (safe.embed.description) embed.setDescription(safe.embed.description);
  if (safe.embed.thumbnail) embed.setThumbnail(safe.embed.thumbnail);
  if (safe.embed.image) embed.setImage(safe.embed.image);
  if (safe.embed.fields.length) embed.addFields(safe.embed.fields);
  if (safe.embed.footer.text) {
    embed.setFooter({
      text: safe.embed.footer.text,
      ...(safe.embed.footer.iconUrl ? { iconURL: safe.embed.footer.iconUrl } : {})
    });
  }
  if (safe.embed.timestamp) embed.setTimestamp();

  const payload = {
    embeds: [embed],
    allowedMentions: { parse: [], roles: [], users: [], repliedUser: false }
  };
  if (safe.content) payload.content = safe.content;
  if (safe.buttons.length) {
    const row = new ActionRowBuilder();
    row.addComponents(safe.buttons.map(button => {
      const component = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(button.label)
        .setURL(button.url);
      if (button.emoji) component.setEmoji(button.emoji);
      return component;
    }));
    payload.components = [row];
  }

  return { channelId: safe.channelId, payload, summary: {
    fieldCount: safe.embed.fields.length,
    buttonCount: safe.buttons.length,
    hasImage: Boolean(safe.embed.image),
    hasThumbnail: Boolean(safe.embed.thumbnail)
  } };
}

module.exports = {
  LIMITS,
  CustomEmbedError,
  sanitizeCustomEmbed,
  buildCustomEmbedPayload,
  buttonEmoji
};
