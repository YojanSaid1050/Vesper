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

module.exports = guildId => {

  const config =
    getGuildConfig(guildId);

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
`# ⛧°. ⋆༺ 𝑆𝑒𝑐𝑟𝑒𝑡𝑠 𝑜𝑓 𝑡ℎ𝑒 𝐺𝑎𝑡𝑒𝑤𝑎𝑦 ༻⋆. °⛧`
          },

          {
            type: 14,
            spacing: 2
          },

          // INTRO
          {
            type: 10,
            content:
`### 📢 𝑮𝒆𝒏𝒆𝒓𝒂𝒍 𝑺𝒚𝒔𝒕𝒆𝒎𝒔

𝑻𝒉𝒆 𝒗𝒐𝒊𝒅 𝒎𝒐𝒏𝒊𝒕𝒐𝒓𝒔 𝒆𝒗𝒆𝒓𝒚 𝒑𝒐𝒓𝒕𝒂𝒍 𝒐𝒇 𝒚𝒐𝒖𝒓 𝒔𝒆𝒓𝒗𝒆𝒓.`
          },

          {
            type: 14,
            spacing: 2
          },

          // STATUS TEXT
          {
            type: 10,
            content:
`👋 **𝑊𝑒𝑙𝑐𝑜𝑚𝑒**
${config.general.welcomeChannel ? `<#${config.general.welcomeChannel}>` : '`No configurado`'}

👋 **𝐺𝑜𝑜𝑑𝑏𝑦𝑒**
${config.general.goodbyeChannel ? `<#${config.general.goodbyeChannel}>` : '`No configurado`'}

📜 **𝐿𝑜𝑔𝑠**
${config.general.logChannel ? `<#${config.general.logChannel}>` : '`No configurado`'}`
          },

          {
            type: 14,
            spacing: 2
          },

          // SELECT MENUS TITLE
          {
            type: 10,
            content:
`⚙️ 𝑪𝒐𝒏𝒇𝒊𝒈𝒖𝒓𝒂 𝒍𝒐𝒔 𝒑𝒐𝒓𝒕𝒂𝒍𝒆𝒔`
          },

          // WELCOME SELECT
          new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId('general_welcome')
              .setPlaceholder('Seleccionar canal de bienvenida')
              .addChannelTypes(ChannelType.GuildText)
              .setMinValues(1)
              .setMaxValues(1)
          ).toJSON(),

          // GOODBYE SELECT
          new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId('general_goodbye')
              .setPlaceholder('Seleccionar canal de despedida')
              .addChannelTypes(ChannelType.GuildText)
              .setMinValues(1)
              .setMaxValues(1)
          ).toJSON(),

          // LOGS SELECT
          new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId('general_log')
              .setPlaceholder('Seleccionar canal de logs')
              .addChannelTypes(ChannelType.GuildText)
              .setMinValues(1)
              .setMaxValues(1)
          ).toJSON(),

          {
            type: 14,
            spacing: 2
          },

          // BACK BUTTON TEXT
          {
            type: 10,
            content:
`↩ 𝑅𝑒𝑡𝑢𝑟𝑛 𝑡𝑜 𝑡ℎ𝑒 𝑚𝑎𝑖𝑛 𝑝𝑜𝑟𝑡𝑎𝑙`
          },

          // BUTTON
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