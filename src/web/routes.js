const path = require('path');
const express = require('express');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const ModerationCase = require('../database/models/ModerationCase');
const Suggestion = require('../database/models/Suggestion');
const WebAuditLog = require('../database/models/WebAuditLog');
const { getGuildConfig, updateGuildSection, updateCommunitySection, addGuildListItem, removeGuildListItem } = require('../database/mongoManager');
const { setupChecks } = require('../core/SetupService');
const { isModuleEnabledConfig, guildTier, isThemedMainGuild } = require('../config/guildPolicy');
const {
  createCase,
  getCase,
  transitionCase,
  addCaseNote,
  caseIdentifier
} = require('../core/ModerationService');
const {
  dashboardEnabled,
  sessionConfigured,
  baseUrl,
  hashToken,
  securityHeaders,
  createRateLimiter
} = require('./security');
const {
  beginOAuth,
  completeOAuth,
  unlinkProvider,
  logout,
  requireSession,
  requireCsrf
} = require('./WebSessionService');
const {
  discordConfigured,
  googleConfigured,
  discordAuthorizationUrl,
  exchangeDiscordCode,
  googleAuthorizationUrl,
  exchangeGoogleCode
} = require('./OAuthService');
const { isGlobalOwner, guildAccess, accessibleGuilds } = require('./WebPermissionService');
const { sanitizeGuildPatch } = require('./configSanitizer');
const { webAdminMode } = require('../core/CommandVisibilityService');
const { normalizeUsername } = require('../platforms/tiktok/utils');
const { verifyStreamer } = require('../platforms/twitch/utils');
const { verifyChannel } = require('../platforms/youtube/utils');
const { publishSelfRolePanel, publishTicketPanel, reviewSuggestion } = require('../core/CommunityService');

const publicDir = path.join(__dirname, 'public');
const authLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 20 });
const apiLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120 });

function identity(session) {
  return {
    discord: session.discord ? {
      id: session.discord.id,
      username: session.discord.username,
      globalName: session.discord.globalName,
      avatar: session.discord.avatar
    } : null,
    google: session.google ? {
      email: session.google.email,
      name: session.google.name,
      picture: session.google.picture,
      verified: session.google.verified
    } : null,
    globalOwner: isGlobalOwner(session)
  };
}

function publicCase(record, { includeInternal = true } = {}) {
  const result = {
    id: caseIdentifier(record),
    userId: record.userId,
    action: record.action,
    reason: record.reason,
    expiresAt: record.expiresAt || null,
    status: record.status || (record.active ? 'active' : 'resolved'),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    resolvedAt: record.resolvedAt || null
  };
  if (includeInternal) {
    result.moderatorId = record.moderatorId;
    result.evidence = record.evidence || null;
    result.notes = (record.notes || []).map(note => ({
      moderatorId: note.moderatorId,
      text: note.text,
      createdAt: note.createdAt
    }));
    result.resolvedBy = record.resolvedBy || null;
  }
  return result;
}

