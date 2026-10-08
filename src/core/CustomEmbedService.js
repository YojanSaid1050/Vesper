const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder
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
  content: 2000, authorName: 256, title: 256, description: 4096,
  fieldName: 256, fieldValue: 1024, fields: 25, footer: 2048,
  buttons: 20, buttonLabel: 80, roleMenuRoles: 25,
  roleMenuPlaceholder: 150, componentRows: 5, url: 500, embedTotal: 6000
});

const BUTTON_TYPES = new Set(['link', 'channel', 'role', 'ticket']);
const ROLE_ACTIONS = new Set(['toggle', 'add', 'remove']);
const ROLE_MENU_MODES = new Set(['toggle', 'add', 'remove', 'exclusive']);
const BUTTON_STYLES = Object.freeze({
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger
});

function plainObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CustomEmbedError(`${path} no es válido.`);
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

function discordId(value, path, { optional = false } = {}) {
  const text = optionalText(value, 22, path);
  if (!text && optional) return null;
  if (!text || !/^\d{16,22}$/.test(text)) throw new CustomEmbedError(`${path} no es válido.`);
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
  if (!/^[0-9A-Fa-f]{6}$/.test(raw)) throw new CustomEmbedError('El color debe tener el formato #5865F2.');
  return Number.parseInt(raw, 16);
}

function buttonEmoji(value, path) {
  const raw = optionalText(value, 100, path);
  if (!raw) return null;
  const custom = raw.match(/^<(a?):([A-Za-z0-9_]{2,32}):(\d{16,22})>$/);
  if (custom) return { animated: custom[1] === 'a', name: custom[2], id: custom[3] };
  if ([...raw].length > 8 || /[<>]/.test(raw)) throw new CustomEmbedError(`${path} debe ser un emoji normal o uno personalizado como <:nombre:ID>.`);
  return { name: raw };
}

function sanitizeFields(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > LIMITS.fields) throw new CustomEmbedError(`Puedes añadir máximo ${LIMITS.fields} campos.`);
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
  if (!Array.isArray(value) || value.length > LIMITS.buttons) throw new CustomEmbedError(`Puedes añadir máximo ${LIMITS.buttons} botones.`);
  return value.map((entry, index) => {
    const button = plainObject(entry, `El botón ${index + 1}`);
    const type = BUTTON_TYPES.has(button.type) ? button.type : 'link';
    const common = {
      type,
      label: requiredText(button.label, LIMITS.buttonLabel, `La etiqueta del botón ${index + 1}`),
      emoji: buttonEmoji(button.emoji, `El emoji del botón ${index + 1}`),
      style: Object.hasOwn(BUTTON_STYLES, button.style) ? button.style : 'secondary'
    };
    if (type === 'link') {
      const url = httpsUrl(button.url, `El enlace del botón ${index + 1}`);
      if (!url) throw new CustomEmbedError(`El enlace del botón ${index + 1} es obligatorio.`);
      return { ...common, url };
    }
    if (type === 'channel') return { ...common, channelId: discordId(button.channelId, `El canal del botón ${index + 1}`) };
    if (type === 'role') {
      const action = ROLE_ACTIONS.has(button.roleAction) ? button.roleAction : 'toggle';
      return { ...common, roleId: discordId(button.roleId, `El rol del botón ${index + 1}`), roleAction: action };
    }
    return common;
  });
}

