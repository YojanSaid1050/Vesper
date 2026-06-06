const {
  getAllGuilds,
  updateGuildSection
} = require('../../utils/guildManager');

const mainPanel = require('../Embeds/dashboard/mainPanel');

module.exports = async (client) => {
  const guilds = getAllGuilds();

  let updated = 0;
  let failed = 0;
  let cleaned = 0;

  for (const guild of guilds) {
    try {
      // Verificar si tiene dashboard configurado
      if (!guild.dashboard?.channel || !guild.dashboard?.message) {
        continue;
      }

      // Intentar obtener el canal
      const channel = await client.channels
        .fetch(guild.dashboard.channel)
        .catch(() => null);

      if (!channel) {
        // Canal no existe, limpiar configuración huérfana
        updateGuildSection(guild.guildId, 'dashboard', {
          channel: null,
          message: null
        });
        cleaned++;
        console.log(`🧹 Dashboard huérfano limpiado (${guild.guildId}) - Canal no existe`);
        continue;
      }

      // Intentar obtener el mensaje
      const message = await channel.messages
        .fetch(guild.dashboard.message)
        .catch(() => null);

      if (!message) {
        // Mensaje no existe, limpiar configuración huérfana
        updateGuildSection(guild.guildId, 'dashboard', {
          channel: null,
          message: null
        });
        cleaned++;
        console.log(`🧹 Dashboard huérfano limpiado (${guild.guildId}) - Mensaje no existe`);
        continue;
      }

      // Generar el panel (soporta función async)
      const panel = await mainPanel(guild.guildId);
      
      // Editar el mensaje
      await message.edit(panel);
      
      updated++;
      console.log(`✅ Dashboard actualizado (${guild.guildId})`);

    } catch (err) {
      failed++;
      console.error(`❌ Error dashboard ${guild.guildId}`, err);
      
      // Si el error es porque el mensaje o canal no existen, limpiar
      if (err.code === 10008 || err.code === 10003) { // Unknown Message o Unknown Channel
        updateGuildSection(guild.guildId, 'dashboard', {
          channel: null,
          message: null
        });
        cleaned++;
        console.log(`🧹 Dashboard huérfano limpiado por error (${guild.guildId})`);
      }
    }
  }

  console.log(
    `📊 Dashboards actualizados: ${updated} | Errores: ${failed} | Limpiados: ${cleaned}`
  );
};