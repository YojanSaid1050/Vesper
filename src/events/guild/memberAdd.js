const { Events } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { resolveEmbedTemplate } = require('../../core/EmbedTemplateService');
const { classicFromTemplate } = require('../../core/EmbedLayouts');
const { memberVars } = require('../../core/EmbedCatalog');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { publishAlert, resolveChannel, alertSettings } = require('../../core/AlertRouter');

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
    image: WELCOME_DEFAULT_IMAGE,
    layout: 'components_v2'
  });

  // Si el administrador eligió el embed clásico en el panel, se publica con
  // esa forma. Mientras no lo elija, sale el contenedor V2 de siempre, igual
  // carácter a carácter.
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

async function sendWelcome(member, canal, config = null) {
  return sendBrandedMessage(canal, buildWelcomePayload(member, config));
}

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const guildConfig = await getGuildConfig(member.guild.id); // Añadir await
    const general = guildConfig.general || {};

    // Estos dos registros construían su embed a mano, saltándose el catálogo:
    // por eso eran los únicos que no se podían editar desde el panel. Ahora
    // pasan por el enrutador, como todos los demás.
    if (member.user.bot) {
      const botRole = member.guild.roles.cache.get(general.botRole);
      if (botRole) await member.roles.add(botRole).catch(() => null);

      await publishAlert(member.guild, guildConfig, 'log_bot_join', {
        vars: memberVars(member, { role: botRole ? `${botRole}` : 'ninguno', roleName: botRole?.name || 'ninguno' }),
        defaults: { thumbnailUrl: member.user.displayAvatarURL() }
    });
    }

    const welcomeChannel = resolveChannel(member.guild, guildConfig, 'welcome');
    if (welcomeChannel && alertSettings(guildConfig, 'welcome').enabled) {
      await sendWelcome(member, welcomeChannel, guildConfig);
    }

    await publishAlert(member.guild, guildConfig, member.user.bot ? 'log_bot_join' : 'log_member_join', {
      vars: memberVars(member),
      defaults: { thumbnailUrl: member.user.displayAvatarURL() }
    });
  },
  sendWelcome,
  buildWelcomePayload,
  WELCOME_DEFAULT_TITLE,
  WELCOME_DEFAULT_IMAGE,
  WELCOME_DEFAULT_COLOR,
  welcomeDefaultMessage
};