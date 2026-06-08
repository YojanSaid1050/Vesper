const { Events, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/guildManager');
const { sendBrandedMessage } = require('../../utils/webhookSender');

function buildGoodbyePayload(member) {
  return {
    flags: 32768,
    components: [{
      type: 17,
      accent_color: 0,
      spoiler: false,
      components: [
        {
          type: 10,
          content: '# ☾°.⋆༺ 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑐𝑙𝑎𝑖𝑚𝑠 𝑎𝑛𝑜𝑡ℎ𝑒𝑟 𝑠𝑜𝑢𝑙 ༻⋆.°☽'
        },
        { type: 14, spacing: 1 },
        {
          type: 10,
          content: `### 𝑭𝒂𝒓𝒆𝒘𝒆𝒍𝒍, ${member.user.username}...\n\n𝑨𝒏𝒐𝒕𝒉𝒆𝒓 𝒆𝒄𝒉𝒐 𝒇𝒂𝒍𝒍𝒔 𝒔𝒊𝒍𝒆𝒏𝒕.\n\n༺𓆩~~𝑀𝑎𝑦 𝑖𝑡𝑠 𝑒𝑚𝑏𝑒𝑟𝑠 𝑐𝑜𝑛𝑡𝑖𝑛𝑢𝑒 𝑡𝑜 𝑏𝑢𝑟𝑛 𝑏𝑒𝑦𝑜𝑛𝑑 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑.~~𓆪༻`
        },
        {
          type: 12,
          items: [{ media: { url: 'https://i.redd.it/vru2z0kl9uaf1.gif' } }]
        }
      ]
    }]
  };
}

async function sendGoodbye(member, canal) {
  return sendBrandedMessage(canal, buildGoodbyePayload(member));
}

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const guildConfig = getGuildConfig(member.guild.id);
    const general = guildConfig.general || {};

    const goodbyeChannel = member.guild.channels.cache.get(general.goodbyeChannel);
    if (goodbyeChannel) await sendGoodbye(member, goodbyeChannel);

    const logChannel = member.guild.channels.cache.get(general.logChannel);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle(member.user.bot ? '🤖 Bot Left' : '📤 Member Left')
        .setColor('#ED4245')
        .addFields(
          { name: member.user.bot ? '🤖 Bot' : '👤 Usuario', value: member.user.tag },
          { name: '🆔 ID', value: member.id }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();
      await sendBrandedMessage(logChannel, { embeds: [embed] });
    }
  },
  sendGoodbye,
  buildGoodbyePayload
};