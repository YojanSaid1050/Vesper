const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { MODULE_DEFAULTS, isAnyMainGuild, isMainGuild } = require('../config/guildPolicy');
const { normalizeAllowedDomain } = require('../core/ModerationService');
const { EMBED_KINDS, EMBED_FIELD_LIMITS } = require('../core/EmbedTemplateService');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

const CHANNEL_FIELDS = Object.freeze({
  general: ['welcomeChannel', 'goodbyeChannel', 'logChannel', 'botLogChannel'],
  tiktok: ['liveChannel', 'videoChannel'],
  twitch: ['liveChannel'],
  youtube: ['liveChannel', 'videoChannel', 'shortChannel'],
  music: ['requestChannel']
});
const ROLE_ARRAY_FIELDS = ['socialManagerRoles', 'moderatorRoles', 'musicDjRoles'];

function booleanValue(value, path) {
  if (typeof value !== 'boolean') throw new ValidationError(`${path} debe ser verdadero o falso.`);
  return value;
}

function integerValue(value, min, max, path) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ValidationError(`${path} debe ser un entero entre ${min} y ${max}.`);
  }
  return number;
}

function uniqueArray(values, max, path) {
  if (!Array.isArray(values) || values.length > max) throw new ValidationError(`${path} debe ser una lista de máximo ${max} elementos.`);
  return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

function channelValue(guild, value, path) {
  if (value === null || value === '') return null;
  const channel = guild.channels.cache.get(String(value));
  if (!channel || !channel.isTextBased() || channel.isThread?.()) throw new ValidationError(`${path} no corresponde a un canal de texto de este servidor.`);
  const botMember = guild.members.me;
  const permissions = channel.permissionsFor(botMember);
  if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    throw new ValidationError(`Vesper no puede ver, escribir o insertar enlaces en ${channel.name}.`);
  }
  return channel.id;
}

function roleValue(guild, value, path) {
  const role = guild.roles.cache.get(String(value));
  if (!role || role.id === guild.id) throw new ValidationError(`${path} contiene un rol inexistente.`);
  return role.id;
}

function assignableRoleValue(guild, value, path) {
  const roleId = roleValue(guild, value, path);
  const role = guild.roles.cache.get(roleId);
  const me = guild.members.me;
  if (role.managed || !me?.permissions?.has(PermissionFlagsBits.ManageRoles) || role.position >= me.roles.highest.position) {
    throw new ValidationError(`${path} no es asignable por Vesper debido a la jerarquía de roles.`);
  }
  return role.id;
}

function voiceChannelValue(guild, value, path) {
  if (value === null || value === '') return null;
  const channel = guild.channels.cache.get(String(value));
  if (!channel || ![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type)) {
    throw new ValidationError(`${path} no corresponde a un canal de voz de este servidor.`);
  }
  const permissions = channel.permissionsFor(guild.members.me);
  if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
    throw new ValidationError(`Vesper necesita Ver canal, Conectar y Hablar en ${channel.name}.`);
  }
  return channel.id;
}

function optionalText(value, max, path) {
  if (value === null || value === '') return null;
  const text = String(value).trim();
  if (!text || text.length > max) throw new ValidationError(`${path} debe tener máximo ${max} caracteres.`);
  return text;
}

function colorValue(value, path) {
  const color = String(value || '').trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color)) throw new ValidationError(`${path} debe ser un color hexadecimal como #8DDCF4.`);
  return color;
}

function imageUrlValue(value, path) {
  if (value === null || value === '') return null;
  const raw = String(value).trim();
  if (raw.length > 500) throw new ValidationError(`${path} es demasiado largo.`);
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid');
    return url.toString();
  } catch {
    throw new ValidationError(`${path} debe ser una URL HTTPS válida.`);
  }
}

function shortText(value, max, path) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw new ValidationError(`${path} debe contener entre 1 y ${max} caracteres.`);
  return text;
}

