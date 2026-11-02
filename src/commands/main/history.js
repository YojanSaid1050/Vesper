const { SlashCommandBuilder } = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');
const { recentNotifications } = require('../../core/NotificationService');
const { notificationLine } = require('../../dashboard/controlCenter');

module.exports = {
  scope: 'main',
  capability: CAPABILITIES.MAIN_ADMIN,
  data: new SlashCommandBuilder()
    .setName('vesper-historial')
    .setDescription('Consulta los avisos publicados en cualquier servidor.')
    .addStringOption(option => option.setName('servidor').setDescription('Número del servidor (vacío: todos)'))
    .addStringOption(option => option.setName('plataforma').setDescription('Filtrar plataforma').addChoices(
      { name: 'TikTok', value: 'tiktok' }, { name: 'Twitch', value: 'twitch' }, { name: 'YouTube', value: 'youtube' }
    )),
  async execute(interaction) {
    const guildId = interaction.options.getString('servidor');
    const platform = interaction.options.getString('plataforma');
    const filter = {};
    if (guildId) filter.guildId = guildId.trim();
    if (platform) filter.platform = platform;
    const rows = await recentNotifications(filter, 15);
    const lines = rows.map(row => notificationLine(row, interaction.guildId));
    await interaction.reply({ content: lines.join('\n\n').slice(0, 1900) || 'No hay avisos para ese filtro.', flags: 64 });
  }
};
