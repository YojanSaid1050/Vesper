const { PermissionFlagsBits } = require('discord.js');
const { csvSet, isMainGuild } = require('../config/guildPolicy');
const { isBotOwner } = require('../utils/interactionGuards');

const CAPABILITIES = Object.freeze({
  GLOBAL_OWNER: 'global_owner',
  MAIN_ADMIN: 'main_admin',
  SOCIAL_MANAGE: 'social_manage',
  MODERATE: 'moderate',
  MUSIC_DJ: 'music_dj',
  MUSIC_USE: 'music_use'
});

function hasRole(member, envName) {
  const allowed = csvSet(process.env[envName]);
  if (allowed.size === 0) return false;
  return member?.roles?.cache?.some?.(role => allowed.has(role.id)) === true;
}

function hasPermission(interaction, permission) {
  return interaction?.memberPermissions?.has?.(permission) === true;
}

function can(interaction, capability) {
  if (!interaction?.inGuild?.()) return false;
  const main = isMainGuild(interaction.guildId || interaction.guild?.id);
  const owner = isBotOwner(interaction.user?.id);
  const administrator = hasPermission(interaction, PermissionFlagsBits.Administrator);

  switch (capability) {
    case CAPABILITIES.GLOBAL_OWNER:
      return owner;
    case CAPABILITIES.MAIN_ADMIN:
      return main && (owner || administrator);
    case CAPABILITIES.SOCIAL_MANAGE:
      return main
        ? owner || administrator || hasRole(interaction.member, 'SOCIAL_MANAGER_ROLE_IDS')
        : administrator;
    case CAPABILITIES.MODERATE:
      return owner || administrator ||
        hasPermission(interaction, PermissionFlagsBits.ModerateMembers) ||
        hasRole(interaction.member, 'MODERATOR_ROLE_IDS');
    case CAPABILITIES.MUSIC_DJ:
      return owner || administrator ||
        hasPermission(interaction, PermissionFlagsBits.ManageChannels) ||
        hasRole(interaction.member, 'MUSIC_DJ_ROLE_IDS');
    case CAPABILITIES.MUSIC_USE:
      return true;
    default:
      return false;
  }
}

async function requireCapability(interaction, capability) {
  if (can(interaction, capability)) return true;
  const payload = { content: 'No tienes autorización para utilizar esta función.', flags: 64 };
  if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
  else await interaction.reply(payload).catch(() => null);
  return false;
}

module.exports = { CAPABILITIES, can, requireCapability };
