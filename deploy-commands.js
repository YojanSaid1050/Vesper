require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
  REST,
  Routes
} = require('discord.js');

// ==================================================
// VARIABLES
// ==================================================

const CLIENT_ID =
  process.env.CLIENT_ID;

const TOKEN =
  process.env.TOKEN;

// ==================================================
// VALIDAR VARIABLES
// ==================================================

if (!CLIENT_ID) {

  console.error(
    '❌ Falta CLIENT_ID en el archivo .env'
  );

  process.exit(1);

}

if (!TOKEN) {

  console.error(
    '❌ Falta TOKEN en el archivo .env'
  );

  process.exit(1);

}

// ==================================================
// CARGAR COMANDOS
// ==================================================

const commands = [];

const commandsPath =
  path.join(__dirname, 'commands');

// VALIDAR CARPETA

if (!fs.existsSync(commandsPath)) {

  console.error(
    '❌ La carpeta "commands" no existe.'
  );

  process.exit(1);

}

// LEER ARCHIVOS

const commandFiles =
  fs.readdirSync(commandsPath)
    .filter(file =>
      file.endsWith('.js')
    );

// ==================================================
// IMPORTAR COMANDOS
// ==================================================

for (const file of commandFiles) {

  try {

    const filePath =
      path.join(commandsPath, file);

    const command =
      require(filePath);

    // VALIDAR ESTRUCTURA

    if (
      !command.data ||
      typeof command.data.toJSON !== 'function'
    ) {

      console.warn(
        `⚠️ ${file} no tiene "data" válida.`
      );

      continue;

    }

    if (
      typeof command.execute !== 'function'
    ) {

      console.warn(
        `⚠️ ${file} no tiene "execute".`
      );

      continue;

    }

    // AGREGAR COMANDO

    commands.push(
      command.data.toJSON()
    );

    console.log(
      `✅ Comando cargado: ${command.data.name || file}`
    );

  } catch (error) {

    console.error(
      `❌ Error cargando comando: ${file}`
    );

    console.error(error);

  }

}

// ==================================================
// VALIDAR COMANDOS
// ==================================================

if (commands.length === 0) {

  console.error(
    '❌ No se encontraron comandos válidos.'
  );

  process.exit(1);

}

// ==================================================
// REST
// ==================================================

const rest = new REST({
  version: '10'
}).setToken(TOKEN);

// ==================================================
// REGISTRAR COMANDOS GLOBALES
// ==================================================

(async () => {

  try {

    console.log(
      `🌍 Registrando ${commands.length} comandos globales...`
    );

    await rest.put(

      Routes.applicationCommands(
        CLIENT_ID
      ),

      {
        body: commands
      }

    );

    console.log(
      '✅ Comandos globales registrados correctamente.'
    );

    console.log(
      '⏳ Los comandos globales pueden tardar varios minutos en aparecer.'
    );

  } catch (error) {

    console.error(
      '❌ Error registrando comandos globales.'
    );

    console.error(error);

    process.exit(1);

  }

})();

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