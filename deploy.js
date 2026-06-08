require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.TOKEN;
const USE_GUILD_COMMANDS = process.env.USE_GUILD_COMMANDS === 'true';
const GUILD_ID = process.env.GUILD_ID;

if (!CLIENT_ID || !TOKEN) {
  console.error('❌ Faltan CLIENT_ID o TOKEN en .env');
  process.exit(1);
}

if (USE_GUILD_COMMANDS && !GUILD_ID) {
  console.error('❌ Falta GUILD_ID para comandos locales');
  process.exit(1);
}

const commands = [];

function getCommandFiles(dir) {
  let results = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      results = results.concat(getCommandFiles(filePath));
    } else if (file.endsWith('.js')) {
      results.push(filePath);
    }
  }
  return results;
}

const commandsPath = path.join(__dirname, 'src', 'commands');
if (!fs.existsSync(commandsPath)) {
  console.error('❌ Carpeta commands no existe');
  process.exit(1);
}

const commandFiles = getCommandFiles(commandsPath);

for (const filePath of commandFiles) {
  try {
    const command = require(filePath);
    if (command.data && typeof command.data.toJSON === 'function' && typeof command.execute === 'function') {
      commands.push(command.data.toJSON());
      console.log(`✅ Comando cargado: ${command.data.name}`);
    } else {
      console.log(`⚠️ ${filePath} no tiene data o execute válidos`);
    }
  } catch (error) {
    console.error(`❌ Error cargando comando: ${filePath}`, error);
  }
}

if (commands.length === 0) {
  console.error('❌ No se encontraron comandos válidos');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    if (USE_GUILD_COMMANDS) {
      console.log(`🏠 Registrando ${commands.length} comandos locales...`);
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log('✅ Comandos locales registrados correctamente');
    } else {
      console.log(`🌍 Registrando ${commands.length} comandos globales...`);
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('✅ Comandos globales registrados correctamente');
    }
  } catch (error) {
    console.error('❌ Error registrando comandos', error);
    process.exit(1);
  }
})();