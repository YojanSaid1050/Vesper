// scripts/clean-mongo.js
/**
 * Script para limpiar y mantener la base de datos MongoDB
 * 
 * USO:
 *   node scripts/clean-mongo.js                    # Muestra estadísticas
 *   node scripts/clean-mongo.js --clean            # Limpia usuarios duplicados
 *   node scripts/clean-mongo.js --reset-guild ID   # Resetea configuración de un servidor
 *   node scripts/clean-mongo.js --delete-guild ID  # Elimina completamente un servidor
 *   node scripts/clean-mongo.js --all              # Limpieza completa
 *   node scripts/clean-mongo.js --help             # Muestra ayuda
 */

require('dotenv').config();
const { connectMongo, getAllGuildConfigs, deleteGuild, cleanDuplicateUsers, updateGuildConfig } = require('../src/database/mongoManager');

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m'
};

function showHelp() {
    console.log(`
${colors.cyan}🧹 LIMPIADOR DE MONGODB - VESPER BOT${colors.reset}
${colors.gray}═══════════════════════════════════════════════════════════════${colors.reset}

${colors.yellow}USO:${colors.reset}
  node scripts/clean-mongo.js [opciones]

${colors.yellow}OPCIONES:${colors.reset}
  --stats, -s        Muestra estadísticas de la base de datos
  --clean, -c        Limpia usuarios duplicados en TikTok/Twitch/YouTube
  --reset-guild ID   Resetea la configuración de un servidor específico
  --delete-guild ID  Elimina completamente un servidor de la DB
  --all, -a          Limpieza completa (stats + clean)
  --help, -h         Muestra esta ayuda

${colors.yellow}EJEMPLOS:${colors.reset}
  node scripts/clean-mongo.js --stats
  node scripts/clean-mongo.js --clean
  node scripts/clean-mongo.js --reset-guild 1506580021232406540
  node scripts/clean-mongo.js --delete-guild 1506580021232406540
  node scripts/clean-mongo.js --all

${colors.yellow}ADVERTENCIA:${colors.reset}
  Las operaciones --reset-guild y --delete-guild son IRREVERSIBLES.
  Se recomienda hacer backup antes de usarlas.
`);
}

async function showStats() {
    console.log(`\n${colors.cyan}📊 ESTADÍSTICAS DE MONGODB${colors.reset}`);
    console.log(`${colors.gray}═══════════════════════════════════════════════════════════════${colors.reset}`);
    
    const guilds = await getAllGuildConfigs();
    const guildCount = Object.keys(guilds).length;
    
    console.log(`\n${colors.green}📁 Servidores registrados: ${guildCount}${colors.reset}`);
    
    let totalTikTok = 0;
    let totalTwitch = 0;
    let totalYouTube = 0;
    let totalUsers = 0;
    
    for (const [guildId, config] of Object.entries(guilds)) {
        const tiktokUsers = config.tiktok?.users?.length || 0;
        const twitchUsers = config.twitch?.users?.length || 0;
        const youtubeUsers = config.youtube?.users?.length || 0;
        
        totalTikTok += tiktokUsers;
        totalTwitch += twitchUsers;
        totalYouTube += youtubeUsers;
        totalUsers += tiktokUsers + twitchUsers + youtubeUsers;
        
        if (tiktokUsers > 0 || twitchUsers > 0 || youtubeUsers > 0) {
            console.log(`\n${colors.magenta}🆔 ${guildId}${colors.reset}`);
            if (tiktokUsers > 0) console.log(`   🎵 TikTok: ${tiktokUsers} usuarios`);
            if (twitchUsers > 0) console.log(`   📺 Twitch: ${twitchUsers} streamers`);
            if (youtubeUsers > 0) console.log(`   📀 YouTube: ${youtubeUsers} canales`);
        }
    }
    
    console.log(`\n${colors.cyan}📈 RESUMEN TOTAL:${colors.reset}`);
    console.log(`   🎵 TikTok: ${totalTikTok} usuarios monitoreados`);
    console.log(`   📺 Twitch: ${totalTwitch} streamers monitoreados`);
    console.log(`   📀 YouTube: ${totalYouTube} canales monitoreados`);
    console.log(`   👥 Total: ${totalUsers} elementos monitoreados`);
    
    return { guildCount, totalTikTok, totalTwitch, totalYouTube, totalUsers };
}

async function cleanDuplicates() {
    console.log(`\n${colors.cyan}🧹 LIMPIANDO USUARIOS DUPLICADOS${colors.reset}`);
    console.log(`${colors.gray}═══════════════════════════════════════════════════════════════${colors.reset}`);
    
    const cleaned = await cleanDuplicateUsers();
    
    if (cleaned > 0) {
        console.log(`\n${colors.green}✅ Limpiados ${cleaned} servidores con usuarios duplicados${colors.reset}`);
    } else {
        console.log(`\n${colors.yellow}⚠️ No se encontraron usuarios duplicados${colors.reset}`);
    }
    
    return cleaned;
}

