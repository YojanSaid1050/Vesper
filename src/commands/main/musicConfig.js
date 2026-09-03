const { SlashCommandBuilder } = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');
const { updateGuildSection } = require('../../database/mongoManager');
const { isApprovedGuild } = require('../../config/guildPolicy');

module.exports = {
  scope: 'main',
  capability: CAPABILITIES.MAIN_ADMIN,
  data: new SlashCommandBuilder()
    .setName('vesper-musica-config')
    .setDescription('Configura la música de un servidor desde el Main.')
    .addStringOption(option => option.setName('servidor').setDescription('ID del servidor').setRequired(true))
    .addStringOption(option => option.setName('canal').setDescription('ID del canal de solicitudes; 0 para permitir todos'))
    .addIntegerOption(option => option.setName('volumen').setDescription('Volumen inicial').setMinValue(1).setMaxValue(100))
    .addIntegerOption(option => option.setName('cola').setDescription('Máximo de canciones en cola').setMinValue(1).setMaxValue(500))
    .addIntegerOption(option => option.setName('por_usuario').setDescription('Pendientes máximas por usuario').setMinValue(1).setMaxValue(25))
    .addIntegerOption(option => option.setName('duracion').setDescription('Duración máxima por canción en minutos').setMinValue(1).setMaxValue(180))
    .addIntegerOption(option => option.setName('inactividad').setDescription('Desconexión por inactividad en segundos').setMinValue(30).setMaxValue(3600)),
  async execute(interaction, client) {
    const guildId = interaction.options.getString('servidor').trim();
    if (!isApprovedGuild(guildId) || !client.guilds.cache.has(guildId)) {
      return interaction.reply({ content: 'Servidor no aprobado o Vesper no se encuentra allí.', flags: 64 });
    }
    const values = {};
    const channelId = interaction.options.getString('canal');
    if (channelId !== null) values.requestChannel = channelId === '0' ? null : channelId.trim();
    const mapping = { volumen: 'defaultVolume', cola: 'maxQueue', por_usuario: 'maxPerUser', duracion: 'maxTrackMinutes', inactividad: 'idleSeconds' };
    for (const [option, field] of Object.entries(mapping)) {
      const value = interaction.options.getInteger(option);
      if (value !== null) values[field] = value;
    }
    if (Object.keys(values).length === 0) return interaction.reply({ content: 'Indica al menos un valor para actualizar.', flags: 64 });
    if (values.requestChannel) {
      const guild = client.guilds.cache.get(guildId);
      const channel = guild.channels.cache.get(values.requestChannel);
      if (!channel?.isTextBased?.()) return interaction.reply({ content: 'El canal indicado no existe o no acepta mensajes.', flags: 64 });
    }
    await updateGuildSection(guildId, 'music', values);
    await interaction.reply({ content: `✅ Configuración musical actualizada para **${client.guilds.cache.get(guildId).name}**.`, flags: 64 });
  }
};
