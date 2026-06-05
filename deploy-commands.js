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

const USE_GUILD_COMMANDS =
  process.env.USE_GUILD_COMMANDS === 'true';

const GUILD_ID =
  process.env.GUILD_ID;

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

if (
  USE_GUILD_COMMANDS &&
  !GUILD_ID
) {

  console.error(
    '❌ Falta GUILD_ID para comandos locales.'
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

// ==================================================
// BUSCAR ARCHIVOS RECURSIVAMENTE
// ==================================================

function getCommandFiles(dir) {

  let results = [];

  const files =
    fs.readdirSync(dir);

  for (const file of files) {

    const filePath =
      path.join(dir, file);

    if (
      fs.statSync(filePath).isDirectory()
    ) {

      results =
        results.concat(
          getCommandFiles(filePath)
        );

    } else if (
      file.endsWith('.js')
    ) {

      results.push(filePath);

    }

  }

  return results;

}

const commandFiles =
  getCommandFiles(commandsPath);

// ==================================================
// IMPORTAR COMANDOS
// ==================================================

for (const filePath of commandFiles) {

  try {

    const command =
      require(filePath);

    const relativePath =
      path.relative(
        commandsPath,
        filePath
      );

    if (
      !command.data ||
      typeof command.data.toJSON !== 'function'
    ) {

      console.warn(
        `⚠️ ${relativePath} no tiene "data" válida.`
      );

      continue;

    }

    if (
      typeof command.execute !== 'function'
    ) {

      console.warn(
        `⚠️ ${relativePath} no tiene "execute".`
      );

      continue;

    }

    commands.push(
      command.data.toJSON()
    );

    console.log(
      `✅ Comando cargado: ${command.data.name}`
    );

  } catch (error) {

    console.error(
      `❌ Error cargando comando: ${filePath}`
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
// REGISTRAR COMANDOS
// ==================================================

(async () => {

  try {

    if (USE_GUILD_COMMANDS) {

      console.log(
        `🏠 Registrando ${commands.length} comandos locales...`
      );

      await rest.put(

        Routes.applicationGuildCommands(
          CLIENT_ID,
          GUILD_ID
        ),

        {
          body: commands
        }

      );

      console.log(
        '✅ Comandos locales registrados correctamente.'
      );

      console.log(
        '⚡ Los cambios deberían aparecer casi al instante.'
      );

    } else {

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

    }

  } catch (error) {

    console.error(
      '❌ Error registrando comandos.'
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