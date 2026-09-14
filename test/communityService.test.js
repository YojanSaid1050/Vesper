const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const { createDefaultGuildConfig, CURRENT_SCHEMA_VERSION } = require('../src/config/defaultGuild');
const { moduleDefaults } = require('../src/config/guildPolicy');
const { escapeHtml, qualifyingStarCount, renderTranscript, safeChannelName, ticketPanelPayload } = require('../src/core/CommunityService');

test('los módulos comunitarios son opt-in y la configuración nace completa', () => {
  const modules = moduleDefaults();
  const config = createDefaultGuildConfig('guild');
  assert.equal(CURRENT_SCHEMA_VERSION, 7);
  // El catálogo de mensajes nace vacío: sin plantillas guardadas, cada aviso
  // conserva el formato con el que se escribió.
  assert.deepEqual(config.embeds, {});
  assert.equal(modules.tickets, false);
  assert.equal(modules.suggestions, false);
  assert.equal(modules.selfroles, false);
  assert.equal(modules.starboard, false);
  assert.equal(config.community.tickets.maxOpenPerUser, 1);
  assert.equal(config.community.starboard.threshold, 3);
  assert.deepEqual(config.community.selfRoles.roles, []);
});

test('la transcripción escapa contenido y no permite inyectar scripts', () => {
  const message = {
    author: { tag: 'Usuario<script>' },
    cleanContent: '<script>alert("x")</script>',
    content: '<script>alert("x")</script>',
    createdTimestamp: Date.UTC(2026, 0, 1),
    attachments: new Map([['1', { url: 'https://cdn.example/a?x=<tag>', name: '<archivo>.png' }]])
  };
  const html = renderTranscript({ ticketId: 'ABC' }, 'Servidor', 'ticket', [message]);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /&lt;archivo&gt;\.png/);
  assert.equal(escapeHtml('a&b'), 'a&amp;b');
});

test('los identificadores visuales comunitarios son estables y los canales se normalizan', () => {
  const payload = ticketPanelPayload();
  assert.equal(payload.components[0].components[0].data.custom_id, 'community_ticket_open');
  assert.equal(safeChannelName('Ána Test !!'), 'ana-test');
  assert.ok(safeChannelName('x'.repeat(200)).length <= 70);
});

test('el starboard excluye al autor y a los bots del conteo', async () => {
  const users = new Collection([
    ['author', { id: 'author', bot: false }],
    ['human', { id: 'human', bot: false }],
    ['bot', { id: 'bot', bot: true }]
  ]);
  const count = await qualifyingStarCount({ users: { fetch: async () => users } }, 'author');
  assert.equal(count, 1);
});
