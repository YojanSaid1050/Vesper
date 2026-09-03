const { SlashCommandBuilder } = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const { MODULE_DEFAULTS, isApprovedGuild } = require('../../config/guildPolicy');

module.exports = {
  scope: 'main',
  capability: CAPABILITIES.MAIN_ADMIN,
  data: new SlashCommandBuilder()
    .setName('vesper-modulo')
    .setDescription('Activa o desactiva un módulo desde el servidor principal.')
    .addStringOption(option => option.setName('servidor').setDescription('ID del servidor objetivo').setRequired(true))
    .addStringOption(option => option.setName('modulo').setDescription('Módulo que deseas cambiar').setRequired(true)
      .addChoices(...Object.keys(MODULE_DEFAULTS).map(name => ({ name, value: name }))))
    .addBooleanOption(option => option.setName('activo').setDescription('Estado nuevo').setRequired(true)),
  async execute(interaction, client) {
    const guildId = interaction.options.getString('servidor').trim();
    const moduleName = interaction.options.getString('modulo');
    const enabled = interaction.options.getBoolean('activo');
    if (!isApprovedGuild(guildId) || !client.guilds.cache.has(guildId)) {
      return interaction.reply({ content: 'Ese servidor no está aprobado o Vesper no se encuentra allí.', flags: 64 });
    }
    await getGuildConfig(guildId);
    await updateGuildSection(guildId, 'features', { [moduleName]: enabled });
    if (moduleName === 'music' && !enabled) await client.music?.stop?.(guildId).catch(() => null);
    await interaction.reply({ content: `${enabled ? '✅' : '⚫'} **${moduleName}** quedó ${enabled ? 'activado' : 'desactivado'} para **${client.guilds.cache.get(guildId).name}**.`, flags: 64 });
  }
};