function sanitizeGuildPatch(input, guild) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('La configuración enviada no es válida.');
  const updates = {};

  if (input.profile !== undefined) {
    // Embers Void y los Main temáticos son servidores de primer nivel: ambos
    // pueden definir su identidad. Los satélites no.
    if (!isAnyMainGuild(guild.id)) throw new ValidationError('La identidad del bot solo puede editarse en un servidor Main autorizado.');
    const source = input.profile;
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new ValidationError('profile no es válido.');
    const target = {};
    if (source.theme !== undefined) {
      const allowedThemes = isMainGuild(guild.id) ? ['void', 'custom'] : ['cinnamoroll', 'custom'];
      if (!allowedThemes.includes(source.theme)) throw new ValidationError('profile.theme no es válido para este servidor.');
      target.theme = source.theme;
    }
    if (source.displayName !== undefined) target.displayName = optionalText(source.displayName, 80, 'profile.displayName');
    if (source.avatar !== undefined) target.avatar = imageUrlValue(source.avatar, 'profile.avatar');
    if (source.primaryColor !== undefined) target.primaryColor = colorValue(source.primaryColor, 'profile.primaryColor');
    if (source.secondaryColor !== undefined) target.secondaryColor = colorValue(source.secondaryColor, 'profile.secondaryColor');
    if (source.welcomeTitle !== undefined) target.welcomeTitle = optionalText(source.welcomeTitle, 120, 'profile.welcomeTitle');
    if (source.welcomeMessage !== undefined) target.welcomeMessage = optionalText(source.welcomeMessage, 1500, 'profile.welcomeMessage');
    if (source.goodbyeTitle !== undefined) target.goodbyeTitle = optionalText(source.goodbyeTitle, 120, 'profile.goodbyeTitle');
    if (source.goodbyeMessage !== undefined) target.goodbyeMessage = optionalText(source.goodbyeMessage, 1500, 'profile.goodbyeMessage');
    if (source.memberRole !== undefined) target.memberRole = source.memberRole === null || source.memberRole === ''
      ? null
      : assignableRoleValue(guild, source.memberRole, 'profile.memberRole');
    if (Object.keys(target).length) updates.profile = target;
  }

  // Branding por servidor: nombre y avatar con los que el bot publica a través
  // de webhooks. Lo gestionaban /setbotname, /setbotavatar y /branding, que el
  // panel declara reemplazar, pero no había forma de editarlo desde la web.
  if (input.branding !== undefined) {
    const source = input.branding;
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new ValidationError('branding no es válido.');
    const target = {};
    if (source.name !== undefined) target.name = optionalText(source.name, 80, 'branding.name');
    if (source.avatar !== undefined) target.avatar = imageUrlValue(source.avatar, 'branding.avatar');
    if (Object.keys(target).length) updates.branding = target;
  }

  // Editor de embeds de bienvenida y despedida. Disponible en cualquier
  // servidor: cada Main tiene su propio diseño y sus propios textos.
  if (input.embeds !== undefined) {
    const source = input.embeds;
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new ValidationError('embeds no es válido.');
    const target = {};
    for (const kind of EMBED_KINDS) {
      if (source[kind] === undefined) continue;
      const block = source[kind];
      if (!block || typeof block !== 'object' || Array.isArray(block)) throw new ValidationError(`embeds.${kind} no es válido.`);
      const result = {};
      for (const field of ['title', 'message', 'footer']) {
        if (block[field] === undefined) continue;
        result[field] = optionalText(block[field], EMBED_FIELD_LIMITS[field], `embeds.${kind}.${field}`);
      }
      if (block.image !== undefined) result.image = imageUrlValue(block.image, `embeds.${kind}.image`);
      if (block.color !== undefined) {
        result.color = block.color === null || block.color === '' ? null : colorValue(block.color, `embeds.${kind}.color`);
      }
      if (block.thumbnail !== undefined) result.thumbnail = booleanValue(block.thumbnail, `embeds.${kind}.thumbnail`);
      if (Object.keys(result).length) target[kind] = result;
    }
    if (Object.keys(target).length) updates.embeds = target;
  }

  if (input.features !== undefined) {
    if (!input.features || typeof input.features !== 'object' || Array.isArray(input.features)) throw new ValidationError('features no es válido.');
    updates.features = {};
    for (const key of Object.keys(MODULE_DEFAULTS)) {
      if (input.features[key] !== undefined) updates.features[key] = booleanValue(input.features[key], `features.${key}`);
    }
    if (!Object.keys(updates.features).length) delete updates.features;
  }

  for (const [section, fields] of Object.entries(CHANNEL_FIELDS)) {
    if (input[section] === undefined) continue;
    if (!input[section] || typeof input[section] !== 'object' || Array.isArray(input[section])) throw new ValidationError(`${section} no es válido.`);
    updates[section] ||= {};
    for (const field of fields) {
      if (input[section][field] !== undefined) updates[section][field] = channelValue(guild, input[section][field], `${section}.${field}`);
    }
    if (!Object.keys(updates[section]).length) delete updates[section];
  }

  for (const platform of ['tiktok', 'twitch', 'youtube']) {
    if (input[platform]?.pingRole === undefined) continue;
    updates[platform] ||= {};
    updates[platform].pingRole = input[platform].pingRole === null || input[platform].pingRole === ''
      ? null
      : roleValue(guild, input[platform].pingRole, `${platform}.pingRole`);
  }

  if (input.general?.botRole !== undefined) {
    updates.general ||= {};
    if (input.general.botRole === null || input.general.botRole === '') updates.general.botRole = null;
    else {
      const role = guild.roles.cache.get(String(input.general.botRole));
      if (!role || role.managed || role.id === guild.id) throw new ValidationError('general.botRole no es un rol asignable.');
      if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles) || role.position >= guild.members.me.roles.highest.position) {
        throw new ValidationError('Vesper no puede asignar ese rol por la jerarquía del servidor.');
      }
      updates.general.botRole = role.id;
    }
  }

  if (input.permissions !== undefined) {
    if (!input.permissions || typeof input.permissions !== 'object' || Array.isArray(input.permissions)) throw new ValidationError('permissions no es válido.');
    updates.permissions = {};
    for (const field of ROLE_ARRAY_FIELDS) {
      if (input.permissions[field] === undefined) continue;
      updates.permissions[field] = uniqueArray(input.permissions[field], 25, `permissions.${field}`)
        .map(value => roleValue(guild, value, `permissions.${field}`));
    }
    if (!Object.keys(updates.permissions).length) delete updates.permissions;
  }

  if (input.moderation !== undefined) {
    const source = input.moderation;
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new ValidationError('moderation no es válido.');
    const target = {};
    if (source.filterLinks !== undefined) target.filterLinks = booleanValue(source.filterLinks, 'moderation.filterLinks');
    if (source.blockInvites !== undefined) target.blockInvites = booleanValue(source.blockInvites, 'moderation.blockInvites');
    if (source.maxMentions !== undefined) target.maxMentions = integerValue(source.maxMentions, 1, 25, 'moderation.maxMentions');
    if (source.repeatLimit !== undefined) target.repeatLimit = integerValue(source.repeatLimit, 2, 15, 'moderation.repeatLimit');
    if (source.action !== undefined) {
      if (!['delete', 'warn', 'timeout'].includes(source.action)) throw new ValidationError('moderation.action no es válido.');
      target.action = source.action;
    }
    if (source.allowedDomains !== undefined) {
      const domains = uniqueArray(source.allowedDomains, 100, 'moderation.allowedDomains').map(normalizeAllowedDomain);
      if (domains.some(domain => !domain)) throw new ValidationError('Hay un dominio permitido que no es válido.');
      target.allowedDomains = [...new Set(domains)];
    }
    if (source.exemptChannels !== undefined) {
      target.exemptChannels = uniqueArray(source.exemptChannels, 100, 'moderation.exemptChannels').map(value => {
        const channel = guild.channels.cache.get(value);
        if (!channel) throw new ValidationError('moderation.exemptChannels contiene un canal inexistente.');
        return channel.id;
      });
    }
    if (source.exemptRoles !== undefined) {
      target.exemptRoles = uniqueArray(source.exemptRoles, 100, 'moderation.exemptRoles').map(value => roleValue(guild, value, 'moderation.exemptRoles'));
    }
    if (Object.keys(target).length) updates.moderation = target;
  }

  if (input.music !== undefined) {
    const source = input.music;
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new ValidationError('music no es válido.');
    const target = updates.music || {};
    if (source.preferredVoiceChannel !== undefined) {
      target.preferredVoiceChannel = voiceChannelValue(guild, source.preferredVoiceChannel, 'music.preferredVoiceChannel');
    }
    const limits = {
      defaultVolume: [1, 100], maxQueue: [1, 500], maxPerUser: [1, 25],
      maxTrackMinutes: [1, 180], idleSeconds: [30, 3600]
    };
    for (const [field, [min, max]] of Object.entries(limits)) {
      if (source[field] !== undefined) target[field] = integerValue(source[field], min, max, `music.${field}`);
    }
    if (Object.keys(target).length) updates.music = target;
  }

  if (input.community !== undefined) {
    const source = input.community;
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new ValidationError('community no es válido.');
    const target = {};
    if (source.tickets !== undefined) {
      const tickets = source.tickets;
      if (!tickets || typeof tickets !== 'object' || Array.isArray(tickets)) throw new ValidationError('community.tickets no es válido.');
      const result = {};
      for (const field of ['panelChannel', 'transcriptChannel']) {
        if (tickets[field] !== undefined) result[field] = channelValue(guild, tickets[field], `community.tickets.${field}`);
      }
      if (tickets.category !== undefined) {
        if (tickets.category === null || tickets.category === '') result.category = null;
        else {
          const category = guild.channels.cache.get(String(tickets.category));
          if (!category || category.type !== ChannelType.GuildCategory) throw new ValidationError('community.tickets.category no es una categoría del servidor.');
          result.category = category.id;
        }
      }
      if (tickets.staffRoles !== undefined) result.staffRoles = uniqueArray(tickets.staffRoles, 25, 'community.tickets.staffRoles').map(value => roleValue(guild, value, 'community.tickets.staffRoles'));
      if (tickets.maxOpenPerUser !== undefined) result.maxOpenPerUser = integerValue(tickets.maxOpenPerUser, 1, 5, 'community.tickets.maxOpenPerUser');
      if (Object.keys(result).length) target.tickets = result;
    }
    if (source.suggestions !== undefined) {
      const suggestions = source.suggestions;
      if (!suggestions || typeof suggestions !== 'object' || Array.isArray(suggestions)) throw new ValidationError('community.suggestions no es válido.');
      if (suggestions.channel !== undefined) target.suggestions = { channel: channelValue(guild, suggestions.channel, 'community.suggestions.channel') };
    }
    if (source.selfRoles !== undefined) {
      const selfRoles = source.selfRoles;
      if (!selfRoles || typeof selfRoles !== 'object' || Array.isArray(selfRoles)) throw new ValidationError('community.selfRoles no es válido.');
      const result = {};
      if (selfRoles.panelChannel !== undefined) result.panelChannel = channelValue(guild, selfRoles.panelChannel, 'community.selfRoles.panelChannel');
      if (selfRoles.roles !== undefined) {
        result.roles = uniqueArray(selfRoles.roles, 25, 'community.selfRoles.roles').map(value => {
          const roleId = assignableRoleValue(guild, value, 'community.selfRoles.roles');
          return { roleId, label: guild.roles.cache.get(roleId).name, emoji: null, description: null };
        });
      }
      if (Object.keys(result).length) target.selfRoles = result;
    }
    if (source.starboard !== undefined) {
      const starboard = source.starboard;
      if (!starboard || typeof starboard !== 'object' || Array.isArray(starboard)) throw new ValidationError('community.starboard no es válido.');
      const result = {};
      if (starboard.channel !== undefined) result.channel = channelValue(guild, starboard.channel, 'community.starboard.channel');
      if (starboard.threshold !== undefined) result.threshold = integerValue(starboard.threshold, 2, 50, 'community.starboard.threshold');
      if (starboard.emoji !== undefined) result.emoji = shortText(starboard.emoji, 100, 'community.starboard.emoji');
      if (starboard.ignoredChannels !== undefined) {
        result.ignoredChannels = uniqueArray(starboard.ignoredChannels, 100, 'community.starboard.ignoredChannels').map(value => {
          const channel = guild.channels.cache.get(value);
          if (!channel) throw new ValidationError('community.starboard.ignoredChannels contiene un canal inexistente.');
          return channel.id;
        });
      }
      if (Object.keys(result).length) target.starboard = result;
    }
    if (Object.keys(target).length) updates.community = target;
  }

  if (!Object.keys(updates).length) throw new ValidationError('No se enviaron cambios compatibles.');
  return updates;
}

module.exports = { ValidationError, CHANNEL_FIELDS, sanitizeGuildPatch };
