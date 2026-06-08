const { getAllGuildConfigs, updateGuildSection } = require('../database/mongoManager');
const { mainPanel } = require('./panels');

async function updateDashboard(client) {
  try {
    const guildsConfig = await getAllGuildConfigs();
    
    const guilds = Object.entries(guildsConfig || {}).map(([guildId, config]) => ({
      guildId,
      dashboard: config.dashboard || {},
      ...config
    }));
    
    let updated = 0, failed = 0, cleaned = 0;

    for (const guild of guilds) {
      try {
        if (!guild.dashboard?.channel || !guild.dashboard?.message) {
          continue;
        }

        const channel = await client.channels.fetch(guild.dashboard.channel).catch(() => null);
        if (!channel) {
          await updateGuildSection(guild.guildId, 'dashboard', { channel: null, message: null });
          cleaned++;
          continue;
        }

        const message = await channel.messages.fetch(guild.dashboard.message).catch(() => null);
        if (!message) {
          await updateGuildSection(guild.guildId, 'dashboard', { channel: null, message: null });
          cleaned++;
          continue;
        }

        try {
          const panel = await mainPanel(guild.guildId);
          await message.edit(panel);
          updated++;
        } catch {
          failed++;
        }
      } catch (err) {
        failed++;
        if (err.code === 10008 || err.code === 10003) {
          await updateGuildSection(guild.guildId, 'dashboard', { channel: null, message: null });
          cleaned++;
        }
      }
    }

    console.log(`📊 Dashboards actualizados: ${updated} | Errores: ${failed} | Limpiados: ${cleaned}`);
  } catch (error) {
    console.error('❌ Error en updateDashboard:', error);
  }
}

module.exports = { updateDashboard };