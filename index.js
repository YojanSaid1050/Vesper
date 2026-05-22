require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
  Client,
  GatewayIntentBits
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

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
// CARGAR EVENTS
// =========================

const eventsPath = path.join(__dirname, 'events');

const eventFiles = fs.readdirSync(eventsPath);

for (const file of eventFiles) {

  const event = require(`./events/${file}`);

  if (event.once) {

    client.once(event.name, (...args) =>
      event.execute(...args)
    );

  } else {

    client.on(event.name, (...args) =>
      event.execute(...args)
    );

  }

}

client.login(process.env.TOKEN);