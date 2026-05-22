require('dotenv').config();

const fs = require('fs');

const path = require('path');

const {
  REST,
  Routes
} = require('discord.js');

// =========================
// CARGAR COMANDOS
// =========================

const commands = [];

const commandsPath =
  path.join(__dirname, 'commands');

const commandFiles =
  fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {

  const filePath =
    path.join(commandsPath, file);

  const command =
    require(filePath);

  if ('data' in command) {

    commands.push(
      command.data.toJSON()
    );

  }

}

// =========================
// REGISTRAR COMANDOS
// =========================

const rest = new REST({
  version: '10'
}).setToken(process.env.TOKEN);

(async () => {

  try {

    console.log(
      '🔄 Registrando comandos globales...'
    );

    await rest.put(

      Routes.applicationCommands(
        process.env.CLIENT_ID
      ),

      {
        body: commands
      }

    );

    console.log(
      '✅ Comandos globales registrados.'
    );

  } catch (error) {

    console.error(error);

  }

})();