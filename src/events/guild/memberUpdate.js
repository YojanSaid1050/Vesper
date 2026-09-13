const { Events, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { buildMessage, memberVars } = require('../../core/EmbedCatalog');
const { isModuleEnabledConfig } = require('../../config/guildPolicy');
const { findRecentAuditEntry, auditExecutor } = require('../../utils/auditLog');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    const guildConfig = await getGuildConfig(newMember.guild.id); // Añadir await

    // ------------------------------------------------------------------
    // Boost de Nitro. Discord lo expone como `premiumSince`: pasa de null a
    // una fecha cuando alguien mejora el servidor, y vuelve a null al
    // retirarlo. Se trata antes que los registros porque tiene su propio
    // canal y su propio módulo.
    // ------------------------------------------------------------------
    if (!oldMember.partial && oldMember.premiumSince !== newMember.premiumSince) {
      const started = Boolean(newMember.premiumSince);
      if (isModuleEnabledConfig(guildConfig, 'boosts')) {
        const boostChannelId = guildConfig.general?.boostChannel
          || (started ? guildConfig.general?.welcomeChannel : null)
          || guildConfig.general?.logChannel;
        const boostChannel = boostChannelId && newMember.guild.channels.cache.get(boostChannelId);
        if (boostChannel) {
          const vars = memberVars(newMember, {
            boostCount: newMember.guild.premiumSubscriptionCount ?? 0,
            boostLevel: newMember.guild.premiumTier ?? 0
          });
          await sendBrandedMessage(boostChannel, buildMessage(started ? 'boost_started' : 'boost_stopped', {
            config: guildConfig,
            vars,
            defaults: started
              ? {
                  title: '💜 ¡Gracias por el boost!',
                  message: '{user} acaba de mejorar **{server}**. Ya vamos por {boostCount} boosts (nivel {boostLevel}).',
                  color: '#F47FFF',
                  thumbnailUrl: newMember.user.displayAvatarURL()
                }
              : {
                  title: '💔 Boost retirado',
                  description: `${newMember.user.tag} dejó de mejorar el servidor. Quedan ${newMember.guild.premiumSubscriptionCount ?? 0} boosts.`,
                  color: '#747F8D',
                  thumbnailUrl: newMember.user.displayAvatarURL()
                }
          }));
        }
      }
    }

    const logChannelId = guildConfig.general?.logChannel;
    if (!logChannelId) return;

    const logChannel = newMember.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // Vesper usa Partials.GuildMember: `oldMember` puede llegar incompleto, con
    // la caché de roles vacía y el apodo a null aunque el miembro tuviera
    // ambos. Comparar contra eso inventa cambios que nunca ocurrieron — era la
    // causa del "🎭 Role Added" que aparecía al expulsar o eliminar un bot.
    // Si no se sabe qué había antes, no se registra nada.
    if (oldMember.partial) return;


    // Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      const before = oldMember.nickname || 'Sin nickname';
      const after = newMember.nickname || 'Sin nickname';
      await sendBrandedMessage(logChannel, buildMessage('log_nickname', {
        config: guildConfig,
        vars: memberVars(newMember, { before, after }),
        defaults: { title: '📝 Nickname Updated', color: '#00b0f4', thumbnailUrl: newMember.user.displayAvatarURL() },
        fields: [
          { name: '👤 Usuario', value: newMember.user.tag },
          { name: '📌 Antes', value: before, inline: true },
          { name: '📌 Después', value: after, inline: true }
        ]
      }));
    }

    // Timeout changes
    if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
      let executor = 'Desconocido';
      let reason = 'Sin razón';
      try {
        const timeoutLog = await findRecentAuditEntry(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
        if (timeoutLog) {
          executor = auditExecutor(timeoutLog);
          reason = timeoutLog.reason || 'Sin razón';
        }
      } catch {}

      if (newMember.communicationDisabledUntilTimestamp) {
        const timeoutDate = new Date(newMember.communicationDisabledUntilTimestamp);
        const until = `<t:${Math.floor(timeoutDate.getTime() / 1000)}:F>`;
        await sendBrandedMessage(logChannel, buildMessage('log_timeout_on', {
          config: guildConfig,
          vars: memberVars(newMember, { executor, until, reason }),
          defaults: { title: '🔇 User Timed Out', color: '#ED4245', thumbnailUrl: newMember.user.displayAvatarURL() },
          fields: [
            { name: '👤 Usuario', value: newMember.user.tag },
            { name: '🛠️ Timeout por', value: executor },
            { name: '📅 Hasta', value: until },
            { name: '📝 Razón', value: reason }
          ]
        }));
      } else {
        await sendBrandedMessage(logChannel, buildMessage('log_timeout_off', {
          config: guildConfig,
          vars: memberVars(newMember, { executor }),
          defaults: { title: '🔊 Timeout Removed', color: '#57F287', thumbnailUrl: newMember.user.displayAvatarURL() },
          fields: [
            { name: '👤 Usuario', value: newMember.user.tag },
            { name: '🛠️ Removido por', value: executor }
          ]
        }));
      }
    }

    // Cambios de roles
    const oldRoleIds = new Set(oldMember.roles.cache.keys());
    const newRoleIds = new Set(newMember.roles.cache.keys());

    const addedRoles = [...newMember.roles.cache.values()].filter(role => !oldRoleIds.has(role.id));
    const removedRoles = [...oldMember.roles.cache.values()].filter(role => !newRoleIds.has(role.id));

    // Antes solo se informaba del primer rol. Si alguien recibía tres roles a
    // la vez, los otros dos no aparecían en el registro.
    if (addedRoles.length) {
      const roles = addedRoles.map(role => `${role}`).join(', ').slice(0, 1024);
      await sendBrandedMessage(logChannel, buildMessage('log_roles_added', {
        config: guildConfig,
        vars: memberVars(newMember, { roles }),
        defaults: { title: addedRoles.length === 1 ? '🎭 Role Added' : '🎭 Roles Added', color: '#57F287' },
        fields: [
          { name: '👤 Usuario', value: newMember.user.tag },
          { name: addedRoles.length === 1 ? '🎭 Rol' : '🎭 Roles', value: roles }
        ]
      }));
    }

    if (removedRoles.length) {
      const roles = removedRoles.map(role => `${role}`).join(', ').slice(0, 1024);
      await sendBrandedMessage(logChannel, buildMessage('log_roles_removed', {
        config: guildConfig,
        vars: memberVars(newMember, { roles }),
        defaults: { title: removedRoles.length === 1 ? '❌ Role Removed' : '❌ Roles Removed', color: '#ED4245' },
        fields: [
          { name: '👤 Usuario', value: newMember.user.tag },
          { name: removedRoles.length === 1 ? '🎭 Rol' : '🎭 Roles', value: roles }
        ]
      }));
    }
  }
};
