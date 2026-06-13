require('dotenv').config();
const { getAllGuildConfigs, connectMongo } = require('../src/database/mongoManager');

async function debug() {
    console.log('🔍 Conectando a MongoDB...');
    await connectMongo();
    
    console.log('\n📊 Obteniendo todas las configuraciones...');
    const guilds = await getAllGuildConfigs();
    
    console.log(`\n📁 Guilds encontrados: ${Object.keys(guilds).length}`);
    
    for (const [guildId, config] of Object.entries(guilds)) {
        console.log(`\n📌 Guild: ${guildId}`);
        console.log(`   TikTok users: ${JSON.stringify(config.tiktok?.users)}`);
        console.log(`   TikTok liveChannel: ${config.tiktok?.liveChannel}`);
        console.log(`   TikTok videoChannel: ${config.tiktok?.videoChannel}`);
        
        // Verificar si es array
        const users = config.tiktok?.users;
        if (users) {
            console.log(`   ¿Es array? ${Array.isArray(users)}`);
            if (Array.isArray(users)) {
                console.log(`   Usuarios: ${users.join(', ')}`);
            }
        }
    }
    
    console.log('\n✅ Debug completado');
    process.exit(0);
}

debug().catch(console.error);