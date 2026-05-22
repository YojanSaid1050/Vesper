const { Events } = require('discord.js');

const config = require('../config/config.json');

module.exports = {
  name: Events.MessageUpdate,

  async execute(oldMessage, newMessage) {

    if (!oldMessage.guild) return;

    if (oldMessage.author?.bot) return;

    if (oldMessage.content === newMessage.content) return;

    const canal = oldMessage.guild.channels.cache.get(config.logChannel);

    if (!canal) return;

    await canal.send({
      content:
`# ✏️ Message Edited

### 👤 Usuario
${oldMessage.author}

### 📍 Canal
${oldMessage.channel}

### 📝 Antes
${oldMessage.content || '*Vacío*'}

### 📝 Después
${newMessage.content || '*Vacío*'}`
    });

  }
};