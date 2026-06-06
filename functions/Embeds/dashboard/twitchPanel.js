const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType
} = require('discord.js');

const {
  getGuildConfig
} = require('../../../utils/guildManager');

module.exports = (guildId) => {

  const config = getGuildConfig(guildId) || {};

  const twitch = config.twitch || {};
  const users = Array.isArray(twitch.users) ? twitch.users : [];
  const showUsers = twitch.showUsers ?? false;
  const liveChannel = twitch.liveChannel || null;

  return {

    flags: 32768,

    components: [

      {
        type: 17,
        accent_color: 0x000000,
        spoiler: false,

        components: [

          // HEADER
          {
            type: 10,
            content:
`# ⛧°. ⋆༺ 𝑉𝑖𝑔𝑖𝑙 𝑜𝑓 𝑇𝑤𝑖𝑡𝑐ℎ ༻⋆. °⛧`
          },

          { type: 14, spacing: 2 },

          // INTRO
          {
            type: 10,
            content:
`### 🟣 𝑇𝑤𝑖𝑡𝑐ℎ 𝑆𝑦𝑠𝑡𝑒𝑚𝑠

𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑤𝑎𝑡𝑐ℎ𝑒𝑠 𝑒𝑣𝑒𝑟𝑦 𝑠𝑡𝑟𝑒𝑎𝑚 𝑏𝑒𝑓𝑜𝑟𝑒 𝑖𝑡 𝑠𝑝𝑎𝑤𝑛𝑠.`
          },

          { type: 14, spacing: 2 },

          // STATUS
          {
            type: 10,
            content:
`📢 **𝑆𝑡𝑟𝑒𝑎𝑚 𝐶ℎ𝑎𝑛𝑛𝑒𝑙**
${liveChannel ? `<#${liveChannel}>` : '`No configurado`'}

👥 **𝑅𝑒𝑔𝑖𝑠𝑡𝑒𝑟𝑒𝑑 𝑆𝑡𝑟𝑒𝑎𝑚𝑒𝑟𝑠**
${users.length}`
          },

          { type: 14, spacing: 2 },

          // LISTA CONDICIONAL
          ...(showUsers ? [
            {
              type: 10,
              content:
`📋 **𝑳𝒊𝒔𝒕𝒂 𝒅𝒆 𝑺𝒕𝒓𝒆𝒂𝒎𝒆𝒓𝒔**

${
  users.length
    ? users.map(u => `• ${u}`).join('\n')
    : '`No hay streamers registrados`'
}`
            },
            { type: 14, spacing: 2 }
          ] : []),

          // TITLE
          {
            type: 10,
            content:
`⚙️ 𝑪𝒐𝒏𝒇𝒊𝒈𝒖𝒓𝒆 𝒕𝒉𝒆 𝒗𝒊𝒈𝒊𝒍`
          },

          // CHANNEL SELECT
          new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId('twitch_live_channel')
              .setPlaceholder('Seleccionar canal de streams')
              .addChannelTypes(ChannelType.GuildText)
              .setMinValues(1)
              .setMaxValues(1)
          ).toJSON(),

          { type: 14, spacing: 2 },

          // ACTION TITLE
          {
            type: 10,
            content:
`👁️ 𝑆𝑡𝑟𝑒𝑎𝑚𝑒𝑟 𝑀𝑎𝑛𝑎𝑔𝑒𝑚𝑒𝑛𝑡`
          },

          // BUTTONS
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('twitch_add_user')
              .setLabel('Añadir')
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('twitch_remove_user')
              .setLabel('Eliminar')
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('twitch_list_users')
              .setLabel(showUsers ? 'Ocultar' : 'Ver')
              .setStyle(ButtonStyle.Secondary),

            // 🔥 FIX CRÍTICO AQUÍ
            new ButtonBuilder()
              .setCustomId('twitch_clear_all_users')
              .setLabel('Borrar todo')
              .setStyle(ButtonStyle.Danger)
          ).toJSON(),

          { type: 14, spacing: 2 },

          // BACK
          {
            type: 10,
            content:
`↩ 𝑅𝑒𝑡𝑢𝑟𝑛 𝑡𝑜 𝑡ℎ𝑒 𝑚𝑎𝑖𝑛 𝑝𝑜𝑟𝑡𝑎𝑙`
          },

          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('dashboard_home')
              .setLabel('Volver')
              .setStyle(ButtonStyle.Secondary)
          ).toJSON()

        ]

      }

    ]

  };
};