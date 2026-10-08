const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionsBitField, PermissionFlagsBits } = require('discord.js');
const { dangerousRolePermissions, selfAssignableRoleIssue } = require('../src/core/RoleSafetyService');

function context(rolePermissions = []) {
  const guild = { id: '100000000000000000', members: {} };
  const bot = {
    permissions: new PermissionsBitField([PermissionFlagsBits.ManageRoles]),
    roles: { highest: { position: 10 } }
  };
  guild.members.me = bot;
  const role = {
    id: '200000000000000000', name: 'Rol', managed: false, position: 2,
    permissions: new PermissionsBitField(rolePermissions)
  };
  return { guild, bot, role };
}

test('un autorrol normal situado debajo del bot es seguro', () => {
  const { guild, bot, role } = context([PermissionFlagsBits.ViewChannel]);
  assert.equal(selfAssignableRoleIssue(role, guild, bot), null);
});

test('nunca se ofrecen autorroles con permisos administrativos', () => {
  for (const permission of [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ManageChannels]) {
    const { guild, bot, role } = context([permission]);
    assert.ok(selfAssignableRoleIssue(role, guild, bot));
    assert.ok(dangerousRolePermissions(role).length);
  }
});
