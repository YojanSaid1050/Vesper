const { PermissionFlagsBits } = require('discord.js');
const ModerationCase = require('../database/models/ModerationCase');
const { getGuildConfig } = require('../database/mongoManager');
const { isModuleEnabledConfig } = require('../config/guildPolicy');

const repeats = new Map();
const URL_PATTERN = /https?:\/\/[^\s<]+/gi;
const INVITE_PATTERN = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/[\w-]+/i;

function normalizeDomain(rawUrl) {
  try { return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return null; }
}

function domainAllowed(domain, allowedDomains = []) {
  return allowedDomains.some(item => domain === item || domain.endsWith(`.${item}`));
}

function repeatedMessage(message, limit) {
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const content = message.content.trim().toLowerCase();
  const state = repeats.get(key) || { content: null, times: [] };
  state.times = state.content === content ? state.times.filter(time => now - time < 30_000) : [];
  state.content = content;
  state.times.push(now);
  repeats.set(key, state);
  return content.length >= 3 && state.times.length >= limit;
}

async function createCase({ guildId, userId, moderatorId, action, reason, evidence = null, expiresAt = null }) {
  return ModerationCase.create({ guildId, userId, moderatorId, action, reason, evidence, expiresAt });
}

async function applyAutomaticAction(message, config, reason) {
  await message.delete().catch(() => null);
  const moderation = config.moderation || {};
  let action = 'filter';
  let expiresAt = null;
  if (moderation.action === 'timeout' && message.member?.moderatable) {
    expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await message.member.timeout(5 * 60 * 1000, reason).catch(() => null);
    action = 'timeout';
  }
  await createCase({
    guildId: message.guild.id,
    userId: message.author.id,
    moderatorId: message.client.user.id,
    action,
    reason,
    evidence: message.content.slice(0, 1000),
    expiresAt
  });
  const notice = await message.channel.send({
    content: `<@${message.author.id}>, tu mensaje fue retirado: ${reason}`,
    allowedMentions: { users: [message.author.id], roles: [], parse: [] }
  }).catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => null), 10_000);
}

async function handleMessage(message) {
  if (!message.guild || message.author.bot || !message.content) return false;
  const config = await getGuildConfig(message.guild.id);
  if (!isModuleEnabledConfig(config, 'moderation')) return false;
  if (message.member?.permissions?.has(PermissionFlagsBits.ManageMessages)) return false;

  const moderation = config.moderation || {};
  let reason = null;
  if (moderation.blockInvites !== false && INVITE_PATTERN.test(message.content)) {
    reason = 'las invitaciones de Discord no están permitidas';
  }
  if (!reason && moderation.filterLinks) {
    const urls = message.content.match(URL_PATTERN) || [];
    const disallowed = urls.map(normalizeDomain).filter(Boolean).find(domain => !domainAllowed(domain, moderation.allowedDomains || []));
    if (disallowed) reason = `el dominio ${disallowed} no está autorizado`;
  }
  if (!reason && message.mentions.users.size + message.mentions.roles.size > Number(moderation.maxMentions || 5)) {
    reason = 'el mensaje contiene demasiadas menciones';
  }
  if (!reason && repeatedMessage(message, Number(moderation.repeatLimit || 4))) {
    reason = 'el mismo mensaje fue repetido demasiadas veces';
  }
  if (!reason) return false;
  await applyAutomaticAction(message, config, reason);
  return true;
}

async function history(guildId, userId, limit = 10) {
  return ModerationCase.find({ guildId, userId }).sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = { normalizeDomain, domainAllowed, repeatedMessage, createCase, handleMessage, history };
