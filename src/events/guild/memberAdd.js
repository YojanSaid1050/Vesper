const { Events, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { resolveEmbedTemplate } = require('../../core/EmbedTemplateService');

// Diseño original de Embers Void. La ESTRUCTURA (contenedor V2, separador,
// tipografía y GIF) no cambia nunca: solo se pueden sustituir los textos, el
// color de acento y la imagen desde el panel web. Si no hay nada guardado, el
// resultado es idéntico carácter a carácter al de siempre.
const WELCOME_DEFAULT_TITLE = '# ⛧°. ⋆༺ 𝐴 𝑛𝑒𝑤 𝑤𝑎𝑛𝑑𝑒𝑟𝑒𝑟 ℎ𝑎𝑠 𝑎𝑟𝑟𝑖𝑣𝑒𝑑 ༻⋆. °⛧';
const WELCOME_DEFAULT_IMAGE = 'https://i.redd.it/gaoeixac0boe1.gif';
const WELCOME_DEFAULT_COLOR = 0xFFFFFF; // ⚪ BLANCO

function welcomeDefaultMessage(member) {
  return `### 𝑾𝒆𝒍𝒄𝒐𝒎𝒆 𝒕𝒐 𝑬𝒎𝒃𝒆𝒓𝒔 𝑽𝒐𝒊𝒅, ${member}!\n\n༺𓆩~~𝐿𝑒𝑡 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 𝑔𝑢𝑖𝑑𝑒 𝑦𝑜𝑢𝑟 𝑝𝑎𝑡ℎ.~~𓆪༻`;
}

function buildWelcomePayload(member, config = null) {
  const template = resolveEmbedTemplate(config, 'welcome', member, {
    title: WELCOME_DEFAULT_TITLE,
    message: welcomeDefaultMessage(member),
    color: WELCOME_DEFAULT_COLOR,
    image: WELCOME_DEFAULT_IMAGE
  });

  return {
    flags: 32768,
    components: [{
      type: 17,
      accent_color: template.color,
      spoiler: false,
      components: [
        {
          type: 10,
          content: template.title
        },
        { type: 14, spacing: 1 },
        {
          type: 10,
          content: template.message
        },
        {
          type: 12,
          items: [{ media: { url: template.image } }]
        }
      ]
    }]
  };
}

async function sendWelcome(member, canal, config = null) {
  return sendBrandedMessage(canal, buildWelcomePayload(member, config));
}

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const guildConfig = await getGuildConfig(member.guild.id); // Añadir await
    const general = guildConfig.general || {};

    if (member.user.bot) {
      const botRole = member.guild.roles.cache.get(general.botRole);
      if (botRole) await member.roles.add(botRole).catch(() => null);

      const botLogChannelId = general.botLogChannel;
      if (botLogChannelId) {
        const botLogChannel = member.guild.channels.cache.get(botLogChannelId);
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
    }

    const welcomeChannelId = general.welcomeChannel;
    if (welcomeChannelId) {
      const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
      if (welcomeChannel) await sendWelcome(member, welcomeChannel, guildConfig);
    }

    const logChannelId = general.logChannel;
    if (logChannelId) {
      const logChannel = member.guild.channels.cache.get(logChannelId);
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
    }
  },
  sendWelcome,
  buildWelcomePayload,
  WELCOME_DEFAULT_TITLE,
  WELCOME_DEFAULT_IMAGE,
  WELCOME_DEFAULT_COLOR,
  welcomeDefaultMessage
};