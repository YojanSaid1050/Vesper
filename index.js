require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
  Client,
  GatewayIntentBits,
  Collection
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =========================
// COLLECTION DE COMANDOS
// =========================

client.commands = new Collection();

// =========================
// EXPRESS PARA RENDER
// =========================

const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Embers Void Bot Online');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Web activa en puerto ${PORT}`);
});

// =========================
// CARGAR COMANDOS
// =========================

const commandsPath =
  path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {

  const commandFiles =
    fs.readdirSync(commandsPath)
      .filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {

    const filePath =
      path.join(commandsPath, file);

    const command =
      require(filePath);

    if ('data' in command &&
        'execute' in command) {

      client.commands.set(
        command.data.name,
        command
      );

      console.log(
        `✅ Comando cargado: ${command.data.name}`
      );

    }

  }

}

// =========================
// CARGAR EVENTS
// =========================

const eventsPath =
  path.join(__dirname, 'events');

const eventFiles =
  fs.readdirSync(eventsPath)
    .filter(file => file.endsWith('.js'));

for (const file of eventFiles) {

  const filePath =
    path.join(eventsPath, file);

  const event =
    require(filePath);

  if (event.once) {

    client.once(
      event.name,
      (...args) =>
        event.execute(...args, client)
    );

  } else {

    client.on(
      event.name,
      (...args) =>
        event.execute(...args, client)
    );

  }

}

// =========================
// SLASH COMMANDS
// =========================

client.on(
  'interactionCreate',
  async interaction => {

    if (!interaction.isChatInputCommand())
      return;

    const command =
      client.commands.get(
        interaction.commandName
      );

    if (!command) return;

    try {

      await command.execute(
        interaction,
        client
      );

    } catch (error) {

      console.error(error);

      if (
        interaction.replied ||
        interaction.deferred
      ) {

        await interaction.followUp({
          content:
            '❌ Error ejecutando comando.',
          ephemeral: true
        });

      } else {

        await interaction.reply({
          content:
            '❌ Error ejecutando comando.',
          ephemeral: true
        });

      }

    }

  }
);

// =========================
// LOGIN
// =========================

client.login(process.env.TOKEN);