const { isMainGuild, isThemedMainGuild } = require('../config/guildPolicy');
const { resolveEmbedTemplate } = require('./EmbedTemplateService');
const { containerFromTemplate } = require('./EmbedLayouts');

const TEXT = Object.freeze({
  neutral: {
    unexpectedError: 'Ocurrió un error al ejecutar esta acción. Inténtalo nuevamente.',
    notAuthorized: 'No tienes autorización para utilizar esta función.',
    welcomeTitle: '¡Bienvenido!',
    welcomeBody: member => `Hola ${member}. Esperamos que disfrutes tu estancia en **${member.guild.name}**.`,
    goodbyeTitle: 'Hasta pronto',
    goodbyeBody: member => `**${member.user.username}** ha salido del servidor.`
  },
  themed: {
    unexpectedError: 'Algo se perdió entre las nubes. Inténtalo nuevamente. ☁️',
    notAuthorized: 'Este rincón está reservado para el equipo de Ankerie Dimension.'
  }
});

function profileForGuild(guildId) {
  if (isMainGuild(guildId)) return 'main';
  if (isThemedMainGuild(guildId)) return 'themed_main';
  return 'neutral';
}

function text(guildId, key, ...args) {
  const profile = profileForGuild(guildId);
  if (profile === 'main') return null;
  const value = profile === 'themed_main' ? TEXT.themed[key] || TEXT.neutral[key] : TEXT.neutral[key];
  return typeof value === 'function' ? value(...args) : value;
}

function colorNumber(value, fallback) {
  const normalized = String(value || '').replace(/^#/, '');
  return /^[0-9A-Fa-f]{6}$/.test(normalized) ? Number.parseInt(normalized, 16) : fallback;
}

function profileMessage(template, member) {
  return String(template || '')
    .replaceAll('{user}', member.toString())
    .replaceAll('{username}', member.user.username)
    .replaceAll('{server}', member.guild.name);
}

const THEMED_DEFAULTS = Object.freeze({
  welcomeTitle: '☁️ ¡Una nueva estrella llegó!',
  welcomeMessage: 'Hola {user}, bienvenido a **{server}**. Tu aventura entre nubes comienza aquí. ✨',
  goodbyeTitle: '🌙 Hasta pronto',
  goodbyeMessage: '**{username}** dejó {server}. Que las nubes acompañen su próximo viaje.',
  primaryColor: 0x8DDCF4,
  secondaryColor: 0xF8C8DC,
  displayName: 'AnkeBot',
  guildLabel: 'Ankerie Dimension'
});

// Construye el embed temático. El orden de prioridad es:
// 1) lo guardado en `embeds.<kind>` desde el editor del panel,
// 2) los campos antiguos de `profile` (compatibilidad con configuraciones ya
//    existentes, para no perder lo que el administrador ya había escrito),
// 3) el texto original del bot.
function themedPayload(member, kind, config = {}) {
  const profile = config?.profile || {};
  const welcome = kind === 'welcome';
  const legacyTitle = welcome ? profile.welcomeTitle : profile.goodbyeTitle;
  const legacyMessage = welcome ? profile.welcomeMessage : profile.goodbyeMessage;
  const legacyColor = welcome ? profile.primaryColor : profile.secondaryColor;
  const displayName = profile.displayName || THEMED_DEFAULTS.displayName;

  const template = resolveEmbedTemplate(config, kind, member, {
    title: legacyTitle || (welcome ? THEMED_DEFAULTS.welcomeTitle : THEMED_DEFAULTS.goodbyeTitle),
    message: profileMessage(legacyMessage || (welcome ? THEMED_DEFAULTS.welcomeMessage : THEMED_DEFAULTS.goodbyeMessage), member),
    footer: `${displayName} • ${member?.guild?.name || THEMED_DEFAULTS.guildLabel}`,
    color: colorNumber(legacyColor, welcome ? THEMED_DEFAULTS.primaryColor : THEMED_DEFAULTS.secondaryColor),
    image: null,
    thumbnail: true,
    layout: 'classic'
  });

  // Aquí el embed clásico es lo de fábrica, pero el administrador puede pedir
  // el contenedor V2 desde el panel y queda igual que el de Embers Void.
  if (template.layout === 'components_v2') return containerFromTemplate(template);

  const embed = {
    title: template.title,
    description: template.message,
    color: template.color,
    timestamp: new Date().toISOString()
  };
  if (template.thumbnail) embed.thumbnail = { url: member.user.displayAvatarURL() };
  if (template.image) embed.image = { url: template.image };
  if (template.footer) embed.footer = { text: template.footer };
  return { embeds: [embed] };
}

// Se sigue aceptando un `profile` suelto como segundo argumento por
// compatibilidad con las llamadas antiguas.
function normalizeThemedConfig(configOrProfile) {
  if (!configOrProfile || typeof configOrProfile !== 'object') return {};
  return configOrProfile.profile || configOrProfile.embeds
    ? configOrProfile
    : { profile: configOrProfile };
}

function themedWelcomePayload(member, configOrProfile = {}) {
  return themedPayload(member, 'welcome', normalizeThemedConfig(configOrProfile));
}

function themedGoodbyePayload(member, configOrProfile = {}) {
  return themedPayload(member, 'goodbye', normalizeThemedConfig(configOrProfile));
}

function neutralWelcomePayload(member) {
  return {
    embeds: [{
      title: TEXT.neutral.welcomeTitle,
      description: TEXT.neutral.welcomeBody(member),
      color: 0x5865F2,
      thumbnail: { url: member.user.displayAvatarURL() },
      timestamp: new Date().toISOString()
    }]
  };
}

function neutralGoodbyePayload(member) {
  return {
    embeds: [{
      title: TEXT.neutral.goodbyeTitle,
      description: TEXT.neutral.goodbyeBody(member),
      color: 0x747F8D,
      thumbnail: { url: member.user.displayAvatarURL() },
      timestamp: new Date().toISOString()
    }]
  };
}

module.exports = {
  profileForGuild,
  text,
  colorNumber,
  profileMessage,
  neutralWelcomePayload,
  neutralGoodbyePayload,
  themedWelcomePayload,
  themedGoodbyePayload,
  themedPayload,
  THEMED_DEFAULTS
};
