require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');

const {
  Client,
  GatewayIntentBits,
  Collection,
  Events
} = require('discord.js');

const monitorStreams =
  require('./functions/Twitch/monitorStreams');

const monitorTikTokLives =
  require('./functions/TikTok/monitorLives');

const monitorTikTokVideos =
  require('./functions/TikTok/monitorVideos');

const updateDashboard =
  require('./functions/dashboard/updateDashboard');

// ==================================================
// VALIDAR .ENV
// ==================================================

if (!process.env.TOKEN) {
  console.error('❌ TOKEN no encontrado en el archivo .env');
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error('❌ CLIENT_ID no encontrado en el archivo .env');
  process.exit(1);
}

// ==================================================
// CLIENTE DISCORD
// ==================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.commands = new Collection();
client.timers = {}; // Para evitar intervalos acumulados

// ==================================================
// EXPRESS SERVER
// ==================================================

const app = express();

app.get('/', (req, res) => {
  res.send('Embers Void Bot Online');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Web activa en puerto ${PORT}`);
});

// ==================================================
// UTIL: CARGAR ARCHIVOS RECURSIVOS
// ==================================================

function getFiles(dir) {
  let results = [];

  if (!fs.existsSync(dir)) return results;

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);

    if (fs.statSync(filePath).isDirectory()) {
      results.push(...getFiles(filePath));
    } else if (file.endsWith('.js')) {
      results.push(filePath);
    }
  }

  return results;
}

// ==================================================
// CARGAR COMANDOS
// ==================================================

const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
  const commandFiles = getFiles(commandsPath);

  for (const filePath of commandFiles) {
    try {
      const command = require(filePath);

      if (!command.data || !command.execute) {
        console.log(`⚠️ ${filePath} no tiene data o execute`);
        continue;
      }

      client.commands.set(command.data.name, command);
      console.log(`✅ Comando cargado: ${command.data.name}`);

    } catch (error) {
      console.error(`❌ Error cargando comando: ${filePath}`);
      console.error(error);
    }
  }
} else {
  console.log('⚠️ La carpeta commands no existe.');
}

// ==================================================
// CARGAR EVENTOS
// ==================================================

const eventsPath = path.join(__dirname, 'events');

if (fs.existsSync(eventsPath)) {
  const eventFiles = getFiles(eventsPath);

  for (const filePath of eventFiles) {
    try {
      const event = require(filePath);

      if (!event.name || !event.execute) {
        console.log(`⚠️ ${filePath} no tiene name o execute`);
        continue;
      }

      const handler = (...args) =>
        event.execute(...args, client);

      if (event.once) {
        client.once(event.name, handler);
      } else {
        client.on(event.name, handler);
      }

      console.log(
        `✅ Evento cargado: ${path.relative(eventsPath, filePath)}`
      );

    } catch (error) {
      console.error(`❌ Error cargando evento: ${filePath}`);
      console.error(error);
    }
  }
} else {
  console.log('⚠️ La carpeta events no existe.');
}

// ==================================================
// READY
// ==================================================

client.once(Events.ClientReady, async (readyClient) => {

  console.log(`🤖 Bot conectado como ${readyClient.user.tag}`);

  // ==================================================
  // ACTUALIZAR DASHBOARDS AL INICIAR
  // ==================================================
  try {
    await updateDashboard(client);
    console.log('📊 Dashboards sincronizados.');
  } catch (err) {
    console.error('❌ Error actualizando dashboards', err);
  }

  // ==================================================
  // TWITCH MONITOR
  // ==================================================

  let checkingStreams = false;

  const runTwitch = async () => {
    if (checkingStreams) return;
    checkingStreams = true;

    try {
      await monitorStreams(client);
    } catch (error) {
      console.error('❌ Error monitor Twitch:', error);
    } finally {
      checkingStreams = false;
    }
  };

  await runTwitch();
  
  // Evitar intervalos acumulados
  if (!client.timers.twitch) {
    client.timers.twitch = setInterval(runTwitch, 120000);
    console.log('📺 Monitor de Twitch iniciado.');
  }

  // ==================================================
  // TIKTOK VIDEOS
  // ==================================================

  let checkingTikTokVideos = false;

  const runVideos = async () => {
    if (checkingTikTokVideos) return;
    checkingTikTokVideos = true;

    try {
      await monitorTikTokVideos(client);
    } catch (error) {
      console.error('❌ Error monitor TikTok Videos:', error);
    } finally {
      checkingTikTokVideos = false;
    }
  };

  await runVideos();
  
  // Evitar intervalos acumulados
  if (!client.timers.videos) {
    client.timers.videos = setInterval(runVideos, 120000);
    console.log('🎬 Monitor TikTok Videos iniciado.');
  }

  // ==================================================
  // TIKTOK LIVES
  // ==================================================

  let checkingTikTokLives = false;

  const runLives = async () => {
    if (checkingTikTokLives) return;
    checkingTikTokLives = true;

    try {
      await monitorTikTokLives(client);
    } catch (error) {
      console.error('❌ Error monitor TikTok Lives:', error);
    } finally {
      checkingTikTokLives = false;
    }
  };

  await runLives();
  
  // Evitar intervalos acumulados
  if (!client.timers.lives) {
    client.timers.lives = setInterval(runLives, 120000);
    console.log('🔴 Monitor TikTok Lives iniciado.');
  }

});

// ==================================================
// LIMPIAR INTERVALOS AL APAGAR EL BOT
// ==================================================
process.on('SIGINT', () => {
  console.log('🛑 Apagando bot, limpiando intervalos...');
  
  if (client.timers.twitch) clearInterval(client.timers.twitch);
  if (client.timers.videos) clearInterval(client.timers.videos);
  if (client.timers.lives) clearInterval(client.timers.lives);
  
  process.exit(0);
});

// ==================================================
// ERRORES GLOBALES
// ==================================================

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled Rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('❌ Uncaught Exception:', error);
});

// ==================================================
// LOGIN
// ==================================================

client.login(process.env.TOKEN);