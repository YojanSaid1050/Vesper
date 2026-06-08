require('dotenv').config();
const express = require('express');
const BotClient = require('./core/BotClient');
const { startAllMonitors } = require('./platforms');

const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web activa en puerto ${PORT}`));

const client = new BotClient();

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

process.on('SIGINT', () => {
  console.log('Apagando bot...');
  for (const timer of Object.values(client.timers)) {
    if (timer) clearInterval(timer);
  }
  process.exit(0);
});

client.initialize();

module.exports = client;