function sanitizeRoleMenu(value) {
  if (value === undefined || value === null || value.enabled !== true) return null;
  const menu = plainObject(value, 'El menú de roles');
  const roles = Array.isArray(menu.roles) ? menu.roles : [];
  if (!roles.length || roles.length > LIMITS.roleMenuRoles) throw new CustomEmbedError(`El menú necesita entre 1 y ${LIMITS.roleMenuRoles} roles.`);
  const seen = new Set();
  const normalized = roles.map((entry, index) => {
    const role = typeof entry === 'string' ? { roleId: entry } : plainObject(entry, `El rol ${index + 1} del menú`);
    const roleId = discordId(role.roleId || role.id, `El rol ${index + 1} del menú`);
    if (seen.has(roleId)) throw new CustomEmbedError('No repitas roles en el mismo menú.');
    seen.add(roleId);
    return {
      roleId,
      label: optionalText(role.label || role.name, 100, `La etiqueta del rol ${index + 1}`) || `Rol ${index + 1}`,
      description: optionalText(role.description, 100, `La descripción del rol ${index + 1}`),
      emoji: buttonEmoji(role.emoji, `El emoji del rol ${index + 1}`)
    };
  });
  return {
    enabled: true,
    mode: ROLE_MENU_MODES.has(menu.mode) ? menu.mode : 'toggle',
    placeholder: optionalText(menu.placeholder, LIMITS.roleMenuPlaceholder, 'El texto del menú') || 'Elige tus roles',
    roles: normalized
  };
}

function sanitizeCustomEmbed(input) {
  const source = plainObject(input, 'La publicación');
  const embedInput = source.embed === undefined ? source : plainObject(source.embed, 'El embed');
  const authorInput = embedInput.author == null ? {} : plainObject(embedInput.author, 'El autor');
  const footerInput = embedInput.footer == null ? {} : plainObject(embedInput.footer, 'El pie');
  const result = {
    channelId: discordId(source.channelId, 'El canal seleccionado'),
    mentionRoleId: discordId(source.mentionRoleId, 'El rol a mencionar', { optional: true }),
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
    buttons: sanitizeButtons(source.buttons),
    roleMenu: sanitizeRoleMenu(source.roleMenu)
  };

  if (result.mentionRoleId && (result.content?.length || 0) + result.mentionRoleId.length + 5 > LIMITS.content) {
    throw new CustomEmbedError('El texto exterior es demasiado largo para añadir la mención del rol.');
  }
  if (result.buttons.filter(button => button.type === 'ticket').length > 1) {
    throw new CustomEmbedError('Añade un solo botón para abrir tickets en cada publicación.');
  }
  if (result.embed.url && !result.embed.title) throw new CustomEmbedError('Escribe un título antes de añadirle un enlace.');
  if ((result.embed.author.url || result.embed.author.iconUrl) && !result.embed.author.name) throw new CustomEmbedError('Escribe el nombre del autor antes de añadir su enlace o icono.');
  if (result.embed.footer.iconUrl && !result.embed.footer.text) throw new CustomEmbedError('Escribe el pie antes de añadirle un icono.');
  const hasEmbed = Boolean(result.embed.author.name || result.embed.title || result.embed.description || result.embed.thumbnail || result.embed.image || result.embed.fields.length || result.embed.footer.text);
  if (!hasEmbed) throw new CustomEmbedError('El embed necesita un título, una descripción, una imagen o al menos un campo.');
  const total = [result.embed.author.name, result.embed.title, result.embed.description, result.embed.footer.text, ...result.embed.fields.flatMap(field => [field.name, field.value])]
    .reduce((sum, text) => sum + (text?.length || 0), 0);
  if (total > LIMITS.embedTotal) throw new CustomEmbedError(`El contenido total del embed supera los ${LIMITS.embedTotal} caracteres permitidos por Discord.`);
  const rows = Math.ceil(result.buttons.length / 5) + (result.roleMenu ? 1 : 0);
  if (rows > LIMITS.componentRows) throw new CustomEmbedError(`Discord admite máximo ${LIMITS.componentRows} filas de componentes. Reduce los botones o quita el menú de roles.`);
  return result;
}

