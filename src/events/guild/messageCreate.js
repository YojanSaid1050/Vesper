const { Events, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager');

// Pruebas rápidas desde el chat, para ver la bienvenida y la despedida tal y
// como salen de verdad.
const TESTS = {
  '!testwelcome': { module: './memberAdd', send: 'sendWelcome' },
  '!testgoodbye': { module: './memberRemove', send: 'sendGoodbye' }
};

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author?.bot || !message.guild) return;

    const test = TESTS[message.content?.trim()];
    if (!test) return;
    if (!message.member?.permissions?.has(PermissionFlagsBits.Administrator)) return;

    // Antes se llamaba sin la configuración del servidor, así que la prueba
    // enseñaba SIEMPRE el diseño de fábrica: el administrador personalizaba la
    // bienvenida desde el panel, la probaba aquí y creía que no se había
    // guardado.
    const config = await getGuildConfig(message.guild.id).catch(() => null);
    const sender = require(test.module)[test.send];

    try {
      await sender(message.member, message.channel, config);
    } catch (error) {
      await message.reply(`❌ No pude enviar la prueba: ${error.message}`).catch(() => null);
      return;
    }
    setTimeout(() => message.delete().catch(() => {}), 2000);
  }
};
