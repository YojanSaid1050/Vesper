const { PermissionFlagsBits } = require('discord.js');
const { isApprovedGuild, guildTier } = require('../config/guildPolicy');
const { csvSet } = require('./security');

function isGlobalOwner(session) {
  const discordOwners = csvSet(process.env.BOT_OWNER_IDS);
  const googleOwners = csvSet(process.env.GOOGLE_OWNER_EMAILS, value => value.toLowerCase());
  return Boolean(
    (session?.discord?.id && discordOwners.has(String(session.discord.id))) ||
    (session?.google?.verified && googleOwners.has(String(session.google.email || '').toLowerCase()))
  );
}

function hasConfiguredRole(member, roleIds = []) {
  const allowed = new Set((roleIds || []).map(String));
  return member?.roles?.cache?.some(role => allowed.has(String(role.id))) === true;
}

async function guildAccess(client, guildId, session, config = {}) {
  if (!client?.isReady?.() || !isApprovedGuild(guildId)) return null;
  const guild = client.guilds.cache.get(String(guildId));
  if (!guild) return null;

  const owner = isGlobalOwner(session);
  let member = null;
  if (session?.discord?.id) {
    // `force: true` hacía una llamada a la API de Discord por servidor y por
    // petición: al listar servidores se multiplicaba y agotaba el límite de
    // peticiones. La caché de miembros se mantiene actualizada por el evento
    // guildMemberUpdate, así que basta con recurrir a la API cuando falta.
    member = guild.members.cache?.get?.(String(session.discord.id))
      || await guild.members.fetch({ user: session.discord.id }).catch(() => null);
  }
  const administrator = member?.permissions?.has(PermissionFlagsBits.Administrator) === true;
  const manageGuild = member?.permissions?.has(PermissionFlagsBits.ManageGuild) === true;
  const moderateNative = member?.permissions?.has(PermissionFlagsBits.ModerateMembers) === true;
  const configuredModerator = hasConfiguredRole(member, config.permissions?.moderatorRoles);
  const configuredSocial = hasConfiguredRole(member, config.permissions?.socialManagerRoles);
  const configuredDj = hasConfiguredRole(member, config.permissions?.musicDjRoles);
  const visible = owner || Boolean(member);
  if (!visible) return null;

  return {
    guild,
    member,
    owner,
    visible,
    configure: owner || administrator || manageGuild,
    moderate: Boolean(session?.discord?.id) && (owner || administrator || moderateNative || configuredModerator),
    social: Boolean(session?.discord?.id) && (owner || administrator || manageGuild || configuredSocial),
    music: Boolean(session?.discord?.id) && (owner || administrator || manageGuild || configuredDj),
    viewOwnCases: Boolean(session?.discord?.id)
  };
}

async function accessibleGuilds(client, session, getConfig) {
  if (!client?.isReady?.()) return [];
  const result = [];
  for (const guild of client.guilds.cache.values()) {
    if (!isApprovedGuild(guild.id)) continue;
    const config = await getConfig(guild.id);
    const access = await guildAccess(client, guild.id, session, config);
    if (!access) continue;
    result.push({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ extension: 'png', size: 128 }),
      memberCount: guild.memberCount,
      tier: guildTier(guild.id),
      permissions: {
        configure: access.configure,
        moderate: access.moderate,
        social: access.social,
        music: access.music,
        viewOwnCases: access.viewOwnCases
      }
    });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * Los servidores donde la persona manda pero Vesper todavía no está.
 * Son los que se ofrecen para invitarlo.
 */
function invitableGuilds(client, session, managed = []) {
  const suyos = session?.discord?.guilds;
  if (!Array.isArray(suyos)) return [];

  const yaGestionados = new Set(managed.map(guild => guild.id));
  return suyos
    .filter(guild => !yaGestionados.has(guild.id))
    // Si el bot ya está dentro pero la persona no pudo entrar, no es que
    // falte invitarlo: es otra cosa, y no se ofrece como si lo fuera.
    .filter(guild => !client?.guilds?.cache?.has(guild.id))
    .map(guild => ({ id: guild.id, name: guild.name, icon: guild.icon, owner: guild.owner }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

module.exports = { isGlobalOwner, hasConfiguredRole, guildAccess, accessibleGuilds, invitableGuilds };