function publicSuggestion(record) {
  return {
    messageId: record.messageId,
    userId: record.userId,
    text: record.text,
    status: record.status || 'open',
    reviewNote: record.reviewNote || null,
    reviewedBy: record.reviewedBy || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function serializedConfig(config) {
  return {
    general: config.general || {},
    tiktok: { ...(config.tiktok || {}), users: config.tiktok?.users || [] },
    twitch: { ...(config.twitch || {}), users: config.twitch?.users || [] },
    youtube: { ...(config.youtube || {}), users: config.youtube?.users || [] },
    branding: config.branding || {},
    profile: config.profile || {},
    features: config.features || {},
    permissions: config.permissions || {},
    moderation: config.moderation || {},
    music: config.music || {},
    community: config.community || {}
  };
}

function actorId(session) {
  return session.discord?.id || null;
}

async function resolveSocialAccount(platform, input) {
  const raw = String(input || '').trim();
  if (!raw || raw.length > 200) throw Object.assign(new Error('La cuenta indicada no es válida.'), { statusCode: 400 });
  if (platform === 'tiktok') {
    const username = normalizeUsername(raw);
    if (!/^[A-Za-z0-9._]{2,32}$/.test(username)) throw Object.assign(new Error('El usuario de TikTok no es válido.'), { statusCode: 400 });
    const { verifyUserExists } = require('../platforms/tiktok/checks');
    const exists = await Promise.race([
      verifyUserExists(username),
      new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('TikTok tardó demasiado en responder.'), { statusCode: 504 })), 45_000))
    ]);
    if (exists !== true) throw Object.assign(new Error(`No encontré @${username} en TikTok.`), { statusCode: 404 });
    return { id: username, label: `@${username}` };
  }
  if (platform === 'twitch') {
    const streamer = await verifyStreamer(raw.toLowerCase());
    if (!streamer.exists) throw Object.assign(new Error(`No encontré ${raw} en Twitch.`), { statusCode: 404 });
    return { id: streamer.login, label: streamer.name || streamer.login };
  }
  if (platform === 'youtube') {
    const channel = await verifyChannel(raw);
    if (!channel.exists) throw Object.assign(new Error(`No encontré ${raw} en YouTube.`), { statusCode: 404 });
    return { id: channel.id, label: channel.name || channel.id };
  }
  throw Object.assign(new Error('Plataforma no compatible.'), { statusCode: 400 });
}

function actorCanTarget(access, target) {
  if (!access?.member || !target) return false;
  if (target.id === access.guild.ownerId) return false;
  if (access.member.id === access.guild.ownerId) return true;
  return target.roles.highest.comparePositionTo(access.member.roles.highest) < 0;
}

async function recordAudit(req, guildId, action, target = null, metadata = {}) {
  const configuredDays = Number(process.env.WEB_AUDIT_DAYS || 180);
  const days = Number.isFinite(configuredDays) ? Math.min(365, Math.max(7, configuredDays)) : 180;
  await WebAuditLog.create({
    guildId,
    actorDiscordId: req.webSession.discord?.id || null,
    actorGoogleEmail: req.webSession.google?.email || null,
    action,
    target,
    metadata,
    ipHash: hashToken(req.ip || req.socket?.remoteAddress || 'unknown'),
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  });
}

function oauthErrorRedirect(provider, error) {
  const message = encodeURIComponent(String(error.message || 'No se pudo iniciar sesión').slice(0, 180));
  let root = '/panel';
  try { root = `${baseUrl()}/panel`; } catch {}
  return `${root}?auth_error=${encodeURIComponent(provider)}&message=${message}`;
}

function requireDashboard(req, res, next) {
  if (!dashboardEnabled()) return res.status(503).json({ error: 'El panel web está desactivado.' });
  if (!sessionConfigured()) return res.status(503).json({ error: 'El panel web todavía no tiene una clave de sesión válida.' });
  return next();
}

function getClientOr503(getClient, res) {
  const client = getClient();
  if (!client?.isReady?.()) {
    res.status(503).json({ error: 'Vesper todavía no está conectado a Discord.' });
    return null;
  }
  return client;
}

async function accessFor(req, res, getClient) {
  const client = getClientOr503(getClient, res);
  if (!client) return null;
  const config = await getGuildConfig(req.params.guildId);
  const access = await guildAccess(client, req.params.guildId, req.webSession, config);
  if (!access) {
    res.status(404).json({ error: 'Servidor no disponible.' });
    return null;
  }
  return { client, config, access };
}

