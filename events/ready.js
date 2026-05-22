const { ActivityType, Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,

  execute(client) {

    console.log(`✅ Conectado como ${client.user.tag}`);

    client.user.setPresence({
      activities: [
        {
          name: '🌑 the embers beyond the void',
          type: ActivityType.Custom
        }
      ],
      status: 'dnd'
    });

  }
};