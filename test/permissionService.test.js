const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const { CAPABILITIES, can } = require('../src/core/PermissionService');

function interaction({ guildId, permissions = [], roles = [], userId = 'user' }) {
  return {
    guildId,
    guild: { id: guildId },
    user: { id: userId },
    inGuild: () => true,
    memberPermissions: { has: permission => permissions.includes(permission) },
    member: { roles: { cache: { some: predicate => roles.some(id => predicate({ id })) } } }
  };
}

test('el gestor de redes por rol solo obtiene alcance especial en el Main', () => {
  const oldMain = process.env.MAIN_GUILD_ID;
  const oldSocial = process.env.SOCIAL_MANAGER_ROLE_IDS;
  process.env.MAIN_GUILD_ID = 'main';
  process.env.SOCIAL_MANAGER_ROLE_IDS = 'social';
  assert.equal(can(interaction({ guildId: 'main', roles: ['social'] }), CAPABILITIES.SOCIAL_MANAGE), true);
  assert.equal(can(interaction({ guildId: 'satellite', roles: ['social'] }), CAPABILITIES.SOCIAL_MANAGE), false);
  assert.equal(can(interaction({ guildId: 'satellite', permissions: [PermissionFlagsBits.Administrator] }), CAPABILITIES.SOCIAL_MANAGE), true);
  if (oldMain === undefined) delete process.env.MAIN_GUILD_ID; else process.env.MAIN_GUILD_ID = oldMain;
  if (oldSocial === undefined) delete process.env.SOCIAL_MANAGER_ROLE_IDS; else process.env.SOCIAL_MANAGER_ROLE_IDS = oldSocial;
});

test('moderadores y DJ usan permisos nativos independientes', () => {
  assert.equal(can(interaction({ guildId: 'g', permissions: [PermissionFlagsBits.ModerateMembers] }), CAPABILITIES.MODERATE), true);
  assert.equal(can(interaction({ guildId: 'g', permissions: [PermissionFlagsBits.ManageChannels] }), CAPABILITIES.MUSIC_DJ), true);
  assert.equal(can(interaction({ guildId: 'g' }), CAPABILITIES.MUSIC_DJ), false);
});
