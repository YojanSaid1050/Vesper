const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

const enviarWelcome = require('../functions/welcomeEmbed');

module.exports = {
  name: Events.GuildMemberAdd,

  async execute(member) {

    // WELCOME

    const welcomeChannel = member.guild.channels.cache.get(
      config.welcomeChannel
    );

    enviarWelcome(member, welcomeChannel);

    // LOG

    const logChannel = member.guild.channels.cache.get(
      config.logChannel
    );

    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setTitle('📥 Member Joined')
      .setColor('#57F287')

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