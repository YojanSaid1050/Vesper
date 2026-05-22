const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

const enviarGoodbye = require('../functions/goodbyeEmbed');

module.exports = {
  name: Events.GuildMemberRemove,

  async execute(member) {

    // GOODBYE

    const goodbyeChannel = member.guild.channels.cache.get(
      config.goodbyeChannel
    );

    enviarGoodbye(member, goodbyeChannel);

    // LOG

    const logChannel = member.guild.channels.cache.get(
      config.logChannel
    );

    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setTitle('📤 Member Left')
      .setColor('#ED4245')

      .addFields(
        {
          name: '👤 Usuario',
          value: `${member.user.tag}`
        },

        {
          name: '🆔 ID',
          value: `${member.id}`
        }
      )

      .setThumbnail(member.user.displayAvatarURL())

      .setTimestamp();

    logChannel.send({
      embeds: [embed]
    });

  }
};