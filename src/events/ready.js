const { Events } = require('discord.js');
const { startAllMonitors } = require('../platforms');
const { updateDashboard } = require('../dashboard/updater');
const { connectMongo, getGuildConfig } = require('../database/mongoManager'); // Añadido para verificar conexión
const { getMainGuildId, isAnyMainGuild } = require('../config/guildPolicy');
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

    // La música no bloquea el arranque. Antes se esperaban 15 segundos a que
    // respondiera un servidor que en muchos alojamientos no existe, y el fallo
    // se escribía como si algo se hubiera roto. Ahora se arranca la conexión
    // en segundo plano y se dice en una línea en qué estado quedó.
    try {
      await client.music.start();
      const music = client.music.status();
      if (!music.configured) {
        console.log(`🎵 Música desactivada — ${music.reason}`);
      } else if (music.connected) {
        console.log('🎵 Música conectada y lista');
      } else {
        console.log(`🎵 Música: conectando con ${music.url} en segundo plano…`);
      }
    } catch (error) {
      console.log('🎵 Música no disponible; el resto de Vesper sigue activo:', error.message);
    }

    for (const guild of client.guilds.cache.values()) {
      if (!isAnyMainGuild(guild.id)) continue;
      const config = await getGuildConfig(guild.id).catch(() => null);
      const displayName = config?.profile?.displayName;
      // guild.members.me puede ser null si el miembro del bot aún no está en
      // caché. Sin esta comprobación el arranque lanzaba un TypeError.
      const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
      if (displayName && me && me.displayName !== displayName) {
        await me.setNickname(displayName, 'Perfil del servidor Main configurado en Vesper').catch(error => {
          console.warn(`⚠️ No fue posible aplicar el apodo ${displayName} en ${guild.name}: ${error.message}`);
        });
      }
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
