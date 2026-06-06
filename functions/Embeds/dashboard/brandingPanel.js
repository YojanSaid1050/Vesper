const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const {
  getGuildConfig
} = require('../../../utils/guildManager');

module.exports = guildId => {

  const config =
    getGuildConfig(guildId);

  const branding =
    config.branding || {};

  const components = [

    // =========================
    // HEADER
    // =========================
    {
      type: 17,
      accent_color: 0x000000,
      spoiler: false,

      components: [

        {
          type: 10,
          content:
`# ⛧°. ⋆༺ 𝑇ℎ𝑒 𝐹𝑜𝑟𝑔𝑒 𝑜𝑓 𝐼𝑑𝑒𝑛𝑡𝑖𝑡𝑦 ༻⋆. °⛧`
        },

        {
          type: 14,
          spacing: 2
        },

        {
          type: 10,
          content:
`### 🎨 𝑩𝒓𝒂𝒏𝒅𝒊𝒏𝒈 𝑮𝒂𝒕𝒆𝒘𝒂𝒚

𝑻𝒉𝒆 𝒗𝒐𝒊𝒅 𝒔𝒉𝒂𝒑𝒆𝒔 𝒕𝒉𝒆 𝒑𝒆𝒓𝒔𝒐𝒏𝒂 𝒐𝒇 𝒚𝒐𝒖𝒓 𝒃𝒓𝒐𝒂𝒅𝒄𝒂𝒔𝒕.`
        },

        {
          type: 14,
          spacing: 2
        },

        {
          type: 10,
          content:
`📝 **𝑵𝒂𝒎𝒆**
${branding.name || '`No configurado`'}

🖼️ **𝑨𝒗𝒂𝒕𝒂𝒓**
${branding.avatar ? 'Configurado' : '`No configurado`'}`
        },

        // =========================
        // SOLO SI HAY AVATAR
        // =========================
        ...(branding.avatar
          ? [
              {
                type: 12,
                items: [
                  {
                    media: {
                      url: branding.avatar
                    }
                  }
                ]
              }
            ]
          : []),

        {
          type: 14,
          spacing: 2
        },

        {
          type: 10,
          content:
`⚙️ 𝑺𝒉𝒂𝒑𝒆 𝒕𝒉𝒆 𝒓𝒆𝒍𝒊𝒄`
        },

        // =========================
        // BOTONES NEGROS
        // =========================
        new ActionRowBuilder().addComponents(

          new ButtonBuilder()
            .setCustomId('branding_name')
            .setLabel('Nombre')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('branding_avatar')
            .setLabel('Avatar')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('branding_reset')
            .setLabel('Reset')
            .setStyle(ButtonStyle.Secondary)

        ).toJSON(),

        {
          type: 14,
          spacing: 2
        },

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

  ];

  return {
    flags: 32768,
    components
  };

};