async function resetGuildConfig(guildId) {
    console.log(`\n${colors.yellow}⚠️ RESETEANDO CONFIGURACIÓN DEL SERVIDOR: ${guildId}${colors.reset}`);
    console.log(`${colors.gray}═══════════════════════════════════════════════════════════════${colors.reset}`);
    
    const defaultConfig = {
        general: {
            welcomeChannel: null,
            goodbyeChannel: null,
            logChannel: null,
            botLogChannel: null,
            botRole: null
        },
        dashboard: {
            channel: null,
            message: null,
            enabled: false,
            currentPanel: 'main',
            currentMode: 'default'
        },
        tiktok: {
            liveChannel: null,
            videoChannel: null,
            users: [],
            showUsers: false
        },
        twitch: {
            liveChannel: null,
            users: [],
            showUsers: false
        },
        youtube: {
            liveChannel: null,
            videoChannel: null,
            shortChannel: null,
            users: [],
            showUsers: false
        },
        branding: {
            name: null,
            avatar: null
        },
        testPanel: {
            activeSection: 'general'
        }
    };
    
    await updateGuildConfig(guildId, defaultConfig);
    console.log(`\n${colors.green}✅ Configuración del servidor ${guildId} reseteada${colors.reset}`);
    
    return true;
}

async function deleteGuildConfig(guildId) {
    console.log(`\n${colors.red}⚠️ ELIMINANDO SERVIDOR: ${guildId}${colors.reset}`);
    console.log(`${colors.gray}═══════════════════════════════════════════════════════════════${colors.reset}`);
    
    const result = await deleteGuild(guildId);
    
    if (result.deletedCount > 0) {
        console.log(`\n${colors.green}✅ Servidor ${guildId} eliminado correctamente${colors.reset}`);
    } else {
        console.log(`\n${colors.yellow}⚠️ No se encontró el servidor ${guildId} en la base de datos${colors.reset}`);
    }
    
    return result.deletedCount > 0;
}

async function fullClean() {
    console.log(`\n${colors.cyan}🧹 LIMPIEZA COMPLETA DE MONGODB${colors.reset}`);
    console.log(`${colors.gray}═══════════════════════════════════════════════════════════════${colors.reset}`);
    
    await showStats();
    await cleanDuplicates();
    
    console.log(`\n${colors.green}✅ Limpieza completada${colors.reset}`);
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }
    
    console.log(`\n${colors.cyan}🔍 Conectando a MongoDB...${colors.reset}`);
    await connectMongo();
    console.log(`${colors.green}✅ Conectado${colors.reset}`);
    
    if (args.includes('--stats') || args.includes('-s')) {
        await showStats();
    }
    
    if (args.includes('--clean') || args.includes('-c')) {
        await cleanDuplicates();
    }
    
    const resetIndex = args.findIndex(arg => arg === '--reset-guild');
    if (resetIndex !== -1 && args[resetIndex + 1]) {
        const guildId = args[resetIndex + 1];
        console.log(`\n${colors.red}⚠️  ADVERTENCIA: Vas a resetear la configuración del servidor ${guildId}${colors.reset}`);
        console.log(`${colors.yellow}Esta acción es irreversible. Los datos eliminados no se pueden recuperar.${colors.reset}`);
        
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            rl.question(`\n¿Estás seguro? Escribe "CONFIRMAR" para continuar: `, resolve);
        });
        
        rl.close();
        
        if (answer === 'CONFIRMAR') {
            await resetGuildConfig(guildId);
        } else {
            console.log(`\n${colors.yellow}❌ Operación cancelada${colors.reset}`);
        }
    }
    
    const deleteIndex = args.findIndex(arg => arg === '--delete-guild');
    if (deleteIndex !== -1 && args[deleteIndex + 1]) {
        const guildId = args[deleteIndex + 1];
        console.log(`\n${colors.red}⚠️  ADVERTENCIA: Vas a ELIMINAR COMPLETAMENTE el servidor ${guildId}${colors.reset}`);
        console.log(`${colors.red}Todos los datos de configuración se perderán permanentemente.${colors.reset}`);
        
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            rl.question(`\n¿Estás seguro? Escribe "CONFIRMAR" para continuar: `, resolve);
        });
        
        rl.close();
        
        if (answer === 'CONFIRMAR') {
            await deleteGuildConfig(guildId);
        } else {
            console.log(`\n${colors.yellow}❌ Operación cancelada${colors.reset}`);
        }
    }
    
    if (args.includes('--all') || args.includes('-a')) {
        await fullClean();
    }
    
    console.log(`\n${colors.green}✨ Operación completada${colors.reset}`);
    process.exit(0);
}

main().catch(error => {
    console.error(`${colors.red}❌ Error:${colors.reset}`, error.message);
    process.exit(1);
});