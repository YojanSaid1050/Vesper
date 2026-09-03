const { Events } = require('discord.js');
const { isMainGuild, commandAvailable } = require('../config/guildPolicy');
const { CAPABILITIES, requireCapability } = require('../core/PermissionService');
const { colorRoles, countryRoles, gameRoles, platformRoles } = require('../config/mainGuild');

// ==================================================
// ROLES PARA COLORES, PAÍSES, JUEGOS Y PLATAFORMAS
// ==================================================
// ==================================================
// FUNCIÓN PARA MANEJAR ROLES
// ==================================================
async function handleColorRoles(interaction) {
  if (!isMainGuild(interaction.guildId || interaction.guild?.id)) return false;
  const handled = interaction.customId === 'select_color' ||
    interaction.customId === 'select_country' ||
    colorRoles[interaction.customId] ||
    countryRoles[interaction.customId] ||
    gameRoles[interaction.customId] ||
    platformRoles[interaction.customId];

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

  if (interaction.isButton() && gameRoles[interaction.customId]) {
    const roleId = gameRoles[interaction.customId];
    if (interaction.member.roles.cache.has(roleId)) {
      await interaction.member.roles.remove(roleId);
    } else {
      await interaction.member.roles.add(roleId);
    }
    return true;
  }

  if (interaction.isButton() && platformRoles[interaction.customId]) {
    const roleId = platformRoles[interaction.customId];
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
        const capability = command.capability ||
          (/^(tiktok|twitch|youtube)-/.test(command.data.name) ? CAPABILITIES.SOCIAL_MANAGE : null);
        if (capability && !await requireCapability(interaction, capability)) return;

        try {
          await command.execute(interaction, client);
        } catch (error) {
          console.error(`Error en comando ${interaction.commandName}:`, error);
          const reply = { content: '❌ Error ejecutando el comando.', ephemeral: true };
          if (interaction.deferred) {
            await interaction.editReply(reply);
          } else {
            await interaction.reply(reply);
          }
        }
        return;
      }

      // ==================================================
      // BOTONES
      // ==================================================
      if (interaction.isButton()) {
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
          await interaction.reply({ content: '❌ Error inesperado.', ephemeral: true });
        }
      } catch {}
    }
  }
};
