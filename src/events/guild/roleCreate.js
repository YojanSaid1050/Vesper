const { Events, EmbedBuilder } = require('discord.js');
const { getGeneralConfig } = require('../../database/guildManager');
const { createLog } = require('../../utils/logCache');

module.exports = {
  name: Events.GuildRoleCreate,
  async execute(role) {
    if (!createLog(`role-create-${role.id}`)) return;

    const general = getGeneralConfig(role.guild.id);
    const logChannel = role.guild.channels.cache.get(general.logChannel);
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