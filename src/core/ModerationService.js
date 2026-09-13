const { PermissionFlagsBits } = require('discord.js');
const ModerationCase = require('../database/models/ModerationCase');
const { getGuildConfig } = require('../database/mongoManager');
const { isModuleEnabledConfig } = require('../config/guildPolicy');
const { buildMessage, memberVars } = require('./EmbedCatalog');
const mongoose = require('mongoose');

const repeats = new Map();
const URL_PATTERN = /https?:\/\/[^\s<]+/gi;
const INVITE_PATTERN = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/[\w-]+/i;
const REPEAT_WINDOW_MS = 30_000;
const REPEAT_STATE_TTL_MS = 5 * 60_000;
let lastRepeatCleanup = 0;

function normalizeDomain(rawUrl) {
  try { return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return null; }
}

function normalizeAllowedDomain(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

function domainAllowed(domain, allowedDomains = []) {
  return allowedDomains.some(item => domain === item || domain.endsWith(`.${item}`));
}

function repeatedMessage(message, limit) {
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const content = message.content.trim().toLowerCase();
  if (now - lastRepeatCleanup > REPEAT_STATE_TTL_MS) {
    for (const [storedKey, stored] of repeats) {
      if (now - Number(stored.lastSeen || 0) > REPEAT_STATE_TTL_MS) repeats.delete(storedKey);
    }
    lastRepeatCleanup = now;
  }
  const state = repeats.get(key) || { content: null, times: [], lastSeen: now };
  state.times = state.content === content ? state.times.filter(time => now - time < REPEAT_WINDOW_MS) : [];
  state.content = content;
  state.times.push(now);
  state.lastSeen = now;
  repeats.set(key, state);
  return content.length >= 3 && state.times.length >= limit;
}

async function createCase({ guildId, userId, moderatorId, action, reason, evidence = null, expiresAt = null }) {
  return ModerationCase.create({ guildId, userId, moderatorId, action, reason, evidence, expiresAt });
}

function caseIdentifier(record) {
  return record?.caseId || String(record?._id || '').toUpperCase();
}

function isExempt(message, config) {
  const moderation = config?.moderation || {};
  const channels = new Set((moderation.exemptChannels || []).map(String));
  if (channels.has(String(message.channelId)) || channels.has(String(message.channel?.parentId || ''))) return true;
  const roles = new Set((moderation.exemptRoles || []).map(String));
  return message.member?.roles?.cache?.some?.(role => roles.has(String(role.id))) === true;
}

async function getCase(guildId, identifier) {
  const normalized = String(identifier || '').trim().toUpperCase();
  if (!normalized) return null;
  const filters = [{ caseId: normalized }];
  if (mongoose.isValidObjectId(identifier)) {
    filters.push({ _id: mongoose.Types.ObjectId.createFromHexString(String(identifier)) });
  }
  const raw = await ModerationCase.collection.findOne({ guildId, $or: filters });
  if (!raw) return null;

  const missing = {};
  if (!raw.caseId) missing.caseId = ModerationCase.createCaseId();
  if (!raw.status) missing.status = raw.active === false ? 'resolved' : 'active';
  if (!Array.isArray(raw.notes)) missing.notes = [];
  if (Object.keys(missing).length) {
    await ModerationCase.collection.updateOne({ _id: raw._id }, { $set: missing });
  }
  return ModerationCase.findById(raw._id);
}

async function transitionCase(guildId, identifier, status, moderatorId, note) {
  const record = await getCase(guildId, identifier);
  if (!record) return null;
  record.status = status;
  record.active = status === 'active';
  record.resolvedAt = status === 'active' ? null : new Date();
  record.resolvedBy = status === 'active' ? null : moderatorId;
  if (!record.notes) record.notes = [];
  if (note?.trim()) record.notes.push({ moderatorId, text: note.trim().slice(0, 1000) });
  await record.save();
  return record;
}

async function addCaseNote(guildId, identifier, moderatorId, text) {
  const record = await getCase(guildId, identifier);
  if (!record) return null;
  if (!record.notes) record.notes = [];
  record.notes.push({ moderatorId, text: String(text || '').trim().slice(0, 1000) });
  await record.save();
  return record;
}

async function applyAutomaticAction(message, config, reason) {
  await message.delete().catch(() => null);
  const moderation = config.moderation || {};
  let action = moderation.action === 'warn' ? 'warning' : 'filter';
  let expiresAt = null;
  if (moderation.action === 'timeout' && message.member?.moderatable) {
    expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await message.member.timeout(5 * 60 * 1000, reason).catch(() => null);
    action = 'timeout';
  }
  const record = await createCase({
    guildId: message.guild.id,
    userId: message.author.id,
    moderatorId: message.client.user.id,
    action,
    reason,
    evidence: message.content.slice(0, 1000),
    expiresAt
  });
  const vars = memberVars(message.member || { user: message.author, guild: message.guild }, {
    reason,
    case: caseIdentifier(record)
  });

  if (action === 'warning') {
    const dm = buildMessage('automod_dm', {
      config,
      vars,
      defaults: { message: 'Recibiste una advertencia en **{server}**.\nMotivo: {reason}\nCaso: **#{case}**' }
    });
    await message.author.send({ content: dm.content, allowedMentions: { parse: [] } }).catch(() => null);
  }

  const publicNotice = buildMessage('automod_notice', {
    config,
    vars,
    defaults: { message: '{user}, tu mensaje fue retirado: {reason}. Caso **#{case}**.' }
  });
  const notice = await message.channel.send({
    content: publicNotice.content,
    allowedMentions: { users: [message.author.id], roles: [], parse: [] }
  }).catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => null), 10_000);
}

async function handleMessage(message) {
  if (!message.guild || message.author.bot || !message.content) return false;
  const config = await getGuildConfig(message.guild.id);
  if (!isModuleEnabledConfig(config, 'moderation')) return false;
  if (message.member?.permissions?.has(PermissionFlagsBits.ManageMessages)) return false;
  if (isExempt(message, config)) return false;

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

module.exports = {
  normalizeDomain,
  normalizeAllowedDomain,
  domainAllowed,
  repeatedMessage,
  isExempt,
  caseIdentifier,
  createCase,
  getCase,
  transitionCase,
  addCaseNote,
  handleMessage,
  history
};
