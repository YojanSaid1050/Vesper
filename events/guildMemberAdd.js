const {
  Events,
  EmbedBuilder
} = require('discord.js');

const config = require('../config/config.json');

const enviarWelcome = require('../functions/welcomeEmbed');

module.exports = {
  name: Events.GuildMemberAdd,

  async execute(member) {

    // =========================
    // SI ES BOT
    // =========================

    if (member.user.bot) {

      // AÑADIR ROL BOT

      const role = member.guild.roles.cache.get(
        config.botRole
      );

      if (role) {

        await member.roles.add(role)
          .catch(console.error);

      }

      // ENVIAR LOG BOT

      const botChannel = member.guild.channels.cache.get(
        config.botLogChannel
      );

      if (botChannel) {

        const embed = new EmbedBuilder()

          .setTitle('🤖 Bot Added')
          .setColor('#5865F2')

          .addFields(
            {
              name: '🤖 Bot',
              value: `${member.user.tag}`
            },

            {
              name: '🆔 ID',
              value: `${member.id}`
            },

            {
              name: '🎭 Rol añadido',
              value: `<@&${config.botRole}>`
            }
          )

          .setThumbnail(
            member.user.displayAvatarURL()
          )

          .setTimestamp();

        botChannel.send({
          embeds: [embed]
        });

      }

      return;
    }

    // =========================
    // WELCOME NORMAL
    // =========================

    const welcomeChannel = member.guild.channels.cache.get(
      config.welcomeChannel
    );

    enviarWelcome(member, welcomeChannel);

    // =========================
    // LOG NORMAL
    // =========================

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