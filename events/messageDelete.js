const { Events } = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.MessageDelete,

  async execute(message) {

    if (!message.guild) return;

    if (message.author?.bot) return;

    const canal = message.guild.channels.cache.get(config.logChannel);

    if (!canal) return;

    await canal.send({
      content:
`# 🗑️ Message Deleted

### 👤 Usuario
${message.author}

### 📍 Canal
${message.channel}

### 💬 Contenido
${message.content || '*Sin texto*'}`
    });

  }
};