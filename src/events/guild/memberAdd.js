const { Events, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/guildManager');
const { sendBrandedMessage } = require('../../utils/webhookSender');

function buildWelcomePayload(member) {
  return {
    flags: 32768,
    components: [{
      type: 17,
      accent_color: 16777215,
      spoiler: false,
      components: [
        {
          type: 10,
          content: '# ⛧°. ⋆༺ 𝐴 𝑛𝑒𝑤 𝑤𝑎𝑛𝑑𝑒𝑟𝑒𝑟 ℎ𝑎𝑠 𝑎𝑟𝑟𝑖𝑣𝑒𝑑 ༻⋆. °⛧'
        },
        { type: 14, spacing: 1 },
        {
          type: 10,
          content: `### 𝑾𝒆𝒍𝒄𝒐𝒎𝒆 𝒕𝒐 𝑬𝒎𝒃𝒆𝒓𝒔 𝑽𝒐𝒊𝒅, ${member}!\n\n༺𓆩~~𝐿𝑒𝑡 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 𝑔𝑢𝑖𝑑𝑒 𝑦𝑜𝑢𝑟 𝑝𝑎𝑡ℎ.~~𓆪༻`
        },
        {
          type: 12,
          items: [{ media: { url: 'https://i.redd.it/gaoeixac0boe1.gif' } }]
        }
      ]
    }]
  };
}

async function sendWelcome(member, canal) {
  return sendBrandedMessage(canal, buildWelcomePayload(member));
}

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const guildConfig = getGuildConfig(member.guild.id);
    const general = guildConfig.general || {};

    if (member.user.bot) {
      const botRole = member.guild.roles.cache.get(general.botRole);
      if (botRole) await member.roles.add(botRole).catch(() => null);

      const botLogChannel = member.guild.channels.cache.get(general.botLogChannel);
      if (botLogChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🤖 Bot Added')
          .setColor('#5865F2')
          .addFields(
            { name: '🤖 Bot', value: member.user.tag },
            { name: '🆔 ID', value: member.id },
            { name: '🎭 Rol añadido', value: botRole ? `<@&${general.botRole}>` : 'No configurado' }
          )
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();
        await sendBrandedMessage(botLogChannel, { embeds: [embed] });
      }
    }

    const welcomeChannel = member.guild.channels.cache.get(general.welcomeChannel);
    if (welcomeChannel) await sendWelcome(member, welcomeChannel);

    const logChannel = member.guild.channels.cache.get(general.logChannel);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle(member.user.bot ? '🤖 Bot Joined' : '📥 Member Joined')
        .setColor(member.user.bot ? '#5865F2' : '#57F287')
        .addFields(
          { name: member.user.bot ? '🤖 Bot' : '👤 Usuario', value: member.user.tag },
          { name: '🆔 ID', value: member.id }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();
      await sendBrandedMessage(logChannel, { embeds: [embed] });
    }
  },
  sendWelcome,
  buildWelcomePayload
};