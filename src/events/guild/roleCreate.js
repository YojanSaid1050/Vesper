// roleCreate.js
const { Events, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado
const { createLog } = require('../../utils/logCache');
const { publishAlert } = require('../../core/AlertRouter');

module.exports = {
  name: Events.GuildRoleCreate,
  async execute(role) {
    if (!createLog(`role-create-${role.id}`)) return;

    const guildConfig = await getGuildConfig(role.guild.id); // Añadir await

    // Antes usaba logChannel.send directamente, así que este era el único
    // registro que NO respetaba el nombre ni el avatar configurados del bot.
    await publishAlert(role.guild, guildConfig, 'log_role_created', {
      vars: {
        role: `${role}`, roleName: role.name, roleId: role.id,
        server: role.guild.name, memberCount: role.guild.memberCount
      },
      defaults: { title: '🎭 Rol creado', color: '#57F287' },
      fields: [
        { name: '🎭 Rol', value: `${role}` },
        { name: '🆔 ID', value: role.id }
      ]
    });
  }
};