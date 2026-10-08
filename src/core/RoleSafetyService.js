const { PermissionFlagsBits } = require('discord.js');

const DANGEROUS_ROLE_PERMISSIONS = Object.freeze([
  [PermissionFlagsBits.Administrator, 'Administrador'],
  [PermissionFlagsBits.ManageGuild, 'Gestionar servidor'],
  [PermissionFlagsBits.ManageRoles, 'Gestionar roles'],
  [PermissionFlagsBits.ManageChannels, 'Gestionar canales'],
  [PermissionFlagsBits.ManageWebhooks, 'Gestionar webhooks'],
  [PermissionFlagsBits.KickMembers, 'Expulsar miembros'],
  [PermissionFlagsBits.BanMembers, 'Banear miembros'],
  [PermissionFlagsBits.ModerateMembers, 'Moderar miembros'],
  [PermissionFlagsBits.ManageMessages, 'Gestionar mensajes'],
  [PermissionFlagsBits.MentionEveryone, 'Mencionar @everyone'],
  [PermissionFlagsBits.ViewAuditLog, 'Ver registro de auditoría']
]);

function dangerousRolePermissions(role) {
  if (!role?.permissions?.has) return [];
  return DANGEROUS_ROLE_PERMISSIONS.filter(([permission]) => role.permissions.has(permission)).map(([, label]) => label);
}

function selfAssignableRoleIssue(role, guild, botMember = guild?.members?.me) {
  if (!role || role.id === guild?.id) return 'El rol no existe o es @everyone.';
  if (role.managed) return 'El rol pertenece a una integración.';
  if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) return 'Al bot le falta Gestionar roles.';
  if (role.position >= botMember.roles.highest.position) return 'El rol debe estar debajo del rol del bot.';
  const dangerous = dangerousRolePermissions(role);
  if (dangerous.length) return `El rol tiene permisos sensibles: ${dangerous.join(', ')}.`;
  return null;
}

module.exports = { DANGEROUS_ROLE_PERMISSIONS, dangerousRolePermissions, selfAssignableRoleIssue };
