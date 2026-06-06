const { Events } = require('discord.js');

const updateDashboard =
  require('../../functions/dashboard/updateDashboard');

module.exports = {

  name: Events.ClientReady,

  once: true,

  async execute(client) {

    console.log(
      `✅ Conectado como ${client.user.tag}`
    );

    client.user.setPresence({

      activities: [

        {
          name: '𝑡ℎ𝑒 𝑒𝑚𝑏𝑒𝑟𝑠 𝑏𝑒𝑦𝑜𝑛𝑑 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑',
          type: 4
        }

      ],

      status: 'dnd'

    });

    // ==========================
    // ACTUALIZAR DASHBOARDS
    // ==========================

    await updateDashboard(
      client
    );

  }

};