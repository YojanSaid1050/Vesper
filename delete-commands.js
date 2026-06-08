require('dotenv').config();
const { REST, Routes } = require('discord.js');

const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;

if (!CLIENT_ID || !TOKEN) {
  console.error('❌ Faltan CLIENT_ID o TOKEN en .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
      console.log('✅ Comandos locales eliminados');
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
      console.log('✅ Comandos globales eliminados');
    }
  } catch (error) {
    console.error('❌ Error eliminando comandos', error);
  }
})();