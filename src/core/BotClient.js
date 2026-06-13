const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { connectMongo } = require('../database/mongoManager');

class BotClient extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
      ]
    });

    this.commands = new Collection();
    this.cooldowns = new Collection();
    this.timers = {};
  }

  async initialize() {
    try {
      // Conectar a MongoDB
      await connectMongo();
      console.log('✅ MongoDB conectado');
      
      // Cargar comandos y eventos
      await this.loadCommands();
      await this.loadEvents();
      
      // Login del bot
      await this.login(process.env.TOKEN);
      
      console.log(`🤖 Bot ${this.user.tag} listo para usar`);
    } catch (error) {
      console.error('❌ Error inicializando el bot:', error);
      process.exit(1);
    }
  }

  async loadCommands() {
    const commandsPath = path.join(__dirname, '..', 'commands');
    if (!fs.existsSync(commandsPath)) {
      console.warn('⚠️ Directorio de comandos no encontrado');
      return;
    }

    const loadRecursive = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          loadRecursive(filePath);
        } else if (file.endsWith('.js')) {
          try {
            const command = require(filePath);
            if (command.data && command.execute) {
              this.commands.set(command.data.name, command);
              console.log(`✅ Comando cargado: ${command.data.name}`);
            } else {
              console.warn(`⚠️ Comando inválido en: ${file}`);
            }
          } catch (error) {
            console.error(`❌ Error cargando comando ${file}:`, error.message);
          }
        }
      }
    };

    loadRecursive(commandsPath);
    console.log(`📋 Total comandos: ${this.commands.size}`);
  }

  async loadEvents() {
    const eventsPath = path.join(__dirname, '..', 'events');
    if (!fs.existsSync(eventsPath)) {
      console.warn('⚠️ Directorio de eventos no encontrado');
      return;
    }

    const loadRecursive = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          loadRecursive(filePath);
        } else if (file.endsWith('.js')) {
          try {
            const event = require(filePath);
            if (event.name) {
              const handler = (...args) => event.execute(...args, this);
              
              if (event.once) {
                this.once(event.name, handler);
              } else {
                this.on(event.name, handler);
              }
              
              console.log(`✅ Evento cargado: ${event.name}`);
            } else {
              console.warn(`⚠️ Evento sin nombre en: ${file}`);
            }
          } catch (error) {
            console.error(`❌ Error cargando evento ${file}:`, error.message);
          }
        }
      }
    };

    loadRecursive(eventsPath);
    console.log(`📋 Eventos cargados correctamente`);
  }

  // Método para registrar comandos globalmente
  async registerCommands() {
    const commandsData = this.commands.map(cmd => cmd.data.toJSON());
    
    try {
      await this.application.commands.set(commandsData);
      console.log(`✅ ${commandsData.length} comandos registrados globalmente`);
    } catch (error) {
      console.error('❌ Error registrando comandos:', error);
    }
  }
}

module.exports = BotClient;