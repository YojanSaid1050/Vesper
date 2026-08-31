const { Events, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    
    // Comando de prueba de bienvenida
    if (message.content === '!testwelcome' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      const { sendWelcome } = require('./memberAdd');
      await sendWelcome(message.member, message.channel);
      // Opcional: eliminar el mensaje de comando después de usarlo
      setTimeout(() => message.delete().catch(() => {}), 2000);
    }
    
    // Comando de prueba de despedida
    if (message.content === '!testgoodbye' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      const { sendGoodbye } = require('./memberRemove');
      await sendGoodbye(message.member, message.channel);
      // Opcional: eliminar el mensaje de comando después de usarlo
      setTimeout(() => message.delete().catch(() => {}), 2000);
    }
  }
};