function mountWebDashboard(app, { getClient, runtimeHealth }) {
  const proxyValue = String(process.env.WEB_TRUST_PROXY ?? '1').trim().toLowerCase();
  const trustProxy = proxyValue === 'false' || proxyValue === '0' ? false : proxyValue === 'true' ? 1 : Number(proxyValue);
  app.set('trust proxy', Number.isNaN(trustProxy) ? 1 : trustProxy);
  app.use(securityHeaders);
  app.use('/panel/assets', express.static(publicDir, { maxAge: '1h', index: false, dotfiles: 'deny' }));
  app.get('/panel', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

  app.get('/api/web/public', (req, res) => res.json({
    enabled: dashboardEnabled(),
    ready: dashboardEnabled() && sessionConfigured(),
    discordEnabled: dashboardEnabled() && sessionConfigured() && discordConfigured(),
    googleEnabled: dashboardEnabled() && sessionConfigured() && googleConfigured(),
    webAdminMode: webAdminMode(),
    version: '2.8.0'
  }));

  app.get('/auth/discord', authLimiter, requireDashboard, async (req, res, next) => {
    try {
      if (!discordConfigured()) return res.status(503).send('OAuth de Discord no está configurado.');
      const state = await beginOAuth(req, res, 'discord');
      return res.redirect(discordAuthorizationUrl(state));
    } catch (error) { return next(error); }
  });

  app.get('/auth/discord/callback', authLimiter, requireDashboard, async (req, res) => {
    try {
      if (!req.query.code || !req.query.state) throw Object.assign(new Error('Discord no devolvió un código válido.'), { statusCode: 400 });
      const user = await exchangeDiscordCode(String(req.query.code));
      await completeOAuth(req, res, 'discord', String(req.query.state), user);
      return res.redirect('/panel');
    } catch (error) { return res.redirect(oauthErrorRedirect('discord', error)); }
  });

  app.get('/auth/google', authLimiter, requireDashboard, async (req, res, next) => {
    try {
      if (!googleConfigured()) return res.status(503).send('OAuth de Google no está configurado.');
      const state = await beginOAuth(req, res, 'google');
      return res.redirect(googleAuthorizationUrl(state));
    } catch (error) { return next(error); }
  });

  app.get('/auth/google/callback', authLimiter, requireDashboard, async (req, res) => {
    try {
      if (!req.query.code || !req.query.state) throw Object.assign(new Error('Google no devolvió un código válido.'), { statusCode: 400 });
      const user = await exchangeGoogleCode(String(req.query.code));
      await completeOAuth(req, res, 'google', String(req.query.state), user);
      return res.redirect('/panel');
    } catch (error) { return res.redirect(oauthErrorRedirect('google', error)); }
  });

  const api = express.Router();
  api.use(apiLimiter, requireDashboard, express.json({ limit: '32kb', strict: true }));
  api.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  api.get('/session', requireSession, (req, res) => res.json({
    user: identity(req.webSession),
    csrfToken: req.webSession.csrfToken,
    expiresAt: req.webSession.expiresAt
  }));
  api.post('/logout', requireSession, requireCsrf, async (req, res, next) => {
    try {
      await logout(req, res);
      return res.status(204).end();
    } catch (error) { return next(error); }
  });
  api.post('/unlink', requireSession, requireCsrf, async (req, res, next) => {
    try {
      const session = await unlinkProvider(req.webSession, String(req.body.provider || ''));
      return res.json({ user: identity(session), csrfToken: session.csrfToken, expiresAt: session.expiresAt });
    } catch (error) { return next(error); }
  });

  api.get('/status', requireSession, (req, res) => res.json(runtimeHealth()));
  api.get('/guilds', requireSession, async (req, res, next) => {
    try {
      const client = getClientOr503(getClient, res);
      if (!client) return;
      return res.json({ guilds: await accessibleGuilds(client, req.webSession, getGuildConfig) });
    } catch (error) { return next(error); }
  });

  api.get('/guilds/:guildId', requireSession, async (req, res, next) => {
    try {
      const context = await accessFor(req, res, getClient);
      if (!context) return;
      const { config, access, client } = context;
      let cases = [];
      let suggestions = [];
      if (access.moderate) {
        cases = await ModerationCase.find({ guildId: req.params.guildId }).sort({ createdAt: -1 }).limit(25).lean();
      } else if (access.viewOwnCases) {
        cases = await ModerationCase.find({ guildId: req.params.guildId, userId: req.webSession.discord.id }).sort({ createdAt: -1 }).limit(25).lean();
      }
      if (access.configure) {
        suggestions = await Suggestion.find({ guildId: req.params.guildId }).sort({ createdAt: -1 }).limit(25).lean();
      }
      const availableChannels = access.configure ? [...access.guild.channels.cache.values()] : [];
      const channels = availableChannels
        .filter(channel => channel.isTextBased() && !channel.isThread?.())
        .map(channel => ({ id: channel.id, name: channel.name, parent: channel.parent?.name || null }))
        .sort((a, b) => (a.parent || '').localeCompare(b.parent || '', 'es') || a.name.localeCompare(b.name, 'es'));
      const voiceChannels = availableChannels
        .filter(channel => [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type))
        .map(channel => ({ id: channel.id, name: channel.name, parent: channel.parent?.name || null }))
        .sort((a, b) => (a.parent || '').localeCompare(b.parent || '', 'es') || a.name.localeCompare(b.name, 'es'));
      const categories = availableChannels
        .filter(channel => channel.type === ChannelType.GuildCategory)
        .map(channel => ({ id: channel.id, name: channel.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));
      const roles = access.configure ? [...access.guild.roles.cache.values()]
        .filter(role => role.id !== access.guild.id && !role.managed)
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.hexColor,
          assignable: Boolean(access.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles) && role.position < access.guild.members.me.roles.highest.position)
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')) : [];
      return res.json({
        guild: {
          id: access.guild.id,
          name: access.guild.name,
          icon: access.guild.iconURL({ extension: 'png', size: 128 }),
          memberCount: access.guild.memberCount,
          tier: guildTier(access.guild.id)
        },
        permissions: {
          configure: access.configure,
          moderate: access.moderate,
          social: access.social,
          music: access.music,
          viewOwnCases: access.viewOwnCases
        },
        health: runtimeHealth(),
        setup: setupChecks(config),
        modules: { moderation: isModuleEnabledConfig(config, 'moderation') },
        config: access.configure ? serializedConfig(config) : null,
        channels,
        voiceChannels,
        categories,
        roles,
        assignableRoles: roles.filter(role => role.assignable),
        cases: cases.map(record => publicCase(record, { includeInternal: access.moderate })),
        suggestions: suggestions.map(publicSuggestion),
        bot: { username: client.user.username, avatar: client.user.displayAvatarURL({ extension: 'png', size: 128 }) }
      });
    } catch (error) { return next(error); }
  });

  api.patch('/guilds/:guildId/config', requireSession, requireCsrf, async (req, res, next) => {
    try {
      const context = await accessFor(req, res, getClient);
      if (!context) return;
      if (!context.access.configure) return res.status(403).json({ error: 'Necesitas Administrar servidor para cambiar la configuración.' });
      const updates = sanitizeGuildPatch(req.body, context.access.guild);
      for (const [section, values] of Object.entries(updates)) {
        if (section === 'community') {
          for (const [subsection, fields] of Object.entries(values)) await updateCommunitySection(req.params.guildId, subsection, fields);
        } else await updateGuildSection(req.params.guildId, section, values);
      }
      let nicknameWarning = null;
      if (isThemedMainGuild(req.params.guildId) && updates.profile?.displayName !== undefined) {
        await context.access.guild.members.me?.setNickname(updates.profile.displayName || null, 'Perfil actualizado desde el panel web')
          .catch(error => { nicknameWarning = `La configuración se guardó, pero no pude actualizar el apodo: ${error.message}`; });
      }
      if (updates.features?.music === false) await context.client.music?.stop?.(req.params.guildId).catch(() => null);
      await recordAudit(req, req.params.guildId, 'config.update', null, {
        fields: Object.entries(updates).flatMap(([section, values]) => section === 'community'
          ? Object.entries(values).flatMap(([subsection, fields]) => Object.keys(fields).map(key => `${section}.${subsection}.${key}`))
          : Object.keys(values).map(key => `${section}.${key}`))
      });
      const config = await getGuildConfig(req.params.guildId);
      return res.json({ ok: true, config: serializedConfig(config), setup: setupChecks(config), warning: nicknameWarning });
    } catch (error) { return next(error); }
  });

  api.post('/guilds/:guildId/social/:platform', requireSession, requireCsrf, async (req, res, next) => {
    try {
      const context = await accessFor(req, res, getClient);
      if (!context) return;
      if (!context.access.social || !actorId(req.webSession)) {
        return res.status(403).json({ error: 'Vincula Discord y verifica tu permiso de gestión de redes.' });
      }
      const platform = String(req.params.platform || '').toLowerCase();
      const account = await resolveSocialAccount(platform, req.body.account);
      const current = context.config[platform]?.users || [];
      if (current.includes(account.id)) return res.status(409).json({ error: `${account.label} ya está siendo monitoreado.` });
      const updated = await addGuildListItem(req.params.guildId, platform, 'users', account.id);
      await recordAudit(req, req.params.guildId, 'social.add', `${platform}:${account.id}`);
      return res.status(201).json({ ok: true, account, users: updated[platform]?.users || [] });
    } catch (error) { return next(error); }
  });

  api.delete('/guilds/:guildId/social/:platform/:account', requireSession, requireCsrf, async (req, res, next) => {
    try {
      const context = await accessFor(req, res, getClient);
      if (!context) return;
      if (!context.access.social || !actorId(req.webSession)) {
        return res.status(403).json({ error: 'Vincula Discord y verifica tu permiso de gestión de redes.' });
      }
      const platform = String(req.params.platform || '').toLowerCase();
      if (!['tiktok', 'twitch', 'youtube'].includes(platform)) return res.status(400).json({ error: 'Plataforma no compatible.' });
      const account = String(req.params.account || '').trim();
      if (!(context.config[platform]?.users || []).includes(account)) return res.status(404).json({ error: 'La cuenta ya no está en la lista.' });
      const updated = await removeGuildListItem(req.params.guildId, platform, 'users', account);
      await recordAudit(req, req.params.guildId, 'social.remove', `${platform}:${account}`);
      return res.json({ ok: true, users: updated?.[platform]?.users || [] });
    } catch (error) { return next(error); }
  });

  api.post('/guilds/:guildId/community/publish', requireSession, requireCsrf, async (req, res, next) => {
    try {
      const context = await accessFor(req, res, getClient);
      if (!context) return;
      if (!context.access.configure) return res.status(403).json({ error: 'Necesitas Administrar servidor para publicar paneles.' });
      const kind = String(req.body.kind || '').toLowerCase();
      if (!['tickets', 'selfroles'].includes(kind)) return res.status(400).json({ error: 'Tipo de panel no compatible.' });
      const settings = kind === 'tickets'
        ? context.config.community?.tickets
        : context.config.community?.selfRoles;
      const channelId = settings?.panelChannel;
      const channel = channelId && (context.access.guild.channels.cache.get(channelId)
        || await context.access.guild.channels.fetch(channelId).catch(() => null));
      if (!channel) return res.status(409).json({ error: 'Guarda primero el canal donde se publicará el panel.' });
      let message;
      try {
        message = kind === 'tickets'
          ? await publishTicketPanel(context.access.guild, channel)
          : await publishSelfRolePanel(context.access.guild, channel, settings?.roles || []);
      } catch (error) {
        if (!error.statusCode) error.statusCode = 409;
        throw error;
      }
      const subsection = kind === 'tickets' ? 'tickets' : 'selfRoles';
      await updateCommunitySection(req.params.guildId, subsection, { panelChannel: channel.id, panelMessage: message.id });
      await recordAudit(req, req.params.guildId, `community.${kind}.publish`, message.id, { channelId: channel.id });
      return res.status(201).json({ ok: true, messageId: message.id, channelId: channel.id });
    } catch (error) { return next(error); }
  });

  api.patch('/guilds/:guildId/suggestions/:messageId', requireSession, requireCsrf, async (req, res, next) => {
    try {
      const context = await accessFor(req, res, getClient);
      if (!context) return;
      if (!context.access.configure) return res.status(403).json({ error: 'Necesitas Administrar servidor para revisar sugerencias.' });
      const status = String(req.body.status || '');
      if (!['open', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Estado de sugerencia no válido.' });
      const note = req.body.note === undefined ? null : String(req.body.note || '').trim().slice(0, 500);
      const reviewer = actorId(req.webSession) || `google:${req.webSession.google?.email || 'owner'}`;
      const suggestion = await reviewSuggestion(context.access.guild, String(req.params.messageId), status, reviewer, note);
      await recordAudit(req, req.params.guildId, `suggestion.${status}`, suggestion.messageId, { hasNote: Boolean(note) });
      return res.json({ ok: true, suggestion: publicSuggestion(suggestion) });
    } catch (error) { return next(error); }
  });

  api.get('/guilds/:guildId/cases', requireSession, async (req, res, next) => {
    try {
      const context = await accessFor(req, res, getClient);
      if (!context) return;
      const filter = { guildId: req.params.guildId };
      if (!context.access.moderate) {
        if (!context.access.viewOwnCases) return res.status(403).json({ error: 'No tienes acceso a estos casos.' });
        filter.userId = req.webSession.discord.id;
      } else if (req.query.userId) filter.userId = String(req.query.userId);
      if (req.query.status && ['active', 'resolved', 'revoked'].includes(req.query.status)) filter.status = req.query.status;
      const requestedLimit = Number(req.query.limit || 50);
      const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 50;
      const cases = await ModerationCase.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
      return res.json({ cases: cases.map(record => publicCase(record, { includeInternal: context.access.moderate })) });
    } catch (error) { return next(error); }
  });

  api.get('/guilds/:guildId/members', requireSession, async (req, res, next) => {
    try {
      const context = await accessFor(req, res, getClient);
      if (!context) return;
      if (!context.access.moderate || !actorId(req.webSession)) {
        return res.status(403).json({ error: 'Vincula Discord y verifica tu permiso de moderación.' });
      }
      const query = String(req.query.q || '').trim().slice(0, 100);
      if (query.length < 2) return res.json({ members: [] });
      let members;
      if (/^\d{16,22}$/.test(query)) {
        const member = await context.access.guild.members.fetch(query).catch(() => null);
        members = member ? [member] : [];
      } else {
        members = [...(await context.access.guild.members.search({ query, limit: 20 })).values()];
      }
      return res.json({ members: members
        .filter(member => !member.user.bot && member.id !== context.client.user.id)
        .map(member => ({
          id: member.id,
          username: member.user.username,
          displayName: member.displayName,
          avatar: member.displayAvatarURL({ extension: 'png', size: 64 })
        })) });
    } catch (error) { return next(error); }
  });

  api.post('/guilds/:guildId/cases', requireSession, requireCsrf, async (req, res, next) => {
    try {
      const context = await accessFor(req, res, getClient);
      if (!context) return;
      if (!context.access.moderate || !actorId(req.webSession)) return res.status(403).json({ error: 'Vincula Discord y verifica tu permiso de moderación.' });
      if (!isModuleEnabledConfig(context.config, 'moderation')) return res.status(409).json({ error: 'El módulo de moderación está desactivado.' });
      const action = String(req.body.action || '');
      const userId = String(req.body.userId || '').trim();
      const reason = String(req.body.reason || '').trim().slice(0, 1000);
      if (!['warning', 'timeout'].includes(action) || !/^\d{16,22}$/.test(userId) || !reason) return res.status(400).json({ error: 'Acción, usuario o motivo no válidos.' });
      if (userId === req.webSession.discord.id || userId === context.client.user.id) return res.status(400).json({ error: 'No puedes sancionarte a ti mismo ni sancionar a Vesper.' });
      const member = await context.access.guild.members.fetch(userId).catch(() => null);
      if (!member || member.user.bot) return res.status(400).json({ error: 'El usuario no es un miembro sancionable de este servidor.' });
      if (!actorCanTarget(context.access, member)) return res.status(403).json({ error: 'La jerarquía de roles no te permite actuar sobre ese miembro.' });
      let expiresAt = null;
      if (action === 'timeout') {
        const minutes = Math.min(40320, Math.max(1, Number(req.body.minutes || 0)));
        if (!Number.isInteger(minutes) || !member.moderatable) return res.status(400).json({ error: 'Duración inválida o jerarquía insuficiente para aislar al miembro.' });
        await member.timeout(minutes * 60 * 1000, `${reason} · Panel web · ${req.webSession.discord.id}`);
        expiresAt = new Date(Date.now() + minutes * 60 * 1000);
      }
      const record = await createCase({
        guildId: req.params.guildId,
        userId,
        moderatorId: req.webSession.discord.id,
        action,
        reason,
        expiresAt
      });
      if (action === 'warning') {
        await member.send({
          content: `Recibiste una advertencia en **${context.access.guild.name}**.\nMotivo: ${reason}\nCaso: **#${caseIdentifier(record)}**`,
          allowedMentions: { parse: [] }
        }).catch(() => null);
      }
      await recordAudit(req, req.params.guildId, `case.${action}`, caseIdentifier(record), { userId, expiresAt });
      return res.status(201).json({ ok: true, case: publicCase(record) });
    } catch (error) { return next(error); }
  });

  api.patch('/guilds/:guildId/cases/:caseId', requireSession, requireCsrf, async (req, res, next) => {
    try {
      const context = await accessFor(req, res, getClient);
      if (!context) return;
      if (!context.access.moderate || !actorId(req.webSession)) return res.status(403).json({ error: 'Vincula Discord y verifica tu permiso de moderación.' });
      const identifier = String(req.params.caseId).toUpperCase();
      const current = await getCase(req.params.guildId, identifier);
      if (!current) return res.status(404).json({ error: 'No encontré ese caso.' });
      const status = req.body.status;
      const note = req.body.note === undefined ? null : String(req.body.note || '').trim().slice(0, 1000);
      if (!status && !note) return res.status(400).json({ error: 'Indica un nuevo estado o una nota.' });
      if (status && !['active', 'resolved', 'revoked'].includes(status)) return res.status(400).json({ error: 'El estado indicado no es válido.' });
      if (status === 'revoked' && current.action === 'timeout') {
        const member = await context.access.guild.members.fetch(current.userId).catch(() => null);
        if (member?.communicationDisabledUntilTimestamp) {
          if (!member.moderatable) return res.status(409).json({ error: 'La jerarquía impide retirar el aislamiento; el caso no fue revocado.' });
          await member.timeout(null, `Caso #${caseIdentifier(current)} revocado desde el panel web`);
        }
      }
      let record = current;
      if (status) record = await transitionCase(req.params.guildId, identifier, status, req.webSession.discord.id, note);
      else record = await addCaseNote(req.params.guildId, identifier, req.webSession.discord.id, note);
      await recordAudit(req, req.params.guildId, status ? `case.${status}` : 'case.note', identifier, { hasNote: Boolean(note) });
      return res.json({ ok: true, case: publicCase(record) });
    } catch (error) { return next(error); }
  });

  api.get('/guilds/:guildId/audit', requireSession, async (req, res, next) => {
    try {
      const context = await accessFor(req, res, getClient);
      if (!context) return;
      if (!context.access.configure) return res.status(403).json({ error: 'No tienes acceso a la auditoría web.' });
      const rows = await WebAuditLog.find({ guildId: req.params.guildId }).sort({ createdAt: -1 }).limit(100).lean();
      const showOwnerEmail = isGlobalOwner(req.webSession);
      return res.json({ audit: rows.map(row => ({
        id: String(row._id),
        actorDiscordId: row.actorDiscordId,
        actorGoogleEmail: showOwnerEmail ? row.actorGoogleEmail : row.actorGoogleEmail ? 'Cuenta Google del propietario' : null,
        action: row.action,
        target: row.target,
        metadata: row.metadata,
        createdAt: row.createdAt
      })) });
    } catch (error) { return next(error); }
  });

  app.use('/api/web', api);
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const candidateStatus = Number(error.statusCode || error.status || 500);
    const status = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599 ? candidateStatus : 500;
    if (status >= 500) console.error('❌ Error en panel web:', error);
    return res.status(status).json({ error: status >= 500 ? 'Ocurrió un error interno en el panel.' : error.message });
  });
}

module.exports = { mountWebDashboard, publicCase, publicSuggestion, serializedConfig, identity, actorCanTarget };
