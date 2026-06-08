const { Events } = require('discord.js');
const { startAllMonitors } = require('../platforms');
const { updateDashboard } = require('../dashboard/updater');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Bot conectado como ${client.user.tag}`);

    client.user.setPresence({
      activities: [{ name: 'the embers beyond the void', type: 4 }],
      status: 'dnd'
    });

    await updateDashboard(client);
    startAllMonitors(client);
  }
};