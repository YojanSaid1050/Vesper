const { getAllGuilds, updateGuildSection } = require('../database/guildManager');
const { mainPanel } = require('./panels');

async function updateDashboard(client) {
  const guilds = getAllGuilds();
  let updated = 0, failed = 0, cleaned = 0;

  for (const guild of guilds) {
    if (!guild.dashboard?.channel || !guild.dashboard?.message) continue;

    const channel = await client.channels.fetch(guild.dashboard.channel).catch(() => null);
    if (!channel) {
      updateGuildSection(guild.guildId, 'dashboard', { channel: null, message: null });
      cleaned++;
      continue;
    }

    const message = await channel.messages.fetch(guild.dashboard.message).catch(() => null);
    if (!message) {
      updateGuildSection(guild.guildId, 'dashboard', { channel: null, message: null });
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
  }

  console.log(`Dashboards actualizados: ${updated} | Errores: ${failed} | Limpiados: ${cleaned}`);
}

module.exports = { updateDashboard };