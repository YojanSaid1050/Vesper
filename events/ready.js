const { ActivityType } = require('discord.js');

module.exports = (client) => {

  console.log(`✅ Conectado como ${client.user.tag}`);

  client.user.setPresence({
    activities: [
      {
        name: '𝑡ℎ𝑒 𝑒𝑚𝑏𝑒𝑟𝑠 𝑏𝑒𝑦𝑜𝑛𝑑 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑',
        type: ActivityType.Watching
      }
    ],
    status: 'dnd'
  });

};