function buildCustomEmbedPayload(input, { guildId } = {}) {
  const safe = sanitizeCustomEmbed(input);
  const embed = new EmbedBuilder().setColor(safe.embed.color);
  if (safe.embed.author.name) embed.setAuthor({ name: safe.embed.author.name, ...(safe.embed.author.url ? { url: safe.embed.author.url } : {}), ...(safe.embed.author.iconUrl ? { iconURL: safe.embed.author.iconUrl } : {}) });
  if (safe.embed.title) embed.setTitle(safe.embed.title);
  if (safe.embed.url) embed.setURL(safe.embed.url);
  if (safe.embed.description) embed.setDescription(safe.embed.description);
  if (safe.embed.thumbnail) embed.setThumbnail(safe.embed.thumbnail);
  if (safe.embed.image) embed.setImage(safe.embed.image);
  if (safe.embed.fields.length) embed.addFields(safe.embed.fields);
  if (safe.embed.footer.text) embed.setFooter({ text: safe.embed.footer.text, ...(safe.embed.footer.iconUrl ? { iconURL: safe.embed.footer.iconUrl } : {}) });
  if (safe.embed.timestamp) embed.setTimestamp();

  const payload = { embeds: [embed], allowedMentions: { parse: [], roles: safe.mentionRoleId ? [safe.mentionRoleId] : [], users: [], repliedUser: false } };
  const contentParts = [];
  if (safe.mentionRoleId) contentParts.push(`<@&${safe.mentionRoleId}>`);
  if (safe.content) contentParts.push(safe.content);
  if (contentParts.length) payload.content = contentParts.join('\n');

  const rows = [];
  for (let offset = 0; offset < safe.buttons.length; offset += 5) {
    const row = new ActionRowBuilder();
    row.addComponents(safe.buttons.slice(offset, offset + 5).map((button, rowIndex) => {
      const component = new ButtonBuilder().setLabel(button.label);
      if (button.emoji) component.setEmoji(button.emoji);
      if (button.type === 'link') component.setStyle(ButtonStyle.Link).setURL(button.url);
      else if (button.type === 'channel') {
        if (!guildId) throw new CustomEmbedError('Falta el servidor para construir el enlace del canal.');
        component.setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guildId}/${button.channelId}`);
      } else if (button.type === 'role') {
        component.setStyle(BUTTON_STYLES[button.style]).setCustomId(`vesper_role:${button.roleAction}:${button.roleId}:${offset + rowIndex}`);
      } else component.setStyle(BUTTON_STYLES[button.style]).setCustomId('community_ticket_open');
      return component;
    }));
    rows.push(row);
  }
  if (safe.roleMenu) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`vesper_roles:${safe.roleMenu.mode}`)
      .setPlaceholder(safe.roleMenu.placeholder)
      .setMinValues(0)
      .setMaxValues(safe.roleMenu.mode === 'exclusive' ? 1 : safe.roleMenu.roles.length)
      .addOptions(safe.roleMenu.roles.map(role => ({ label: role.label, value: role.roleId, ...(role.description ? { description: role.description } : {}), ...(role.emoji ? { emoji: role.emoji } : {}) })));
    rows.push(new ActionRowBuilder().addComponents(menu));
  }
  if (rows.length) payload.components = rows;

  const assignableRoleIds = [...new Set([...safe.buttons.filter(button => button.type === 'role').map(button => button.roleId), ...(safe.roleMenu?.roles || []).map(role => role.roleId)])];
  const interactive = safe.buttons.some(button => ['role', 'ticket'].includes(button.type)) || Boolean(safe.roleMenu);
  return {
    channelId: safe.channelId,
    payload,
    hasInteractiveComponents: interactive,
    targets: {
      mentionRoleId: safe.mentionRoleId,
      assignableRoleIds,
      channelIds: safe.buttons.filter(button => button.type === 'channel').map(button => button.channelId),
      usesTicket: safe.buttons.some(button => button.type === 'ticket')
    },
    summary: {
      fieldCount: safe.embed.fields.length,
      buttonCount: safe.buttons.length,
      roleMenuCount: safe.roleMenu?.roles.length || 0,
      hasImage: Boolean(safe.embed.image),
      hasThumbnail: Boolean(safe.embed.thumbnail),
      interactive
    }
  };
}

module.exports = { LIMITS, CustomEmbedError, sanitizeCustomEmbed, buildCustomEmbedPayload, buttonEmoji };
