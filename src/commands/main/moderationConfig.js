const { SlashCommandBuilder } = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');
const { updateGuildSection } = require('../../database/mongoManager');
const { isApprovedGuild } = require('../../config/guildPolicy');

module.exports = {
  scope: 'main',
  capability: CAPABILITIES.MAIN_ADMIN,
  data: new SlashCommandBuilder()
    .setName('vesper-mod-config')
    .setDescription('Configura filtros de moderación desde el Main.')
    .addStringOption(option => option.setName('servidor').setDescription('ID del servidor').setRequired(true))
    .addBooleanOption(option => option.setName('filtrar_enlaces').setDescription('Aplicar lista de dominios permitidos'))
    .addStringOption(option => option.setName('dominios').setDescription('Dominios permitidos separados por coma'))
    .addBooleanOption(option => option.setName('bloquear_invitaciones').setDescription('Bloquear invitaciones de Discord'))
    .addIntegerOption(option => option.setName('menciones').setDescription('Máximo de menciones por mensaje').setMinValue(1).setMaxValue(50))
    .addIntegerOption(option => option.setName('repeticiones').setDescription('Repeticiones en 30 segundos').setMinValue(2).setMaxValue(20))
    .addStringOption(option => option.setName('accion').setDescription('Acción automática').addChoices(
      { name: 'Eliminar y registrar', value: 'delete' },
      { name: 'Eliminar y advertir', value: 'warn' },
      { name: 'Eliminar y timeout 5 min', value: 'timeout' }
    )),
  async execute(interaction, client) {
    const guildId = interaction.options.getString('servidor').trim();
    if (!isApprovedGuild(guildId) || !client.guilds.cache.has(guildId)) {
      return interaction.reply({ content: 'Servidor no aprobado o Vesper no se encuentra allí.', flags: 64 });
    }
    const values = {};
    const links = interaction.options.getBoolean('filtrar_enlaces');
    const invites = interaction.options.getBoolean('bloquear_invitaciones');
    const mentions = interaction.options.getInteger('menciones');
    const repeats = interaction.options.getInteger('repeticiones');
    const action = interaction.options.getString('accion');
    const domains = interaction.options.getString('dominios');
    if (links !== null) values.filterLinks = links;
    if (invites !== null) values.blockInvites = invites;
    if (mentions !== null) values.maxMentions = mentions;
    if (repeats !== null) values.repeatLimit = repeats;
    if (action) values.action = action;
    if (domains !== null) values.allowedDomains = [...new Set(domains.split(',').map(value => value.trim().toLowerCase().replace(/^www\./, '')).filter(Boolean))];
    if (Object.keys(values).length === 0) return interaction.reply({ content: 'Indica al menos un valor para actualizar.', flags: 64 });
    await updateGuildSection(guildId, 'moderation', values);
    await interaction.reply({ content: `✅ Moderación actualizada para **${client.guilds.cache.get(guildId).name}**.`, flags: 64 });
  }
};
