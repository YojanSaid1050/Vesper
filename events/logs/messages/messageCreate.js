const {
  Events,
  PermissionFlagsBits
} = require('discord.js');

const enviarWelcome =
  require('../../../functions/Embeds/welcomeEmbed');

const enviarGoodbye =
  require('../../../functions/Embeds/goodbyeEmbed');

const {
  getGuildConfig
} = require('../../../utils/guildManager');

module.exports = {

  name: Events.MessageCreate,

  async execute(message) {

    if (message.author.bot)
      return;

    const guildConfig =
      getGuildConfig(
        message.guild.id
      );

    if (

      message.content.startsWith('!test') &&

      !message.member.permissions.has(
        PermissionFlagsBits.Administrator
      )

    ) {

      return;

    }

    if (
      message.content === '!testwelcome'
    ) {

      const canal =
        message.guild.channels.cache.get(

          guildConfig.general
            .welcomeChannel

        );

      if (!canal)
        return;

      await enviarWelcome(
        message.member,
        canal
      );

    }

    if (
      message.content === '!testgoodbye'
    ) {

      const canal =
        message.guild.channels.cache.get(

          guildConfig.general
            .goodbyeChannel

        );

      if (!canal)
        return;

      await enviarGoodbye(
        message.member,
        canal
      );

    }

  }

};