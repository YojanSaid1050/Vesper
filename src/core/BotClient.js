const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

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
    await this.loadCommands();
    await this.loadEvents();
    await this.login(process.env.TOKEN);
  }

  async loadCommands() {
    const commandsPath = path.join(__dirname, '..', 'commands');
    if (!fs.existsSync(commandsPath)) return;

    const loadRecursive = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          loadRecursive(filePath);
        } else if (file.endsWith('.js')) {
          const command = require(filePath);
          if (command.data && command.execute) {
            this.commands.set(command.data.name, command);
            console.log(`Comando cargado: ${command.data.name}`);
          }
        }
      }
    };

    loadRecursive(commandsPath);
    console.log(`Total comandos: ${this.commands.size}`);
  }

  async loadEvents() {
    const eventsPath = path.join(__dirname, '..', 'events');
    if (!fs.existsSync(eventsPath)) return;

    const loadRecursive = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          loadRecursive(filePath);
        } else if (file.endsWith('.js')) {
          const event = require(filePath);
          const handler = (...args) => event.execute(...args, this);
          
          if (event.once) {
            this.once(event.name, handler);
          } else {
            this.on(event.name, handler);
          }
          
          console.log(`Evento cargado: ${event.name}`);
        }
      }
    };

    loadRecursive(eventsPath);
  }
}

module.exports = BotClient;