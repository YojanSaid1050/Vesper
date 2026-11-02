const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { checkLiveUsers, checkUser, getCacheStats } = require('../../platforms/tiktok/checks');
const { normalizeUsername } = require('../../platforms/tiktok/utils');
const { friendlyError } = require('../../utils/userMessage');

module.exports = {
  scope: 'main',
  data: new SlashCommandBuilder()
    .setName('tiktok-test')
    .setDescription('Comprueba si el bot puede ver los directos y videos de una cuenta de TikTok')
    .addStringOption(option =>
      option.setName('usuario').setDescription('Usuario de TikTok').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('tipo')
        .setDescription('Comprobación que deseas ejecutar')
        .addChoices(
          { name: 'Directos y videos', value: 'all' },
          { name: 'Solo directos', value: 'live' },
          { name: 'Solo videos', value: 'video' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const username = normalizeUsername(interaction.options.getString('usuario'));
    const type = interaction.options.getString('tipo') || 'all';
    const lines = [`🔎 **Diagnóstico TikTok de @${username}**`];

    try {
      if (type === 'all' || type === 'live') {
        const [live] = await checkLiveUsers([username], { skipCache: true });
        if (!live) {
          lines.push('🔴 Directos: TikTok no dio información de esta cuenta.');
        } else {
          lines.push(`🔴 Directos: ${live.isLive ? `en directo con ${live.viewers} espectadores` : 'no está en directo ahora'}.`);
        }
      }

      if (type === 'all' || type === 'video') {
        const video = await checkUser(username, { skipCache: true });
        if (!video.exists) {
          lines.push('📹 Videos: no se encontró un video público reciente.');
        } else {
          lines.push('📹 Videos: el bot ve su último video sin problema.');
        }
      }

      const stats = await getCacheStats();
      lines.push(`🧭 Lector de videos: ${stats.provider.browser.ready ? 'listo' : stats.provider.browser.installed ? 'se activa al buscar videos' : 'modo sencillo'}.`);
      await interaction.editReply({ content: lines.join('\n') });
    } catch (error) {
      lines.push(`❌ No pude comprobar la cuenta. ${friendlyError(error, interaction)}`);
      await interaction.editReply({ content: lines.join('\n') });
    }
  }
};
