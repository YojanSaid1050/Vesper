const { isMainGuild, isThemedMainGuild } = require('../config/guildPolicy');

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

function themedWelcomePayload(member, profile = {}) {
  return {
    embeds: [{
      title: profile.welcomeTitle || '☁️ ¡Una nueva estrella llegó!',
      description: profileMessage(profile.welcomeMessage || 'Hola {user}, bienvenido a **{server}**. Tu aventura entre nubes comienza aquí. ✨', member),
      color: colorNumber(profile.primaryColor, 0x8DDCF4),
      thumbnail: { url: member.user.displayAvatarURL() },
      footer: { text: `${profile.displayName || 'AnkeBot'} • Ankerie Dimension` },
      timestamp: new Date().toISOString()
    }]
  };
}

function themedGoodbyePayload(member, profile = {}) {
  return {
    embeds: [{
      title: profile.goodbyeTitle || '🌙 Hasta pronto',
      description: profileMessage(profile.goodbyeMessage || '**{username}** dejó {server}. Que las nubes acompañen su próximo viaje.', member),
      color: colorNumber(profile.secondaryColor, 0xF8C8DC),
      thumbnail: { url: member.user.displayAvatarURL() },
      footer: { text: `${profile.displayName || 'AnkeBot'} • Ankerie Dimension` },
      timestamp: new Date().toISOString()
    }]
  };
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
  themedGoodbyePayload
};
