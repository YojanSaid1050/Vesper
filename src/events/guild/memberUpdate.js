const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { sendBrandedMessage } = require('../../utils/webhookSender');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    const guildConfig = await getGuildConfig(newMember.guild.id); // Añadir await
    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = newMember.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      const embed = new EmbedBuilder()
        .setTitle('📝 Nickname Updated')
        .setColor('#00b0f4')
        .addFields(
          { name: '👤 Usuario', value: newMember.user.tag },
          { name: '📌 Antes', value: oldMember.nickname || 'Sin nickname', inline: true },
          { name: '📌 Después', value: newMember.nickname || 'Sin nickname', inline: true }
        )
        .setThumbnail(newMember.user.displayAvatarURL())
        .setTimestamp();
      await sendBrandedMessage(logChannel, { embeds: [embed] });
    }

    // Timeout changes
    if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
      let executor = 'Desconocido';
      let reason = 'Sin razón';
      try {
        const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
        const timeoutLog = fetchedLogs.entries.first();
        if (timeoutLog) {
          executor = timeoutLog.executor.tag;
          reason = timeoutLog.reason || 'Sin razón';
        }
      } catch {}

      if (newMember.communicationDisabledUntilTimestamp) {
        const timeoutDate = new Date(newMember.communicationDisabledUntilTimestamp);
        const embed = new EmbedBuilder()
          .setTitle('🔇 User Timed Out')
          .setColor('#ED4245')
          .addFields(
            { name: '👤 Usuario', value: newMember.user.tag },
            { name: '🛠️ Timeout por', value: executor },
            { name: '📅 Hasta', value: `<t:${Math.floor(timeoutDate.getTime() / 1000)}:F>` },
            { name: '📝 Razón', value: reason }
          )
          .setThumbnail(newMember.user.displayAvatarURL())
          .setTimestamp();
        await sendBrandedMessage(logChannel, { embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setTitle('🔊 Timeout Removed')
          .setColor('#57F287')
          .addFields(
            { name: '👤 Usuario', value: newMember.user.tag },
            { name: '🛠️ Removido por', value: executor }
          )
          .setThumbnail(newMember.user.displayAvatarURL())
          .setTimestamp();
        await sendBrandedMessage(logChannel, { embeds: [embed] });
      }
    }

    // Role added
    const addedRole = newMember.roles.cache.find(role => !oldMember.roles.cache.has(role.id));
    if (addedRole) {
      const embed = new EmbedBuilder()
        .setTitle('🎭 Role Added')
        .setColor('#57F287')
        .addFields(
          { name: '👤 Usuario', value: newMember.user.tag },
          { name: '🎭 Rol', value: `${addedRole}` }
        )
        .setTimestamp();
      await sendBrandedMessage(logChannel, { embeds: [embed] });
    }

    // Role removed
    const removedRole = oldMember.roles.cache.find(role => !newMember.roles.cache.has(role.id));
    if (removedRole) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Role Removed')
        .setColor('#ED4245')
        .addFields(
          { name: '👤 Usuario', value: newMember.user.tag },
          { name: '🎭 Rol', value: `${removedRole}` }
        )
        .setTimestamp();
      await sendBrandedMessage(logChannel, { embeds: [embed] });
    }
  }
};