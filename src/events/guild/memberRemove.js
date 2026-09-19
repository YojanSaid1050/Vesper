const { Events } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { resolveEmbedTemplate } = require('../../core/EmbedTemplateService');
const { classicFromTemplate } = require('../../core/EmbedLayouts');
const { memberVars } = require('../../core/EmbedCatalog');
const { publishAlert, resolveChannel, alertSettings } = require('../../core/AlertRouter');

// Mismo criterio que en memberAdd: la estructura del diseño es intocable y
// solo los textos, el color de acento y la imagen salen a la configuración.
const GOODBYE_DEFAULT_TITLE = '# ☾°.⋆༺ 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑐𝑙𝑎𝑖𝑚𝑠 𝑎𝑛𝑜𝑡ℎ𝑒𝑟 𝑠𝑜𝑢𝑙 ༻⋆.°☽';
const GOODBYE_DEFAULT_IMAGE = 'https://i.redd.it/vru2z0kl9uaf1.gif';
const GOODBYE_DEFAULT_COLOR = 0x000000; // ⚫ NEGRO

function goodbyeDefaultMessage(member) {
  return `### 𝑭𝒂𝒓𝒆𝒘𝒆𝒍𝒍, ${member.user.username}...\n\n𝑨𝒏𝒐𝒕𝒉𝒆𝒓 𝒆𝒄𝒉𝒐 𝒇𝒂𝒍𝒍𝒔 𝒔𝒊𝒍𝒆𝒏𝒕.\n\n༺𓆩~~𝑀𝑎𝑦 𝑖𝑡𝑠 𝑒𝑚𝑏𝑒𝑟𝑠 𝑐𝑜𝑛𝑡𝑖𝑛𝑢𝑒 𝑡𝑜 𝑏𝑢𝑟𝑛 𝑏𝑒𝑦𝑜𝑛𝑑 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑.~~𓆪༻`;
}

function buildGoodbyePayload(member, config = null) {
  const template = resolveEmbedTemplate(config, 'goodbye', member, {
    title: GOODBYE_DEFAULT_TITLE,
    message: goodbyeDefaultMessage(member),
    color: GOODBYE_DEFAULT_COLOR,
    image: GOODBYE_DEFAULT_IMAGE,
    layout: 'components_v2'
  });

  // Igual que en la bienvenida: el contenedor V2 es lo de siempre, y el embed
  // clásico solo aparece si se elige en el panel.
  if (template.layout === 'classic') return classicFromTemplate(template, member);

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

async function sendGoodbye(member, canal, config = null) {
  return sendBrandedMessage(canal, buildGoodbyePayload(member, config));
}

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const guildConfig = await getGuildConfig(member.guild.id); // Añadir await
    const general = guildConfig.general || {};

    const goodbyeChannel = resolveChannel(member.guild, guildConfig, 'goodbye');
    if (goodbyeChannel && alertSettings(guildConfig, 'goodbye').enabled) {
      await sendGoodbye(member, goodbyeChannel, guildConfig);
    }

    // Igual que en la entrada: este registro se construía a mano y era el
    // único que no se podía editar ni apagar desde el panel.
    await publishAlert(member.guild, guildConfig, member.user.bot ? 'log_bot_leave' : 'log_member_leave', {
      vars: memberVars(member),
      defaults: { thumbnailUrl: member.user.displayAvatarURL() }
    });
  },
  sendGoodbye,
  buildGoodbyePayload,
  GOODBYE_DEFAULT_TITLE,
  GOODBYE_DEFAULT_IMAGE,
  GOODBYE_DEFAULT_COLOR,
  goodbyeDefaultMessage
};