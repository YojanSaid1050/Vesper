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

// ==================================================
// VALIDAR .ENV
// ==================================================

if (!process.env.TOKEN) {

  console.error(
    '❌ TOKEN no encontrado en el archivo .env'
  );

  process.exit(1);

}

if (!process.env.CLIENT_ID) {

  console.error(
    '❌ CLIENT_ID no encontrado en el archivo .env'
  );

  process.exit(1);

}

// ==================================================
// CLIENTE
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

// ==================================================
// EXPRESS
// ==================================================

const app = express();

app.get('/', (req, res) => {

  res.send(
    'Embers Void Bot Online'
  );

});

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `🌐 Web activa en puerto ${PORT}`
  );

});

// ==================================================
// OBTENER ARCHIVOS RECURSIVOS
// ==================================================

function getFiles(dir) {

  let results = [];

  if (!fs.existsSync(dir)) {

    return results;

  }

  const files =
    fs.readdirSync(dir);

  for (const file of files) {

    const filePath =
      path.join(dir, file);

    if (
      fs.statSync(filePath).isDirectory()
    ) {

      results.push(
        ...getFiles(filePath)
      );

    }

    else if (
      file.endsWith('.js')
    ) {

      results.push(filePath);

    }

  }

  return results;

}

// ==================================================
// CARGAR COMANDOS
// ==================================================

const commandsPath =
  path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {

  const commandFiles =
    getFiles(commandsPath);

  for (const filePath of commandFiles) {

    try {

      const command =
        require(filePath);

      if (
        !command.data ||
        !command.execute
      ) {

        console.log(
          `⚠️ ${filePath} no tiene data o execute`
        );

        continue;

      }

      client.commands.set(
        command.data.name,
        command
      );

      console.log(
        `✅ Comando cargado: ${command.data.name}`
      );

    }

    catch (error) {

      console.error(
        `❌ Error cargando comando: ${filePath}`
      );

      console.error(error);

    }

  }

}

else {

  console.log(
    '⚠️ La carpeta commands no existe.'
  );

}

// ==================================================
// CARGAR EVENTOS
// ==================================================

const eventsPath =
  path.join(__dirname, 'events');

if (fs.existsSync(eventsPath)) {

  const eventFiles =
    getFiles(eventsPath);

  for (const filePath of eventFiles) {

    try {

      const event =
        require(filePath);

      if (
        !event.name ||
        !event.execute
      ) {

        console.log(
          `⚠️ ${filePath} no tiene name o execute`
        );

        continue;

      }

      if (event.once) {

        client.once(

          event.name,

          (...args) =>
            event.execute(
              ...args,
              client
            )

        );

      }

      else {

        client.on(

          event.name,

          (...args) =>
            event.execute(
              ...args,
              client
            )

        );

      }

      console.log(
        `✅ Evento cargado: ${path.relative(
          eventsPath,
          filePath
        )}`
      );

    }

    catch (error) {

      console.error(
        `❌ Error cargando evento: ${filePath}`
      );

      console.error(error);

    }

  }

}

else {

  console.log(
    '⚠️ La carpeta events no existe.'
  );

}


// ==================================================
// READY
// ==================================================

client.once(

  Events.ClientReady,

  readyClient => {

    console.log(
      `🤖 Bot conectado como ${readyClient.user.tag}`
    );

    // ==========================================
    // TWITCH
    // ==========================================

    let checkingStreams = false;

    monitorStreams(client);

    setInterval(async () => {

      if (checkingStreams) return;

      checkingStreams = true;

      try {

        await monitorStreams(client);

      }

      catch (error) {

        console.error(
          '❌ Error monitor Twitch:'
        );

        console.error(error);

      }

      finally {

        checkingStreams = false;

      }

    }, 120000);

    console.log(
      '📺 Monitor de Twitch iniciado.'
    );

    // ==========================================
    // TIKTOK VIDEOS
    // ==========================================

    let checkingTikTokVideos = false;

    monitorTikTokVideos(client);

    setInterval(async () => {

      if (checkingTikTokVideos) return;

      checkingTikTokVideos = true;

      try {

        await monitorTikTokVideos(client);

      }

      catch (error) {

        console.error(
          '❌ Error monitor TikTok Videos:'
        );

        console.error(error);

      }

      finally {

        checkingTikTokVideos = false;

      }

    }, 120000);

    console.log(
      '🎬 Monitor TikTok Videos iniciado.'
    );

    // ==========================================
    // TIKTOK LIVES
    // ==========================================

    let checkingTikTokLives = false;

    monitorTikTokLives(client);

    setInterval(async () => {

      if (checkingTikTokLives) return;

      checkingTikTokLives = true;

      try {

        await monitorTikTokLives(client);

      }

      catch (error) {

        console.error(
          '❌ Error monitor TikTok Lives:'
        );

        console.error(error);

      }

      finally {

        checkingTikTokLives = false;

      }

    }, 120000);

    console.log(
      '🔴 Monitor TikTok Lives iniciado.'
    );

  }

);

// ==================================================
// ERRORES GLOBALES
// ==================================================

process.on(

  'unhandledRejection',

  error => {

    console.error(
      '❌ Unhandled Rejection:'
    );

    console.error(error);

  }

);

process.on(

  'uncaughtException',

  error => {

    console.error(
      '❌ Uncaught Exception:'
    );

    console.error(error);

  }

);

// ==================================================
// LOGIN
// ==================================================

client.login(
  process.env.TOKEN
);