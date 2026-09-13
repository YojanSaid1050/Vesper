const { Events, MessageFlags } = require('discord.js');
const { isMainGuild, commandAvailable } = require('../config/guildPolicy');
const { CAPABILITIES, requireCapability } = require('../core/PermissionService');
const { colorRoles, countryRoles, gameRoles, platformRoles } = require('../config/mainGuild');

const COLLECTOR_ONLY_COMPONENT_IDS = new Set([
  'tiktok_clear_confirm', 'tiktok_clear_cancel',
  'twitch_clear_confirm', 'twitch_clear_cancel',
  'youtube_clear_confirm', 'youtube_clear_cancel',
  'confirm_reset_config', 'cancel_reset_config',
  'resetalldb_confirm', 'resetalldb_cancel'
]);

function inferredCapability(commandName) {
  if (commandName === 'resetalldb') return CAPABILITIES.GLOBAL_OWNER;
  if (/^(tiktok|twitch|youtube)-/.test(commandName)) return CAPABILITIES.SOCIAL_MANAGE;
  if (['clear', 'advertir', 'aislar', 'sanciones'].includes(commandName)) return CAPABILITIES.MODERATE;
  if (['branding', 'cache', 'config-dashboard', 'forcecheck', 'resetbranding', 'resetconfig', 'serverconfig',
    'setbotavatar', 'setbotlog', 'setbotname', 'setbotrole', 'setgoodbye', 'setlog', 'setwelcome', 'testbranding'].includes(commandName)) {
    return CAPABILITIES.GUILD_ADMIN;
  }
  return null;
}

// ==================================================
// ROLES PARA COLORES, PAÍSES, JUEGOS Y PLATAFORMAS
// ==================================================
// ==================================================
// FUNCIÓN PARA MANEJAR ROLES
// ==================================================
async function handleColorRoles(interaction) {
  if (!isMainGuild(interaction.guildId || interaction.guild?.id)) return false;
  // Object.hasOwn evita que customIds como "constructor" o "toString"
  // coincidan con propiedades heredadas del prototipo y se traguen
  // interacciones que pertenecen a otros manejadores.
  const customId = String(interaction.customId ?? '');
  const inMap = (map) => Object.hasOwn(map, customId);
  const handled = customId === 'select_color' ||
    customId === 'select_country' ||
    inMap(colorRoles) ||
    inMap(countryRoles) ||
    inMap(gameRoles) ||
    inMap(platformRoles);

  if (!handled) return false;

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
  } catch { return true; }

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_color') {
    const selected = interaction.values[0];
    await interaction.member.roles.remove(Object.values(colorRoles));
    if (selected !== 'color_remove') {
      const roleId = colorRoles[selected];
      if (roleId) await interaction.member.roles.add(roleId);
    }
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_country') {
    const selected = interaction.values[0];
    await interaction.member.roles.remove(Object.values(countryRoles));
    const roleId = countryRoles[selected];
    if (roleId) await interaction.member.roles.add(roleId);
    return true;
  }

  if (interaction.isButton() && inMap(gameRoles)) {
    const roleId = gameRoles[customId];
    if (interaction.member.roles.cache.has(roleId)) {
      await interaction.member.roles.remove(roleId);
    } else {
      await interaction.member.roles.add(roleId);
    }
    return true;
  }

  if (interaction.isButton() && inMap(platformRoles)) {
    const roleId = platformRoles[customId];
    if (interaction.member.roles.cache.has(roleId)) {
      await interaction.member.roles.remove(roleId);
    } else {
      await interaction.member.roles.add(roleId);
    }
    return true;
  }

  return true;
}

// ==================================================
// EVENTO PRINCIPAL
// ==================================================
module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    try {
      // ==================================================
      // COLOR ROLES (primero, porque son interacciones específicas)
      // ==================================================
      const handled = await handleColorRoles(interaction);
      if (handled) return;

      // ==================================================
      // SLASH COMMANDS
      // ==================================================
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        if (!commandAvailable(command, interaction.guildId)) {
          return interaction.reply({ content: 'Este comando no está disponible en este servidor.', flags: 64 }).catch(() => null);
        }
        const capability = command.capability || inferredCapability(command.data.name);
        if (capability && !await requireCapability(interaction, capability)) return;

        try {
          await command.execute(interaction, client);
        } catch (error) {
          console.error(`Error en comando ${interaction.commandName}:`, error);
          // Si el comando ya respondió, reply() lanzaría InteractionAlreadyReplied
          // y el error real quedaba oculto tras un fallo secundario.
          const content = '❌ Error ejecutando el comando.';
          try {
            if (interaction.deferred && !interaction.replied) {
              await interaction.editReply({ content });
            } else if (interaction.replied || interaction.deferred) {
              await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
            } else {
              await interaction.reply({ content, flags: MessageFlags.Ephemeral });
            }
          } catch (replyError) {
            console.error('No se pudo notificar el error al usuario:', replyError.message);
          }
        }
        return;
      }

      // ==================================================
      // BOTONES
      // ==================================================
      if (interaction.isButton()) {
        // Estos botones pertenecen a collectors efímeros creados por comandos.
        // El listener del collector hará la validación de usuario y expiración.
        if (COLLECTOR_ONLY_COMPONENT_IDS.has(interaction.customId)) return;
        const { handleButton } = require('../handlers/buttons');
        return await handleButton(interaction, client);
      }

      // ==================================================
      // SELECT MENUS
      // ==================================================
      if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
        const { handleSelect } = require('../handlers/selects');
        return await handleSelect(interaction, client);
      }

      // ==================================================
      // MODALS
      // ==================================================
      if (interaction.isModalSubmit()) {
        const { handleModal } = require('../handlers/modals');
        return await handleModal(interaction, client);
      }

    } catch (error) {
      console.error('❌ Error en interactionCreate:', error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Error inesperado.', flags: MessageFlags.Ephemeral });
        }
      } catch {}
    }
  }
};

module.exports.COLLECTOR_ONLY_COMPONENT_IDS = COLLECTOR_ONLY_COMPONENT_IDS;
module.exports.inferredCapability = inferredCapability;
