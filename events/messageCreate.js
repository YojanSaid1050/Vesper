const { Events } = require('discord.js');

const config = require('../config/config.json');

const enviarWelcome = require('../functions/welcomeEmbed');

const enviarGoodbye = require('../functions/goodbyeEmbed');

module.exports = {
  name: Events.MessageCreate,

  async execute(message) {

    if (message.author.bot) return;

    // TEST WELCOME

    if (message.content === '!testwelcome') {

      const canal = message.guild.channels.cache.get(
        config.welcomeChannel
      );

      enviarWelcome(message.member, canal);

    }

    // TEST GOODBYE

    if (message.content === '!testgoodbye') {

      const canal = message.guild.channels.cache.get(
        config.goodbyeChannel
      );

      enviarGoodbye(message.member, canal);

    }

  }
};