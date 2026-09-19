const { Events } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const {memberVars } = require('../../core/EmbedCatalog');
const { publishAlert } = require('../../core/AlertRouter');
const { createLog } = require('../../utils/logCache');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (!oldMessage.guild) return;
    // Si el mensaje anterior es parcial no sabemos qué decía: su `content` es
    // null y su autor, desconocido. Comparar contra eso registraba ediciones
    // que nunca ocurrieron —típicamente cuando Discord añade la vista previa
    // de un enlace a un mensaje que no está en caché— e incluso de bots.
    if (oldMessage.partial) return;
    if (oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const authorTag = oldMessage.author?.tag || newMessage.author?.tag || 'Usuario desconocido';

    const guildConfig = await getGuildConfig(oldMessage.guild.id); // Añadir await

    if (!createLog(`edit-${newMessage.id}`)) return;

    const before = oldMessage.content?.substring(0, 500) || '*Sin texto*';
    const after = newMessage.content?.substring(0, 500) || '*Sin texto*';
    await publishAlert(oldMessage.guild, guildConfig, 'log_message_edited', {
      vars: memberVars(newMessage.member || { user: newMessage.author, guild: newMessage.guild }, {
        userTag: authorTag, channel: `${oldMessage.channel}`,
        channelName: oldMessage.channel?.name || '', before, after
      })
    });
  }
};
