const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { isGlobalOwner, guildAccess } = require('../src/web/WebPermissionService');
const { sanitizeGuildPatch, ValidationError } = require('../src/web/configSanitizer');
const { hashToken, parseCookies, safeEqual } = require('../src/web/security');
const { actorCanTarget, publicCase, publicSuggestion } = require('../src/web/routes');

function cache(items) {
  const map = new Map(items.map(item => [item.id, item]));
  map.some = predicate => [...map.values()].some(predicate);
  return map;
}

function mockGuild(permissionList = [], memberRoles = []) {
  const textChannel = {
    id: '123456789012345678',
    name: 'general',
    isTextBased: () => true,
    isThread: () => false,
    permissionsFor: () => ({ has: () => true })
  };
  const role = { id: '223456789012345678', name: 'Moderador', managed: false, position: 1 };
  const member = {
    id: '444',
    permissions: { has: permission => permissionList.includes(permission) },
    roles: { cache: cache(memberRoles.map(id => ({ id }))), highest: { position: 10 } }
  };
  return {
    id: '323456789012345678',
    name: 'Embers Void',
    channels: { cache: cache([textChannel]) },
    roles: { cache: cache([role]) },
    members: {
      me: { permissions: { has: () => true }, roles: { highest: { position: 10 } } },
      // El panel lee primero la caché y solo llama a la API si falta el
      // miembro, para no gastar peticiones en cada carga.
      cache: cache([member]),
      fetch: async () => member
    }
  };
}

test('el propietario puede autenticarse por Discord o Google verificado', () => {
  const oldDiscord = process.env.BOT_OWNER_IDS;
  const oldGoogle = process.env.GOOGLE_OWNER_EMAILS;
  process.env.BOT_OWNER_IDS = '111';
  process.env.GOOGLE_OWNER_EMAILS = 'owner@example.com';
  assert.equal(isGlobalOwner({ discord: { id: '111' } }), true);
  assert.equal(isGlobalOwner({ google: { email: 'OWNER@example.com', verified: true } }), true);
  assert.equal(isGlobalOwner({ google: { email: 'owner@example.com', verified: false } }), false);
  if (oldDiscord === undefined) delete process.env.BOT_OWNER_IDS; else process.env.BOT_OWNER_IDS = oldDiscord;
  if (oldGoogle === undefined) delete process.env.GOOGLE_OWNER_EMAILS; else process.env.GOOGLE_OWNER_EMAILS = oldGoogle;
});

