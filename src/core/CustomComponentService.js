const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { isApprovedGuild } = require('../config/guildPolicy');
const { selfAssignableRoleIssue } = require('./RoleSafetyService');

const ROLE_BUTTON = /^vesper_role:(toggle|add|remove):(\d{16,22}):\d{1,2}$/;
const ROLE_MENU = /^vesper_roles:(toggle|add|remove|exclusive)$/;

function ephemeral(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

function componentIsTrusted(interaction) {
  const authorId = interaction.message?.author?.id;
  const botId = interaction.client?.user?.id;
  return Boolean(authorId && botId && authorId === botId);
}

async function assignableContext(interaction, roleIds) {
  if (!interaction.guild || !isApprovedGuild(interaction.guildId)) throw new Error('Este componente no está disponible en este servidor.');
  if (!componentIsTrusted(interaction)) throw new Error('Este componente no fue publicado directamente por el bot.');
  const me = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error('Al bot le falta el permiso «Gestionar roles».');
  const member = interaction.member;
  if (!member?.roles?.cache) throw new Error('No pude leer tus roles en este servidor.');

  const roles = [];
  for (const roleId of [...new Set(roleIds)]) {
    const role = interaction.guild.roles.cache.get(roleId) || await interaction.guild.roles.fetch(roleId).catch(() => null);
    const issue = selfAssignableRoleIssue(role, interaction.guild, me);
    if (issue) throw new Error(`El rol «${role?.name || roleId}» no es un autorrol seguro. ${issue}`);
    roles.push(role);
  }
  return { member, roles };
}

async function handleCustomRoleButton(interaction) {
  const match = String(interaction.customId || '').match(ROLE_BUTTON);
  if (!match) return false;
  try {
    const [, action, roleId] = match;
    const { member, roles: [role] } = await assignableContext(interaction, [roleId]);
    const hasRole = member.roles.cache.has(role.id);
    if (action === 'remove' || (action === 'toggle' && hasRole)) {
      if (hasRole) await member.roles.remove(role, 'Rol autogestionado desde un embed de Vesper');
      await ephemeral(interaction, `Se retiró el rol **${role.name}**.`);
    } else {
      if (!hasRole) await member.roles.add(role, 'Rol autogestionado desde un embed de Vesper');
      await ephemeral(interaction, `Ya tienes el rol **${role.name}**.`);
    }
  } catch (error) {
    await ephemeral(interaction, `No pude cambiar ese rol: ${String(error.message || error).slice(0, 250)}`).catch(() => null);
  }
  return true;
}

async function handleCustomRoleMenu(interaction) {
  const match = String(interaction.customId || '').match(ROLE_MENU);
  if (!match) return false;
  try {
    const mode = match[1];
    const configuredIds = interaction.message?.components?.flatMap(row => row.components || [])
      .find(component => component.customId === interaction.customId)?.options?.map(option => option.value) || [];
    const selected = [...new Set(interaction.values || [])].filter(value => configuredIds.includes(value));
    const { member, roles } = await assignableContext(interaction, configuredIds);
    const selectedSet = new Set(selected);
    const managedIds = new Set(roles.map(role => role.id));
    const has = role => member.roles.cache.has(role.id);
    const toAdd = [];
    const toRemove = [];

    for (const role of roles) {
      const chosen = selectedSet.has(role.id);
      if (mode === 'add' && chosen && !has(role)) toAdd.push(role);
      else if (mode === 'remove' && chosen && has(role)) toRemove.push(role);
      else if (mode === 'toggle' && chosen) (has(role) ? toRemove : toAdd).push(role);
      else if (mode === 'exclusive') {
        if (chosen && !has(role)) toAdd.push(role);
        if (!chosen && has(role) && managedIds.has(role.id)) toRemove.push(role);
      }
    }
    if (toRemove.length) await member.roles.remove(toRemove, 'Menú de roles autogestionado de Vesper');
    if (toAdd.length) await member.roles.add(toAdd, 'Menú de roles autogestionado de Vesper');
    const changed = [...toAdd.map(role => `+ ${role.name}`), ...toRemove.map(role => `− ${role.name}`)];
    await ephemeral(interaction, changed.length ? `Roles actualizados:\n${changed.join('\n')}` : 'Tus roles ya estaban actualizados.');
  } catch (error) {
    await ephemeral(interaction, `No pude actualizar tus roles: ${String(error.message || error).slice(0, 250)}`).catch(() => null);
  }
  return true;
}

module.exports = { handleCustomRoleButton, handleCustomRoleMenu, componentIsTrusted };
