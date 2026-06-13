require('dotenv').config();
const { REST, Routes } = require('discord.js');

const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const DELETE_GUILD_COMMANDS = process.env.DELETE_GUILD_COMMANDS === 'true';

if (!CLIENT_ID || !TOKEN) {
  console.error('❌ Faltan CLIENT_ID o TOKEN en .env');
  process.exit(1);
}

console.log('🗑️ Iniciando eliminación de comandos...');

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    const startTime = Date.now();
    
    if (DELETE_GUILD_COMMANDS && GUILD_ID) {
      console.log(`🏠 Eliminando comandos del servidor: ${GUILD_ID}`);
      const currentCommands = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));
      console.log(`📋 Comandos encontrados: ${currentCommands.length}`);
      
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
      console.log(`✅ ${currentCommands.length} comandos locales eliminados`);
      
    } else if (GUILD_ID) {
      console.log('🌍 Eliminando comandos globales...');
      const currentCommands = await rest.get(Routes.applicationCommands(CLIENT_ID));
      console.log(`📋 Comandos encontrados: ${currentCommands.length}`);
      
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
      console.log(`✅ ${currentCommands.length} comandos globales eliminados`);
      
    } else {
      console.log('🌍 Eliminando comandos globales...');
      const currentCommands = await rest.get(Routes.applicationCommands(CLIENT_ID));
      console.log(`📋 Comandos encontrados: ${currentCommands.length}`);
      
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
      console.log(`✅ ${currentCommands.length} comandos globales eliminados`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`\n✨ Eliminación completada en ${duration}ms`);
    
  } catch (error) {
    console.error('\n❌ Error eliminando comandos');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
})();