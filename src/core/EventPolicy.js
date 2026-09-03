const { Events, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../database/mongoManager');
const { isApprovedGuild, isMainGuild, isModuleEnabledConfig } = require('../config/guildPolicy');
const { neutralWelcomePayload, neutralGoodbyePayload } = require('./PersonalityService');
const { sendBrandedMessage } = require('../utils/webhookSender');
const { handleMessage } = require('./ModerationService');

async function satelliteMemberAdd(member, config) {
  const general = config.general || {};
  if (member.user.bot) {
    const role = member.guild.roles.cache.get(general.botRole);
    if (role) await member.roles.add(role).catch(() => null);
  }
  if (isModuleEnabledConfig(config, 'welcome') && general.welcomeChannel) {
    const channel = member.guild.channels.cache.get(general.welcomeChannel);
    if (channel) await sendBrandedMessage(channel, neutralWelcomePayload(member));
  }
  if (isModuleEnabledConfig(config, 'logs') && general.logChannel) {
    const channel = member.guild.channels.cache.get(general.logChannel);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle(member.user.bot ? 'Bot añadido' : 'Miembro añadido')
        .setDescription(`${member.user.tag} (${member.id})`)
        .setColor(member.user.bot ? 0x5865F2 : 0x57F287)
        .setTimestamp();
      await sendBrandedMessage(channel, { embeds: [embed] });
    }
  }
}

async function satelliteMemberRemove(member, config) {
  const general = config.general || {};
  if (isModuleEnabledConfig(config, 'goodbye') && general.goodbyeChannel) {
    const channel = member.guild.channels.cache.get(general.goodbyeChannel);
    if (channel) await sendBrandedMessage(channel, neutralGoodbyePayload(member));
  }
  if (isModuleEnabledConfig(config, 'logs') && general.logChannel) {
    const channel = member.guild.channels.cache.get(general.logChannel);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle(member.user.bot ? 'Bot retirado' : 'Miembro retirado')
        .setDescription(`${member.user.tag} (${member.id})`)
        .setColor(0xED4245)
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

module.exports = { executeEventWithPolicy, satelliteMemberAdd, satelliteMemberRemove, mainMemberAdd, mainMemberRemove };
