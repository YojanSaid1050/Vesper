require('dotenv').config();

const fs = require('fs');

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

// EXPRESS PARA RENDER

const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Embers Void Bot Online');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Web activa en puerto ${PORT}`);
});

// CARGAR EVENTS

const eventFiles = fs.readdirSync('./events');

for (const file of eventFiles) {

  const event = require(`./events/${file}`);

  const eventName = file.split('.')[0];

  client.on(eventName, (...args) => event(...args, client));

}

client.login(process.env.TOKEN);