test('el panel vuelve a comprobar permisos y roles del servidor', async () => {
  const oldMain = process.env.MAIN_GUILD_ID;
  process.env.MAIN_GUILD_ID = '323456789012345678';
  const guild = mockGuild([PermissionFlagsBits.ModerateMembers], ['223456789012345678']);
  const client = { isReady: () => true, guilds: { cache: new Map([[guild.id, guild]]) } };
  const access = await guildAccess(client, guild.id, { discord: { id: '444' } }, {
    permissions: { moderatorRoles: ['223456789012345678'] }
  });
  assert.equal(access.visible, true);
  assert.equal(access.configure, false);
  assert.equal(access.moderate, true);
  if (oldMain === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = oldMain;
});

test('Google sin Discord puede configurar como propietario pero no sancionar', async () => {
  const oldMain = process.env.MAIN_GUILD_ID;
  const oldGoogle = process.env.GOOGLE_OWNER_EMAILS;
  process.env.MAIN_GUILD_ID = '323456789012345678';
  process.env.GOOGLE_OWNER_EMAILS = 'owner@example.com';
  const guild = mockGuild();
  guild.members.fetch = async () => null;
  const client = { isReady: () => true, guilds: { cache: new Map([[guild.id, guild]]) } };
  const access = await guildAccess(client, guild.id, { google: { email: 'owner@example.com', verified: true } }, {});
  assert.equal(access.configure, true);
  assert.equal(access.moderate, false);
  if (oldMain === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = oldMain;
  if (oldGoogle === undefined) delete process.env.GOOGLE_OWNER_EMAILS; else process.env.GOOGLE_OWNER_EMAILS = oldGoogle;
});

test('la moderación web respeta la jerarquía humana además de la del bot', () => {
  const access = {
    guild: { ownerId: 'owner' },
    member: { id: 'moderator', roles: { highest: { position: 5 } } }
  };
  const lower = { id: 'member', roles: { highest: { comparePositionTo: role => 2 - role.position } } };
  const higher = { id: 'admin', roles: { highest: { comparePositionTo: role => 8 - role.position } } };
  const owner = { id: 'owner', roles: { highest: { comparePositionTo: () => 1 } } };
  assert.equal(actorCanTarget(access, lower), true);
  assert.equal(actorCanTarget(access, higher), false);
  assert.equal(actorCanTarget(access, owner), false);
});

test('la API solo acepta campos de configuración conocidos y validados', () => {
  const guild = mockGuild();
  const result = sanitizeGuildPatch({
    features: { moderation: true, unknown: true },
    general: { welcomeChannel: '123456789012345678' },
    moderation: { maxMentions: 7, allowedDomains: ['https://www.youtube.com/watch?v=1'] },
    permissions: { moderatorRoles: ['223456789012345678'] },
    injected: { token: 'secret' }
  }, guild);
  assert.equal(result.features.moderation, true);
  assert.equal(result.features.unknown, undefined);
  assert.equal(result.general.welcomeChannel, '123456789012345678');
  assert.deepEqual(result.moderation.allowedDomains, ['youtube.com']);
  assert.deepEqual(result.permissions.moderatorRoles, ['223456789012345678']);
  assert.equal(result.injected, undefined);
  assert.throws(() => sanitizeGuildPatch({ moderation: { maxMentions: 500 } }, guild), ValidationError);
});

test('la API valida la configuración comunitaria del panel', () => {
  const guild = mockGuild();
  const result = sanitizeGuildPatch({
    features: { tickets: true, starboard: true },
    community: {
      tickets: { panelChannel: '123456789012345678', staffRoles: ['223456789012345678'], maxOpenPerUser: 2 },
      starboard: { channel: '123456789012345678', threshold: 4, emoji: '⭐' }
    }
  }, guild);
  assert.equal(result.features.tickets, true);
  assert.equal(result.community.tickets.maxOpenPerUser, 2);
  assert.deepEqual(result.community.tickets.staffRoles, ['223456789012345678']);
  assert.equal(result.community.starboard.threshold, 4);
  assert.throws(() => sanitizeGuildPatch({ community: { starboard: { threshold: 100 } } }, guild), ValidationError);
});

test('el panel configura identidad, voz y autorroles del Main temático sin escribir IDs manualmente', () => {
  const previousMain = process.env.MAIN_GUILD_ID;
  const previousThemed = process.env.THEMED_MAIN_GUILD_IDS;
  process.env.MAIN_GUILD_ID = '999999999999999999';
  process.env.THEMED_MAIN_GUILD_IDS = '323456789012345678';
  const guild = mockGuild();
  guild.channels.cache.set('423456789012345678', {
    id: '423456789012345678',
    name: 'Música',
    type: ChannelType.GuildVoice,
    permissionsFor: () => ({ has: () => true })
  });
  const result = sanitizeGuildPatch({
    profile: {
      theme: 'cinnamoroll',
      displayName: 'AnkeBot',
      primaryColor: '#8ddcf4',
      secondaryColor: '#f8c8dc',
      memberRole: '223456789012345678',
      welcomeMessage: 'Hola {user}, bienvenido a {server}'
    },
    music: { preferredVoiceChannel: '423456789012345678' },
    community: { selfRoles: { roles: ['223456789012345678'] } }
  }, guild);
  assert.equal(result.profile.displayName, 'AnkeBot');
  assert.equal(result.profile.primaryColor, '#8DDCF4');
  assert.equal(result.music.preferredVoiceChannel, '423456789012345678');
  assert.deepEqual(result.community.selfRoles.roles, [{ roleId: '223456789012345678', label: 'Moderador', emoji: null, description: null }]);
  if (previousMain === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = previousMain;
  if (previousThemed === undefined) delete process.env.THEMED_MAIN_GUILD_IDS; else process.env.THEMED_MAIN_GUILD_IDS = previousThemed;
});

test('las utilidades de sesión usan HMAC, cookies seguras y comparación constante', () => {
  const oldSecret = process.env.WEB_SESSION_SECRET;
  process.env.WEB_SESSION_SECRET = 'a'.repeat(64);
  assert.equal(hashToken('token'), hashToken('token'));
  assert.notEqual(hashToken('token'), hashToken('otro'));
  assert.deepEqual(parseCookies('a=1; vesper_session=abc%20123'), { a: '1', vesper_session: 'abc 123' });
  assert.equal(safeEqual('state', 'state'), true);
  assert.equal(safeEqual('state', 'other'), false);
  if (oldSecret === undefined) delete process.env.WEB_SESSION_SECRET; else process.env.WEB_SESSION_SECRET = oldSecret;
});

test('la interfaz web es autocontenida y compatible con su propia CSP', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/web/public/index.html'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '../src/web/public/app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../src/web/public/styles.css'), 'utf8');
  const routes = fs.readFileSync(path.join(__dirname, '../src/web/routes.js'), 'utf8');

  assert.match(html, /Vesper · Panel de control/);
  assert.match(html, /\/panel\/assets\/app\.js/);
  assert.match(html, /\/panel\/assets\/styles\.css/);

  // La CSP del panel es `default-src 'self'`: ni scripts, ni hojas de estilo,
  // ni tipografías externas.
  assert.doesNotMatch(html, /https?:\/\/[^"']+\.js/, 'no debe cargar scripts externos');
  assert.doesNotMatch(html, /<script>|<script [^>]*>[^<]/, 'no debe haber scripts en línea');
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/, 'no debe cargar tipografías externas');
  assert.doesNotMatch(styles, /@import\s+url\(['"]?https?:/, 'no debe importar CSS externo');

  // `style-src 'self'` también cubre los atributos style en línea, así que el
  // color dinámico tiene que aplicarse por CSSOM.
  assert.doesNotMatch(html, /\sstyle="/, 'no debe haber atributos style en el HTML');
  assert.doesNotMatch(script, /<[a-z][^>]*\sstyle="/i, 'el HTML generado no debe llevar atributos style');
  assert.match(script, /setProperty\('--accent'/, 'el acento debe aplicarse por CSSOM');

  // Piezas que el panel necesita para funcionar.
  for (const needle of ['publish-tickets', 'publish-selfroles', 'data-suggestion', 'data-embed-reset', 'refreshEmbedPreview', 'refreshIdentityPreview']) {
    assert.ok(script.includes(needle), `falta ${needle} en el cliente del panel`);
  }
  assert.match(routes, /community\/publish/);
  assert.match(routes, /suggestions\/:messageId/);

  // Todo lo que se interpola en el HTML pasa por escapeHtml.
  assert.match(script, /function escapeHtml/);
  assert.doesNotMatch(script, /innerHTML\s*=\s*[^`'"].*location/i);

  // El panel no usa los diálogos del navegador: muestran el dominio del
  // alojamiento y no se pueden estilar.
  const code = script.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
  for (const nativeDialog of ['confirm(', 'prompt(', 'alert(']) {
    const uses = code.split(nativeDialog).length - 1;
    const wrapped = code.split(`Dialog(`).length - 1;
    assert.ok(uses === 0 || wrapped > 0, `el panel no debe llamar a ${nativeDialog}`);
  }
  assert.match(script, /openDialog/, 'debe existir el diálogo propio');
  assert.match(html, /<dialog id="app-dialog"/, 'el diálogo propio debe estar en el HTML');
});

test('la raíz lleva al panel en el navegador y conserva el JSON para las sondas', async () => {
  const express = require('express');
  const { mountHealthRoutes, buildRuntimeHealth } = require('../src/web/health');

  const app = express();
  const runtimeHealth = buildRuntimeHealth({
    getClient: () => ({ isReady: () => true, uptime: 1, music: { status: () => ({ configured: false, connected: false }) } }),
    getMongoStatus: () => ({ connected: true, readyState: 1 }),
    getMonitorStats: () => [],
    isShuttingDown: () => false
  });
  mountHealthRoutes(app, { runtimeHealth, getClient: () => ({ isReady: () => true, uptime: 1 }), isShuttingDown: () => false });

  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;

  try {
    const browser = await fetch(`http://127.0.0.1:${port}/`, { headers: { Accept: 'text/html' }, redirect: 'manual' });
    assert.equal(browser.status, 302, 'un navegador debe ser redirigido');
    assert.equal(browser.headers.get('location'), '/panel');

    const probe = await fetch(`http://127.0.0.1:${port}/`, { headers: { Accept: 'application/json' } });
    assert.equal(probe.status, 200, 'un monitor que pida JSON debe seguir recibiéndolo');
    const body = await probe.json();
    assert.equal(body.status, 'online');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('la vista administrativa de sugerencias usa un contrato acotado', () => {
  const suggestion = publicSuggestion({
    messageId: '123', userId: '456', text: 'Más eventos', status: 'approved',
    reviewNote: 'Programado', reviewedBy: '789', createdAt: new Date(), updatedAt: new Date()
  });
  assert.deepEqual(Object.keys(suggestion), [
    'messageId', 'userId', 'text', 'status', 'reviewNote', 'reviewedBy', 'createdAt', 'updatedAt'
  ]);
  assert.equal(suggestion.status, 'approved');
  assert.equal(suggestion._id, undefined);
});

test('la vista de usuario oculta evidencia y notas internas', () => {
  const record = {
    _id: 'legacy', userId: 'user', moderatorId: 'mod', action: 'warning', reason: 'motivo',
    evidence: 'evidencia', notes: [{ moderatorId: 'mod', text: 'interna', createdAt: new Date() }],
    active: true, status: 'active', createdAt: new Date(), updatedAt: new Date(), resolvedBy: 'mod'
  };
  const memberView = publicCase(record, { includeInternal: false });
  const moderatorView = publicCase(record);
  assert.equal(memberView.notes, undefined);
  assert.equal(memberView.evidence, undefined);
  assert.equal(memberView.moderatorId, undefined);
  assert.equal(moderatorView.notes.length, 1);
});

test('el editor de embeds valida lo que llega del panel', () => {
  const previousMain = process.env.MAIN_GUILD_ID;
  process.env.MAIN_GUILD_ID = '323456789012345678';
  const guild = mockGuild();

  const result = sanitizeGuildPatch({
    embeds: {
      welcome: {
        title: '  # Hola {username}  ',
        message: 'Bienvenido a {server}',
        color: '#ff00aa',
        image: 'https://example.com/a.gif',
        thumbnail: false
      },
      goodbye: { title: null, color: null }
    }
  }, guild);

  assert.equal(result.embeds.welcome.title, '# Hola {username}');
  assert.equal(result.embeds.welcome.color, '#FF00AA', 'el color se normaliza a mayúsculas');
  assert.equal(result.embeds.welcome.image, 'https://example.com/a.gif');
  assert.equal(result.embeds.welcome.thumbnail, false);
  assert.equal(result.embeds.goodbye.title, null, 'null restablece el valor original');
  assert.equal(result.embeds.goodbye.color, null);

  assert.throws(() => sanitizeGuildPatch({ embeds: { welcome: { color: 'rojo' } } }, guild), ValidationError);
  assert.throws(() => sanitizeGuildPatch({ embeds: { welcome: { image: 'http://inseguro/a.gif' } } }, guild), ValidationError);
  assert.throws(() => sanitizeGuildPatch({ embeds: { welcome: { message: 'x'.repeat(3001) } } }, guild), ValidationError);
  assert.throws(() => sanitizeGuildPatch({ embeds: { welcome: { thumbnail: 'sí' } } }, guild), ValidationError);

  if (previousMain === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = previousMain;
});

test('la identidad se puede editar en ambos Main pero no en un satélite', () => {
  const previousMain = process.env.MAIN_GUILD_ID;
  const previousThemed = process.env.THEMED_MAIN_GUILD_IDS;
  const guild = mockGuild();

  // Main principal (Embers Void)
  process.env.MAIN_GUILD_ID = '323456789012345678';
  process.env.THEMED_MAIN_GUILD_IDS = '';
  const principal = sanitizeGuildPatch({ profile: { theme: 'void', displayName: 'Vesper' } }, guild);
  assert.equal(principal.profile.theme, 'void');
  assert.throws(() => sanitizeGuildPatch({ profile: { theme: 'cinnamoroll' } }, guild), ValidationError);

  // Main temático (Ankerie Dimension)
  process.env.MAIN_GUILD_ID = '999999999999999999';
  process.env.THEMED_MAIN_GUILD_IDS = '323456789012345678';
  const tematico = sanitizeGuildPatch({ profile: { theme: 'cinnamoroll', displayName: 'AnkeBot' } }, guild);
  assert.equal(tematico.profile.displayName, 'AnkeBot');

  // Satélite: sin identidad propia
  process.env.MAIN_GUILD_ID = '999999999999999999';
  process.env.THEMED_MAIN_GUILD_IDS = '';
  assert.throws(() => sanitizeGuildPatch({ profile: { displayName: 'Otro' } }, guild), ValidationError);

  if (previousMain === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = previousMain;
  if (previousThemed === undefined) delete process.env.THEMED_MAIN_GUILD_IDS; else process.env.THEMED_MAIN_GUILD_IDS = previousThemed;
});

/* ------------------------------------------------------------------ */
/* Formato del mensaje (embed clásico / contenedor V2)                 */
/* ------------------------------------------------------------------ */

test('el saneador acepta los dos formatos y el «el de siempre»', () => {
  const guild = mockGuild();
  for (const layout of ['classic', 'components_v2']) {
    const result = sanitizeGuildPatch({ embeds: { welcome: { layout } } }, guild);
    assert.equal(result.embeds.welcome.layout, layout);
  }
  for (const empty of [null, '', 'auto']) {
    const result = sanitizeGuildPatch({ embeds: { welcome: { layout: empty } } }, guild);
    assert.equal(result.embeds.welcome.layout, null);
  }
});

test('un formato inventado se rechaza', () => {
  assert.throws(
    () => sanitizeGuildPatch({ embeds: { welcome: { layout: 'bonito' } } }, mockGuild()),
    /layout no es válido/
  );
});

test('los mensajes de texto normal no admiten formato de embed', () => {
  assert.throws(
    () => sanitizeGuildPatch({ embeds: { automod_dm: { layout: 'components_v2' } } }, mockGuild()),
    /texto normal/
  );
});
