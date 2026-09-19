const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const {memberVars } = require('../../core/EmbedCatalog');
const { publishAlert } = require('../../core/AlertRouter');
const { createLog } = require('../../utils/logCache');
const { quienLoHizo, SIN_DATO } = require('../../utils/auditLog');

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    if (!message.guild || message.author?.bot) return;

    // Discord puede emitir este evento con un mensaje parcial. En ese caso no
    // hay autor ni contenido disponibles, pero el registro no debe fallar.
    const authorTag = message.author?.tag || 'Usuario desconocido';

    const guildConfig = await getGuildConfig(message.guild.id); // Añadir await

    if (!createLog(`delete-${message.id}`)) return;

    // Si no aparece en la auditoría, lo normal es que lo borrara su propio
    // autor: Discord no registra eso.
    const enAuditoria = await quienLoHizo(message.guild, AuditLogEvent.MessageDelete, message.author?.id, {
      extraMatches: extra => !extra?.channel?.id || extra.channel.id === message.channelId
    });
    const deleter = enAuditoria === SIN_DATO ? `${authorTag} (lo borró él mismo)` : enAuditoria;

    const content = message.content?.substring(0, 1000) || '*Sin texto*';
    await publishAlert(message.guild, guildConfig, 'log_message_deleted', {
      vars: memberVars(message.member || { user: message.author, guild: message.guild }, {
        userTag: authorTag, executor: deleter,
        channel: `${message.channel}`, channelName: message.channel?.name || '', content
      }),
      defaults: { authorIconUrl: message.author?.displayAvatarURL?.() || null }
    });
  }
};
