const { Events, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../database/mongoManager');
const { isApprovedGuild, isMainGuild, isThemedMainGuild, isModuleEnabledConfig } = require('../config/guildPolicy');
const { neutralWelcomePayload, neutralGoodbyePayload, themedWelcomePayload, themedGoodbyePayload, colorNumber } = require('./PersonalityService');
const { sendBrandedMessage } = require('../utils/webhookSender');
const { handleMessage } = require('./ModerationService');

const LOG_EVENTS = new Set([
  Events.MessageDelete,
  Events.MessageUpdate,
  Events.GuildMemberUpdate,
  Events.ChannelCreate,
  Events.ChannelDelete,
  Events.GuildRoleCreate,
  Events.GuildRoleDelete,
  Events.GuildBanAdd,
  Events.GuildBanRemove,
  Events.VoiceStateUpdate
]);

function requiredModuleForEvent(eventName) {
  return LOG_EVENTS.has(eventName) ? 'logs' : null;
}

async function satelliteMemberAdd(member, config) {
  const general = config.general || {};
  const themed = isThemedMainGuild(member.guild.id);
  if (member.user.bot) {
    const role = member.guild.roles.cache.get(general.botRole);
    if (role) await member.roles.add(role).catch(() => null);
  } else if (themed && config.profile?.memberRole) {
    const memberRole = member.guild.roles.cache.get(config.profile.memberRole);
    if (memberRole) await member.roles.add(memberRole).catch(() => null);
  }
  if (isModuleEnabledConfig(config, 'welcome') && general.welcomeChannel) {
    const channel = member.guild.channels.cache.get(general.welcomeChannel);
    if (channel) await sendBrandedMessage(channel, themed ? themedWelcomePayload(member, config.profile) : neutralWelcomePayload(member));
  }
  if (isModuleEnabledConfig(config, 'logs') && general.logChannel) {
    const channel = member.guild.channels.cache.get(general.logChannel);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle(member.user.bot ? 'Bot añadido' : 'Miembro añadido')
        .setDescription(`${member.user.tag} (${member.id})`)
        .setColor(member.user.bot ? 0x5865F2 : themed ? colorNumber(config.profile?.primaryColor, 0x8DDCF4) : 0x57F287)
        .setTimestamp();
      await sendBrandedMessage(channel, { embeds: [embed] });
    }
  }
}

async function satelliteMemberRemove(member, config) {
  const general = config.general || {};
  const themed = isThemedMainGuild(member.guild.id);
  if (isModuleEnabledConfig(config, 'goodbye') && general.goodbyeChannel) {
    const channel = member.guild.channels.cache.get(general.goodbyeChannel);
    if (channel) await sendBrandedMessage(channel, themed ? themedGoodbyePayload(member, config.profile) : neutralGoodbyePayload(member));
  }
  if (isModuleEnabledConfig(config, 'logs') && general.logChannel) {
    const channel = member.guild.channels.cache.get(general.logChannel);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle(member.user.bot ? 'Bot retirado' : 'Miembro retirado')
        .setDescription(`${member.user.tag} (${member.id})`)
        .setColor(themed ? colorNumber(config.profile?.secondaryColor, 0xF8C8DC) : 0xED4245)
        .setTimestamp();
      await sendBrandedMessage(channel, { embeds: [embed] });
    }
  }
}

async function mainMemberAdd(member, config) {
  const general = config.general || {};
  if (member.user.bot) {
    const role = member.guild.roles.cache.get(general.botRole);
    if (role) await member.roles.add(role).catch(() => null);
    if (isModuleEnabledConfig(config, 'logs') && general.botLogChannel) {
      const channel = member.guild.channels.cache.get(general.botLogChannel);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('🤖 Bot Added')
          .setColor('#5865F2')
          .addFields(
            { name: '🤖 Bot', value: member.user.tag },
            { name: '🆔 ID', value: member.id },
            { name: '🎭 Rol añadido', value: role ? `<@&${general.botRole}>` : 'No configurado' }
          )
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();
        await sendBrandedMessage(channel, { embeds: [embed] });
      }
    }
  }
  if (isModuleEnabledConfig(config, 'welcome') && general.welcomeChannel) {
    const channel = member.guild.channels.cache.get(general.welcomeChannel);
    if (channel) {
      const { sendWelcome } = require('../events/guild/memberAdd');
      await sendWelcome(member, channel);
    }
  }
  if (isModuleEnabledConfig(config, 'logs') && general.logChannel) {
    const channel = member.guild.channels.cache.get(general.logChannel);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle(member.user.bot ? '🤖 Bot Joined' : '📥 Member Joined')
        .setColor(member.user.bot ? '#5865F2' : '#57F287')
        .addFields(
          { name: member.user.bot ? '🤖 Bot' : '👤 Usuario', value: member.user.tag },
          { name: '🆔 ID', value: member.id }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();
      await sendBrandedMessage(channel, { embeds: [embed] });
    }
  }
}

async function mainMemberRemove(member, config) {
  const general = config.general || {};
  if (isModuleEnabledConfig(config, 'goodbye') && general.goodbyeChannel) {
    const channel = member.guild.channels.cache.get(general.goodbyeChannel);
    if (channel) {
      const { sendGoodbye } = require('../events/guild/memberRemove');
      await sendGoodbye(member, channel);
    }
  }
  if (isModuleEnabledConfig(config, 'logs') && general.logChannel) {
    const channel = member.guild.channels.cache.get(general.logChannel);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle(member.user.bot ? '🤖 Bot Left' : '📤 Member Left')
        .setColor('#ED4245')
        .addFields(
          { name: member.user.bot ? '🤖 Bot' : '👤 Usuario', value: member.user.tag },
          { name: '🆔 ID', value: member.id }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();
      await sendBrandedMessage(channel, { embeds: [embed] });
    }
  }
}

async function executeEventWithPolicy(event, args, client) {
  const subject = args[0];
  const guildId = subject?.guildId || subject?.guild?.id || subject?.guild_id;
  if (guildId && !isApprovedGuild(guildId)) return;

  const requiredModule = requiredModuleForEvent(event.name);
  if (guildId && requiredModule) {
    const config = await getGuildConfig(guildId);
    if (!isModuleEnabledConfig(config, requiredModule)) return;
  }

  if (event.name === Events.MessageCreate && guildId) {
    const handled = await handleMessage(subject);
    if (handled || !isMainGuild(guildId)) return;
  }

  if ((event.name === Events.GuildMemberAdd || event.name === Events.GuildMemberRemove) && guildId) {
    const config = await getGuildConfig(guildId);
    if (!isMainGuild(guildId)) {
      if (event.name === Events.GuildMemberAdd) return satelliteMemberAdd(subject, config);
      return satelliteMemberRemove(subject, config);
    }
    if (event.name === Events.GuildMemberAdd) return mainMemberAdd(subject, config);
    return mainMemberRemove(subject, config);
  }

  return event.execute(...args, client);
}

module.exports = { LOG_EVENTS, requiredModuleForEvent, executeEventWithPolicy, satelliteMemberAdd, satelliteMemberRemove, mainMemberAdd, mainMemberRemove };
