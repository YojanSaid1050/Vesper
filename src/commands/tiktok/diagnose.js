const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { checkLiveUsers, checkUser, getCacheStats, CONFIG } = require('../../platforms/tiktok/checks');
const { normalizeUsername } = require('../../platforms/tiktok/utils');

module.exports = {
  scope: 'main',
  data: new SlashCommandBuilder()
    .setName('tiktok-test')
    .setDescription('Comprueba una cuenta y el estado real de los proveedores de TikTok')
    .addStringOption(option =>
      option.setName('usuario').setDescription('Usuario de TikTok').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('tipo')
        .setDescription('Comprobación que deseas ejecutar')
        .addChoices(
          { name: 'Lives y videos', value: 'all' },
          { name: 'Solo live', value: 'live' },
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
          lines.push('🔴 Live: el proveedor no devolvió una fila para esta cuenta.');
        } else {
          lines.push(`🔴 Live: ${live.isLive ? `en vivo con ${live.viewers} espectadores` : 'sin transmisión activa'}.`);
        }
        lines.push('↳ Proveedor: `consulta pública autohospedada`.');
      }

      if (type === 'all' || type === 'video') {
        const video = await checkUser(username, { skipCache: true });
        if (!video.exists) {
          lines.push('📹 Videos: no se encontró un video público reciente.');
        } else {
          lines.push(`📹 Videos: último ID \`${video.latestVideoId}\` detectado correctamente.`);
        }
        lines.push('↳ Proveedor: `navegador local autohospedado`.');
      }

      const stats = await getCacheStats();
      lines.push('💰 Coste de API: `US$0.00` (sin Apify ni créditos).');
      lines.push(`🧭 Navegador local: ${stats.provider.browser.ready ? 'listo' : stats.provider.browser.installed ? 'se iniciará cuando se consulten videos' : 'Chromium no detectado'}.`);
      await interaction.editReply({ content: lines.join('\n') });
    } catch (error) {
      lines.push(`❌ Falló la verificación: ${String(error.message || error).slice(0, 500)}`);
      lines.push(`↳ Modo: \`${CONFIG.PROVIDER}\`, sin consumo de créditos.`);
      await interaction.editReply({ content: lines.join('\n') });
    }
  }
};
