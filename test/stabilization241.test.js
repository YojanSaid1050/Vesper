const test = require('node:test');
const assert = require('node:assert/strict');
const { Events } = require('discord.js');
const { requiredModuleForEvent } = require('../src/core/EventPolicy');
const { CAPABILITIES, canWithGuildConfig } = require('../src/core/PermissionService');
const { inferredCapability, COLLECTOR_ONLY_COMPONENT_IDS } = require('../src/events/interactionCreate');
const { MusicService } = require('../src/core/MusicService');
const { findRecentAuditEntry } = require('../src/utils/auditLog');
const { createDefaultGuildConfig, CURRENT_SCHEMA_VERSION } = require('../src/config/defaultGuild');

function interactionWithRoles(roles) {
  return {
    guildId: 'satellite',
    guild: { id: 'satellite' },
    user: { id: 'user' },
    inGuild: () => true,
    memberPermissions: { has: () => false },
    member: { roles: { cache: { some: predicate => roles.some(id => predicate({ id })) } } }
  };
}

test('los eventos de auditoría dependen del módulo logs', () => {
  assert.equal(requiredModuleForEvent(Events.MessageDelete), 'logs');
  assert.equal(requiredModuleForEvent(Events.ChannelCreate), 'logs');
  assert.equal(requiredModuleForEvent(Events.MessageCreate), null);
});

test('la autorización reconoce roles configurados por servidor', async () => {
  const interaction = interactionWithRoles(['social-role', 'dj-role']);
  assert.equal(await canWithGuildConfig(interaction, CAPABILITIES.SOCIAL_MANAGE, {
    permissions: { socialManagerRoles: ['social-role'] }
  }), true);
  assert.equal(await canWithGuildConfig(interaction, CAPABILITIES.MUSIC_DJ, {
    permissions: { musicDjRoles: ['dj-role'] }
  }), true);
});

test('los comandos sensibles reciben una capacidad interna', () => {
  assert.equal(inferredCapability('resetalldb'), CAPABILITIES.GLOBAL_OWNER);
  assert.equal(inferredCapability('resetconfig'), CAPABILITIES.GUILD_ADMIN);
  assert.equal(inferredCapability('twitch-add'), CAPABILITIES.SOCIAL_MANAGE);
  assert.equal(inferredCapability('clear'), CAPABILITIES.MODERATE);
});

test('los botones de collectors no pasan al router del dashboard', () => {
  assert.equal(COLLECTOR_ONLY_COMPONENT_IDS.has('twitch_clear_confirm'), true);
  assert.equal(COLLECTOR_ONLY_COMPONENT_IDS.has('confirm_reset_config'), true);
  assert.equal(COLLECTOR_ONLY_COMPONENT_IDS.has('dashboard_home'), false);
});

test('la música ya no depende de ningún servidor externo', () => {
  // Antes esto comprobaba el backoff de reconexión con Lavalink. Ya no hay
  // nada a lo que reconectarse: el reproductor vive dentro del propio bot.
  const status = new MusicService({}).status();
  assert.equal(status.engine, 'integrado');
  assert.equal(status.available, true);
});

test('el audit log exige objetivo y ventana temporal', async () => {
  const now = Date.now();
  const stale = { target: { id: 'wanted' }, createdTimestamp: now - 60_000 };
  const wrong = { target: { id: 'other' }, createdTimestamp: now };
  const expected = { target: { id: 'wanted' }, createdTimestamp: now };
  const guild = { fetchAuditLogs: async () => ({ entries: [stale, wrong, expected] }) };
  assert.equal(await findRecentAuditEntry(guild, 1, 'wanted'), expected);
});

test('existe una única configuración predeterminada versionada', () => {
  const config = createDefaultGuildConfig('guild');
  assert.equal(config.guildId, 'guild');
  assert.equal(config.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(config.features.music, false);
  assert.deepEqual(config.permissions.socialManagerRoles, []);
});
