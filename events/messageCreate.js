const {
  Events,
  PermissionFlagsBits
} = require('discord.js');

const config = require('../config/config.json');

const enviarWelcome =
  require('../functions/Embeds/welcomeEmbed');

const enviarGoodbye =
  require('../functions/Embeds/goodbyeEmbed');

module.exports = {

  name: Events.MessageCreate,

  async execute(message) {

    // Ignorar bots
    if (message.author.bot) return;

    // Solo administradores pueden usar comandos de prueba
    if (
      message.content.startsWith('!test') &&
      !message.member.permissions.has(
        PermissionFlagsBits.Administrator
      )
    ) {
      return;
    }

    // ============================================
    // TEST WELCOME
    // ============================================

    if (message.content === '!testwelcome') {

      const canal =
        message.guild.channels.cache.get(
          config.welcomeChannel
        );

      if (!canal) return;

      await enviarWelcome(
        message.member,
        canal
      );

    }

    // ============================================
    // TEST GOODBYE
    // ============================================

    if (message.content === '!testgoodbye') {

      const canal =
        message.guild.channels.cache.get(
          config.goodbyeChannel
        );

      if (!canal) return;

      await enviarGoodbye(
        message.member,
        canal
      );

    }

  }

};