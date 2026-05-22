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

// ==================================================
// COMANDOS
// ==================================================

client.commands =
  new Collection();

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
// CARGAR COMANDOS
// ==================================================

const commandsPath =
  path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {

  const commandFiles =
    fs.readdirSync(commandsPath)
      .filter(file =>
        file.endsWith('.js')
      );

  for (const file of commandFiles) {

    try {

      const filePath =
        path.join(commandsPath, file);

      const command =
        require(filePath);

      // VALIDAR

      if (
        !command.data ||
        !command.execute
      ) {

        console.log(
          `⚠️ ${file} no tiene data o execute`
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

    } catch (error) {

      console.error(
        `❌ Error cargando comando: ${file}`
      );

      console.error(error);

    }

  }

} else {

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
    fs.readdirSync(eventsPath)
      .filter(file =>
        file.endsWith('.js')
      );

  for (const file of eventFiles) {

    try {

      const filePath =
        path.join(eventsPath, file);

      const event =
        require(filePath);

      // VALIDAR

      if (
        !event.name ||
        !event.execute
      ) {

        console.log(
          `⚠️ ${file} no tiene name o execute`
        );

        continue;

      }

      // EVENTOS

      if (event.once) {

        client.once(

          event.name,

          (...args) =>
            event.execute(
              ...args,
              client
            )

        );

      } else {

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
        `✅ Evento cargado: ${event.name}`
      );

    } catch (error) {

      console.error(
        `❌ Error cargando evento: ${file}`
      );

      console.error(error);

    }

  }

} else {

  console.log(
    '⚠️ La carpeta events no existe.'
  );

}

// ==================================================
// INTERACCIONES
// ==================================================

client.on(

  Events.InteractionCreate,

  async interaction => {

    try {

      // ==================================================
      // SLASH COMMANDS
      // ==================================================

      if (
        interaction.isChatInputCommand()
      ) {

        const command =
          client.commands.get(
            interaction.commandName
          );

        if (!command) return;

        await command.execute(
          interaction,
          client
        );

      }

      // ==================================================
      // BOTON VERIFY
      // ==================================================

      else if (
        interaction.isButton()
      ) {

        if (
          interaction.customId ===
          'verify_void'
        ) {

          // EVITAR DOBLE RESPUESTA

          if (
            interaction.replied ||
            interaction.deferred
          ) return;

          // RESPUESTA INICIAL

          await interaction.deferReply({

            flags: 64

          });

          // ==================================================
          // ROL
          // ==================================================

          const role =
            interaction.guild.roles.cache.get(
              '1506900567199449179'
            );

          // ==================================================
          // VALIDAR ROL
          // ==================================================

          if (!role) {

            return await interaction.editReply({

              content:
                '❌ No se encontró el rol.'

            });

          }

          // ==================================================
          // SI YA TIENE EL ROL
          // ==================================================

          if (
            interaction.member.roles.cache.has(
              role.id
            )
          ) {

            return await interaction.editReply({

              content:
                '🌑 Ya has abrazado el vacío.'

            });

          }

          // ==================================================
          // AGREGAR ROL
          // ==================================================

          await interaction.member.roles.add(
            role
          );

          // ==================================================
          // RESPUESTA FINAL
          // ==================================================

          await interaction.editReply({

            content:
              '🌑 Has abrazado el vacío.'

          });

        }

      }

    } catch (error) {

      console.error(error);

      try {

        // ==================================================
        // SI YA RESPONDIO
        // ==================================================

        if (
          interaction.replied ||
          interaction.deferred
        ) {

          await interaction.followUp({

            content:
              '❌ Ocurrió un error.',

            flags: 64

          });

        }

        // ==================================================
        // SI NO RESPONDIO
        // ==================================================

        else {

          await interaction.reply({

            content:
              '❌ Ocurrió un error.',

            flags: 64

          });

        }

      } catch (err) {

        console.error(
          '❌ Error enviando mensaje de error.'
        );

      }

    }

  }

);

// ==================================================
// READY
// ==================================================

client.once(

  Events.ClientReady,

  readyClient => {

    console.log(
      `🤖 Bot conectado como ${readyClient.user.tag}`
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