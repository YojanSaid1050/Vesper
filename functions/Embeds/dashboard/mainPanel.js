const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

module.exports = () => {

  const row1 =
    new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId('dashboard_general')
        .setLabel('General')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('dashboard_bot')
        .setLabel('Automaton')
        .setEmoji('🤖')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('dashboard_branding')
        .setLabel('Forge')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Secondary)

    );

  const row2 =
    new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId('dashboard_tiktok')
        .setLabel('Echoes')
        .setEmoji('🎵')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('dashboard_twitch')
        .setLabel('Vigil')
        .setEmoji('🟣')
        .setStyle(ButtonStyle.Secondary)

    );

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
`# ⛧°. ⋆༺ 𝐶ℎ𝑟𝑜𝑛𝑖𝑐𝑙𝑒𝑠 𝑜𝑓 𝑡ℎ𝑒 𝑉𝑜𝑖𝑑 ༻⋆. °⛧`
          },

          {
            type: 14,
            spacing: 2
          },

          // INTRO
          {
            type: 10,
            content:
`### 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑤𝑎𝑡𝑐ℎ𝑒𝑠. 𝑇ℎ𝑒 𝑒𝑚𝑏𝑒𝑟𝑠 𝑟𝑒𝑐𝑜𝑟𝑑 𝑒𝑣𝑒𝑟𝑦 𝑐ℎ𝑜𝑖𝑐𝑒.

༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑐𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑖𝑛𝑔 𝑎 𝑏𝑜𝑡… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑠ℎ𝑎𝑝𝑖𝑛𝑔 𝑎 𝑟𝑒𝑙𝑖𝑐.~~𓆪༻`
          },

          {
            type: 14,
            spacing: 2
          },

          // SECTIONS
          {
            type: 10,
            content:
`📜 **𝐺𝑒𝑛𝑒𝑟𝑎𝑙**
𝑊𝑒𝑙𝑐𝑜𝑚𝑒𝑠, 𝑙𝑜𝑔𝑠 𝑎𝑛𝑑 𝑠𝑒𝑟𝑣𝑒𝑟 𝑠𝑡𝑟𝑢𝑐𝑡𝑢𝑟𝑒.`
          },

          {
            type: 10,
            content:
`🤖 **𝐴𝑢𝑡𝑜𝑚𝑎𝑡𝑜𝑛**
𝑇ℎ𝑒 𝑏𝑜𝑡’𝑠 𝑖𝑛𝑡𝑒𝑟𝑛𝑎𝑙 𝑚𝑎𝑐ℎ𝑖𝑛𝑒𝑟𝑦.`
          },

          {
            type: 10,
            content:
`🎨 **𝐹𝑜𝑟𝑔𝑒**
𝐼𝑑𝑒𝑛𝑡𝑖𝑡𝑦 𝑎𝑛𝑑 𝑏𝑟𝑎𝑛𝑑𝑖𝑛𝑔 𝑜𝑓 𝑡ℎ𝑒 𝑟𝑒𝑙𝑖𝑐.`
          },

          {
            type: 10,
            content:
`🎵 **𝐸𝑐ℎ𝑜𝑒𝑠**
𝑇𝑖𝑘𝑇𝑜𝑘 𝑚𝑜𝑛𝑖𝑡𝑜𝑟𝑖𝑛𝑔 𝑡ℎ𝑟𝑜𝑢𝑔ℎ 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑.`
          },

          {
            type: 10,
            content:
`🟣 **𝑉𝑖𝑔𝑖𝑙**
𝑇𝑤𝑖𝑡𝑐ℎ 𝑠𝑒𝑟𝑣𝑒𝑟 𝑤𝑎𝑡𝑐ℎ𝑒𝑟𝑠.`
          },

          {
            type: 14,
            spacing: 2
          },

          // CTA
          {
            type: 10,
            content:
`𝑆𝑒𝑙𝑒𝑐𝑡 𝑡ℎ𝑒 𝑠𝑒𝑐𝑡𝑖𝑜𝑛 𝑡ℎ𝑎𝑡 𝑐𝑎𝑙𝑙𝑠 𝑡𝑜 𝑦𝑜𝑢.`
          },

          // BUTTONS
          row1.toJSON(),
          row2.toJSON()

        ]

      }

    ]

  };

};