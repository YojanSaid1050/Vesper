const { SlashCommandBuilder } = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');
const { recentNotifications } = require('../../core/NotificationService');

module.exports = {
  scope: 'main',
  capability: CAPABILITIES.MAIN_ADMIN,
  data: new SlashCommandBuilder()
    .setName('vesper-historial')
    .setDescription('Consulta notificaciones de cualquier servidor desde el Main.')
    .addStringOption(option => option.setName('servidor').setDescription('ID de servidor; vacío consulta todos'))
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
    const lines = rows.map(row => `${row.status === 'failed' ? '❌' : row.status === 'ended' ? '🏁' : '✅'} ${row.platform} · ${row.account} · ${row.eventType} · <t:${Math.floor(new Date(row.createdAt).getTime() / 1000)}:R>${row.error ? `\n${row.error}` : ''}`);
    await interaction.reply({ content: lines.join('\n').slice(0, 1900) || 'No hay registros para ese filtro.', flags: 64 });
  }
};
