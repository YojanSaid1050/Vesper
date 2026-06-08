const { Events, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    if (message.content === '!testwelcome' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      const { sendWelcome } = require('./memberAdd');
      await sendWelcome(message.member, message.channel);
    }
    if (message.content === '!testgoodbye' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      const { sendGoodbye } = require('./memberRemove');
      await sendGoodbye(message.member, message.channel);
    }
  }
};