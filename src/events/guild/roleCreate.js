// roleCreate.js
const { Events, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado
const { createLog } = require('../../utils/logCache');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { buildMessage } = require('../../core/EmbedCatalog');

module.exports = {
  name: Events.GuildRoleCreate,
  async execute(role) {
    if (!createLog(`role-create-${role.id}`)) return;

    const guildConfig = await getGuildConfig(role.guild.id); // Añadir await
    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = role.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // Antes usaba logChannel.send directamente, así que este era el único
    // registro que NO respetaba el nombre ni el avatar configurados del bot.
    await sendBrandedMessage(logChannel, buildMessage('log_role_created', {
      config: guildConfig,
      vars: {
        role: `${role}`, roleName: role.name, roleId: role.id,
        server: role.guild.name, memberCount: role.guild.memberCount
      },
      defaults: { title: '🎭 Role Created', color: '#57F287' },
      fields: [
        { name: '🎭 Rol', value: `${role}` },
        { name: '🆔 ID', value: role.id }
      ]
    }));
  }
};