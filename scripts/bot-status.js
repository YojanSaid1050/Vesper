const { REST, Routes } = require('discord.js');
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

async function checkStatus() {
  console.log(`${colors.cyan}🔍 VERIFICANDO ESTADO DEL BOT${colors.reset}\n`);
  console.log('═'.repeat(50));
  
  if (!CLIENT_ID || !TOKEN) {
    console.error(`${colors.red}❌ Faltan CLIENT_ID o TOKEN en .env${colors.reset}`);
    process.exit(1);
  }
  
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  
  try {
    // Verificar comandos globales
    console.log(`${colors.cyan}📋 Comandos Globales:${colors.reset}`);
    const globalCommands = await rest.get(Routes.applicationCommands(CLIENT_ID));
    
    if (globalCommands.length > 0) {
      console.log(`   ✅ ${globalCommands.length} comandos registrados`);
      globalCommands.slice(0, 10).forEach(cmd => {
        console.log(`      🔹 /${cmd.name} - ${cmd.description.substring(0, 50)}`);
      });
      if (globalCommands.length > 10) {
        console.log(`      ... y ${globalCommands.length - 10} más`);
      }
    } else {
      console.log(`   ${colors.yellow}⚠️ No hay comandos globales registrados${colors.reset}`);
    }
    
    console.log('');
    
    // Verificar comandos del servidor
    if (GUILD_ID) {
      console.log(`${colors.cyan}🏠 Comandos del Servidor (${GUILD_ID}):${colors.reset}`);
      try {
        const guildCommands = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));
        
        if (guildCommands.length > 0) {
          console.log(`   ✅ ${guildCommands.length} comandos registrados`);
          guildCommands.slice(0, 10).forEach(cmd => {
            console.log(`      🔹 /${cmd.name} - ${cmd.description.substring(0, 50)}`);
          });
        } else {
          console.log(`   ${colors.yellow}⚠️ No hay comandos locales registrados${colors.reset}`);
        }
      } catch (error) {
        console.log(`   ${colors.red}❌ Error: ${error.message}${colors.reset}`);
      }
    }
    
    console.log('\n' + '═'.repeat(50));
    console.log(`${colors.green}✨ Verificación completada${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    
    if (error.message.includes('Unknown interaction')) {
      console.log(`\n${colors.yellow}💡 Sugerencia: El CLIENT_ID podría ser incorrecto${colors.reset}`);
    }
    if (error.message.includes('Invalid Token')) {
      console.log(`\n${colors.yellow}💡 Sugerencia: El TOKEN es inválido${colors.reset}`);
    }
    
    process.exit(1);
  }
}

checkStatus();