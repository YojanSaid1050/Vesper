const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
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
`# ⛧°. ⋆༺ 𝑇ℎ𝑒 𝑀𝑎𝑐ℎ𝑖𝑛𝑒 𝑂𝑓 𝑂𝑟𝑑𝑒𝑟 ༻⋆. °⛧`
          },

          {
            type: 14,
            spacing: 2
          },

          // INTRO
          {
            type: 10,
            content:
`### 🤖 𝑩𝒐𝒕 𝑪𝒐𝒓𝒆 𝑪𝒐𝒏𝒇𝒊𝒈𝒖𝒓𝒂𝒕𝒊𝒐𝒏

𝑻𝒉𝒆 𝒗𝒐𝒊𝒅 𝒈𝒊𝒗𝒆𝒔 𝒚𝒐𝒖 𝒄𝒐𝒏𝒕𝒓𝒐𝒍 𝒐𝒗𝒆𝒓 𝒕𝒉𝒆 𝒊𝒏𝒕𝒆𝒓𝒏𝒂𝒍 𝒔𝒆𝒓𝒗𝒂𝒏𝒕𝒔.`
          },

          {
            type: 14,
            spacing: 2
          },

          // STATUS
          {
            type: 10,
            content:
`🎭 **𝑹𝒐𝒍 𝒅𝒆 𝑩𝒐𝒕𝒔**
${config.general.botRole ? `<@&${config.general.botRole}>` : '`No configurado`'}

📜 **𝑳𝒐𝒈𝒔 𝒅𝒆 𝑩𝒐𝒕𝒔**
${config.general.botLogChannel ? `<#${config.general.botLogChannel}>` : '`No configurado`'}`
          },

          {
            type: 14,
            spacing: 2
          },

          // SELECT TITLE
          {
            type: 10,
            content:
`⚙️ 𝑪𝒐𝒏𝒇𝒊𝒈𝒖𝒓𝒂 𝒍𝒂 𝒎𝒂𝒒𝒖𝒊𝒏𝒂`
          },

          // ROLE SELECT
          new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
              .setCustomId('bot_role')
              .setPlaceholder('Seleccionar rol para bots')
              .setMinValues(1)
              .setMaxValues(1)
          ).toJSON(),

          // CHANNEL SELECT
          new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId('bot_log_channel')
              .setPlaceholder('Seleccionar canal de logs de bots')
              .addChannelTypes(ChannelType.GuildText)
              .setMinValues(1)
              .setMaxValues(1)
          ).toJSON(),

          {
            type: 14,
            spacing: 2
          },

          // BACK TEXT
          {
            type: 10,
            content:
`↩ 𝑅𝑒𝑡𝑢𝑟𝑛 𝑡𝑜 𝑡ℎ𝑒 𝑚𝑎𝑖𝑛 𝑝𝑜𝑟𝑡𝑎𝑙`
          },

          // BACK BUTTON
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