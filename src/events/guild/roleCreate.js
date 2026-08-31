// roleCreate.js
const { Events, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado
const { createLog } = require('../../utils/logCache');

module.exports = {
  name: Events.GuildRoleCreate,
  async execute(role) {
    if (!createLog(`role-create-${role.id}`)) return;

    const guildConfig = await getGuildConfig(role.guild.id); // Añadir await
    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = role.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setTitle('🎭 Role Created')
      .setColor('#57F287')
      .addFields(
        { name: '🎭 Rol', value: `${role}` },
        { name: '🆔 ID', value: role.id }
      )
      .setTimestamp();
    await logChannel.send({ embeds: [embed] });
  }
};