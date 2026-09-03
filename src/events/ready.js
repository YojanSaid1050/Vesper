const { Events } = require('discord.js');
const { startAllMonitors } = require('../platforms');
const { updateDashboard } = require('../dashboard/updater');
const { connectMongo } = require('../database/mongoManager'); // Añadido para verificar conexión
const { getMainGuildId } = require('../config/guildPolicy');
const { auditGuild } = require('../core/DiagnosticsService');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`🤖 Bot conectado como ${client.user.tag}`);
    console.log(`📡 Conectado a ${client.guilds.cache.size} servidores`);

    // Configurar presencia del bot
    client.user.setPresence({
      activities: [{ 
        name: 'the embers beyond the void', 
        type: 4, // Custom status
        url: 'https://github.com/your-repo' // Opcional
      }],
      status: 'dnd' // dnd, online, idle, invisible
    });

    // Verificar conexión a MongoDB
    try {
      await connectMongo();
      console.log('✅ MongoDB conectado y listo');
    } catch (error) {
      console.error('❌ Error conectando a MongoDB:', error.message);
    }

    // Actualizar dashboards de todos los servidores
    try {
      console.log('🔄 Actualizando dashboards...');
      const result = await updateDashboard(client);
      console.log(`✅ Dashboards actualizados: ${result.updated} servidores`);
    } catch (error) {
      console.error('❌ Error actualizando dashboards:', error);
    }
    
    // Iniciar monitores de plataformas
    try {
      console.log('🚀 Iniciando monitores...');
      startAllMonitors(client);
      console.log('✅ Monitores iniciados correctamente');
    } catch (error) {
      console.error('❌ Error iniciando monitores:', error);
    }

    try {
      await client.music.start();
      console.log(client.music.status().configured ? '🎵 Servicio de música iniciado' : 'ℹ️ Música disponible pero Lavalink no está configurado');
    } catch (error) {
      console.error('❌ Error iniciando música:', error.message);
    }

    const mainGuild = client.guilds.cache.get(getMainGuildId());
    if (mainGuild) {
      const audit = await auditGuild(mainGuild).catch(() => null);
      if (audit?.issues?.length) console.warn(`⚠️ Auditoría Main: ${audit.issues.join(' | ')}`);
      else if (audit) console.log('✅ Auditoría inicial del Main completada sin incidencias');
    } else {
      console.warn('⚠️ MAIN_GUILD_ID no corresponde a un servidor disponible para Vesper');
    }

    // Log final
    console.log('✨ Bot listo para usar');
  }
};
