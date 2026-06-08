require('dotenv').config();
const express = require('express');
const BotClient = require('./core/BotClient');
const { startAllMonitors } = require('./platforms');
const { connectMongo } = require('./database/mongoManager');

const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web activa en puerto ${PORT}`));

// Variable para el cliente
let client = null;

// Función para iniciar el bot
async function startBot() {
  try {
    // Conectar a MongoDB primero
    await connectMongo();
    console.log('✅ Base de datos conectada');

    // Crear e iniciar el bot
    client = new BotClient();

    process.on('unhandledRejection', (error) => {
      console.error('❌ Unhandled Rejection:', error);
    });

    process.on('SIGINT', () => {
      console.log('🛑 Apagando bot...');
      for (const timer of Object.values(client.timers)) {
        if (timer) clearInterval(timer);
      }
      process.exit(0);
    });

    await client.initialize();
    startAllMonitors(client);
    
  } catch (error) {
    console.error('❌ Error iniciando el bot:', error);
    process.exit(1);
  }
}

// Iniciar todo
startBot();

module.exports = { getClient: () => client };