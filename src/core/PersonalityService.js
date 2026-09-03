const { isMainGuild } = require('../config/guildPolicy');

const TEXT = Object.freeze({
  neutral: {
    unexpectedError: 'Ocurrió un error al ejecutar esta acción. Inténtalo nuevamente.',
    notAuthorized: 'No tienes autorización para utilizar esta función.',
    welcomeTitle: '¡Bienvenido!',
    welcomeBody: member => `Hola ${member}. Esperamos que disfrutes tu estancia en **${member.guild.name}**.`,
    goodbyeTitle: 'Hasta pronto',
    goodbyeBody: member => `**${member.user.username}** ha salido del servidor.`
  }
});

function profileForGuild(guildId) {
  return isMainGuild(guildId) ? 'main' : 'neutral';
}

function text(guildId, key, ...args) {
  const profile = profileForGuild(guildId);
  if (profile === 'main') return null;
  const value = TEXT.neutral[key];
  return typeof value === 'function' ? value(...args) : value;
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

module.exports = { profileForGuild, text, neutralWelcomePayload, neutralGoodbyePayload };
