const { Events, AuditLogEvent } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { memberVars } = require('../../core/EmbedCatalog');
const { publishAlert } = require('../../core/AlertRouter');
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
    // Se comparan las MARCAS DE TIEMPO, no `premiumSince`: ese getter fabrica
    // un Date nuevo en cada acceso, así que dos fechas iguales nunca son
    // `===` y el bot daba las gracias por el boost cada vez que el booster
    // cambiaba de rol o de apodo.
    if (!oldMember.partial && oldMember.premiumSinceTimestamp !== newMember.premiumSinceTimestamp) {
      const started = Boolean(newMember.premiumSince);
      const vars = memberVars(newMember, {
        boostCount: newMember.guild.premiumSubscriptionCount ?? 0,
        boostLevel: newMember.guild.premiumTier ?? 0
      });
      await publishAlert(newMember.guild, guildConfig, started ? 'boost_started' : 'boost_stopped', {
        vars,
        defaults: { thumbnailUrl: newMember.user.displayAvatarURL() }
      });
    }

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
      await publishAlert(newMember.guild, guildConfig, 'log_nickname', {
        vars: memberVars(newMember, { before, after }),
        defaults: { thumbnailUrl: newMember.user.displayAvatarURL() }
    });
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
        await publishAlert(newMember.guild, guildConfig, 'log_timeout_on', {
          vars: memberVars(newMember, { executor, until, reason }),
          defaults: { thumbnailUrl: newMember.user.displayAvatarURL() }
    });
      } else {
        await publishAlert(newMember.guild, guildConfig, 'log_timeout_off', {
          vars: memberVars(newMember, { executor }),
          defaults: { thumbnailUrl: newMember.user.displayAvatarURL() }
    });
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
      await publishAlert(newMember.guild, guildConfig, 'log_roles_added', {
        vars: memberVars(newMember, { roles })
    });
    }

    if (removedRoles.length) {
      const roles = removedRoles.map(role => `${role}`).join(', ').slice(0, 1024);
      await publishAlert(newMember.guild, guildConfig, 'log_roles_removed', {
        vars: memberVars(newMember, { roles })
    });
    }
  }
};
