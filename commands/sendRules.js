const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('sendrules')

    .setDescription(
      'Envía el panel de reglas'
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    const verifyButton =
      new ActionRowBuilder()

        .addComponents(

          new ButtonBuilder()

            .setCustomId(
              'verify_void'
            )

            .setLabel(
              'Embrace the Void'
            )

            .setEmoji({
              id: '1506908097472368680'
            })

            .setStyle(
              ButtonStyle.Secondary
            )

        );

    await interaction.channel.send({

      components: [

        {
          type: 17,
          accent_color: 16777215,

          components: [

            {
              type: 10,

              content:
'# ꧁𓊈𒆜𓆩༺ 𝑹𝒆𝒈𝒍𝒂𝒔 𝑫𝒆𝒍 𝑹𝒆𝒊𝒏𝒐 ༻𓆪𒆜𓊉꧂'
            },

            {
              type: 14,
              spacing: 2
            },

            {
              type: 10,

              content:
`𝑰. 𝑹𝒆𝒔𝒑𝒆𝒕𝒐 𝒂𝒏𝒕𝒆 𝒕𝒐𝒅𝒐
𝑇𝑟𝑎𝑡𝑎 𝑎 𝑡𝑜𝑑𝑜𝑠 𝑙𝑜𝑠 𝑚𝑖𝑒𝑚𝑏𝑟𝑜𝑠 𝑐𝑜𝑛 𝑟𝑒𝑠𝑝𝑒𝑡𝑜. 𝑁𝑜 𝑠𝑒 𝑡𝑜𝑙𝑒𝑟𝑎𝑟𝑎́𝑛 𝑖𝑛𝑠𝑢𝑙𝑡𝑜𝑠, 𝑎𝑐𝑜𝑠𝑜, 𝑑𝑖𝑠𝑐𝑟𝑖𝑚𝑖𝑛𝑎𝑐𝑖𝑜́𝑛 𝑛𝑖 𝑐𝑜𝑚𝑝𝑜𝑟𝑡𝑎𝑚𝑖𝑒𝑛𝑡𝑜𝑠 𝑡𝑜́𝑥𝑖𝑐𝑜𝑠.

𝑰𝑰. 𝑴𝒂𝒏𝒕𝒆́𝒏 𝒍𝒂 𝒑𝒂𝒛 𝒆𝒏𝒕𝒓𝒆 𝒍𝒐𝒔 𝒆𝒓𝒓𝒂𝒏𝒕𝒆𝒔
𝐿𝑎𝑠 𝑑𝑖𝑠𝑐𝑢𝑠𝑖𝑜𝑛𝑒𝑠 𝑠𝑜𝑛 𝑏𝑖𝑒𝑛𝑣𝑒𝑛𝑖𝑑𝑎𝑠, 𝑝𝑒𝑟𝑜 𝑙𝑜𝑠 𝑐𝑜𝑛𝑓𝑙𝑖𝑐𝑡𝑜𝑠 𝑝𝑒𝑟𝑠𝑜𝑛𝑎𝑙𝑒𝑠, 𝑝𝑟𝑜𝑣𝑜𝑐𝑎𝑐𝑖𝑜𝑛𝑒𝑠 𝑐𝑜𝑛𝑠𝑡𝑎𝑛𝑡𝑒𝑠 𝑜 𝑝𝑒𝑙𝑒𝑎𝑠 𝑑𝑒𝑏𝑒𝑟𝑎́𝑛 𝑟𝑒𝑠𝑜𝑙𝑣𝑒𝑟𝑠𝑒 𝑓𝑢𝑒𝑟𝑎 𝑑𝑒𝑙 𝑠𝑒𝑟𝑣𝑖𝑑𝑜𝑟.

𝑰𝑰𝑰. 𝑺𝒊𝒏 𝒄𝒐𝒏𝒕𝒆𝒏𝒊𝒅𝒐 𝒊𝒏𝒂𝒑𝒓𝒐𝒑𝒊𝒂𝒅𝒐
𝐸𝑠𝑡𝑎́ 𝑝𝑟𝑜ℎ𝑖𝑏𝑖𝑑𝑜 𝑐𝑜𝑚𝑝𝑎𝑟𝑡𝑖𝑟 𝑐𝑜𝑛𝑡𝑒𝑛𝑖𝑑𝑜 𝑖𝑙𝑒𝑔𝑎𝑙, 𝑒𝑥𝑝𝑙𝑖́𝑐𝑖𝑡𝑜, 𝑣𝑖𝑜𝑙𝑒𝑛𝑡𝑜 𝑒𝑛 𝑒𝑥𝑐𝑒𝑠𝑜 𝑜 𝑞𝑢𝑒 𝑖𝑛𝑐𝑢𝑚𝑝𝑙𝑎 𝑙𝑎𝑠 𝑛𝑜𝑟𝑚𝑎𝑠 𝑑𝑒 𝐷𝑖𝑠𝑐𝑜𝑟𝑑.

𝑰𝑽. 𝑵𝒐 𝒔𝒑𝒂𝒎 𝒏𝒊 𝒑𝒖𝒃𝒍𝒊𝒄𝒊𝒅𝒂𝒅
𝐸𝑣𝑖𝑡𝑎 𝑒𝑙 𝑠𝑝𝑎𝑚, 𝑓𝑙𝑜𝑜𝑑, 𝑐𝑎𝑑𝑒𝑛𝑎𝑠 𝑑𝑒 𝑚𝑒𝑛𝑠𝑎𝑗𝑒𝑠, 𝑚𝑒𝑛𝑐𝑖𝑜𝑛𝑒𝑠 𝑚𝑎𝑠𝑖𝑣𝑎𝑠 𝑜 𝑝𝑟𝑜𝑚𝑜𝑐𝑖𝑜𝑛𝑒𝑠 𝑠𝑖𝑛 𝑎𝑢𝑡𝑜𝑟𝑖𝑧𝑎𝑐𝑖𝑜́𝑛 𝑑𝑒𝑙 𝑒𝑞𝑢𝑖𝑝𝑜 𝑑𝑒 𝑚𝑜𝑑𝑒𝑟𝑎𝑐𝑖𝑜́𝑛.

𝑽. 𝑼𝒕𝒊𝒍𝒊𝒛𝒂 𝒍𝒐𝒔 𝒄𝒂𝒏𝒂𝒍𝒆𝒔 𝒄𝒐𝒓𝒓𝒆𝒄𝒕𝒂𝒎𝒆𝒏𝒕𝒆
𝐶𝑎𝑑𝑎 𝑟𝑖𝑛𝑐𝑜́𝑛 𝑑𝑒𝑙 𝑟𝑒𝑖𝑛𝑜 𝑡𝑖𝑒𝑛𝑒 𝑠𝑢 𝑝𝑟𝑜𝑝𝑜́𝑠𝑖𝑡𝑜. 𝑃𝑟𝑜𝑐𝑢𝑟𝑎 𝑝𝑢𝑏𝑙𝑖𝑐𝑎𝑟 𝑒𝑙 𝑐𝑜𝑛𝑡𝑒𝑛𝑖𝑑𝑜 𝑒𝑛 𝑒𝑙 𝑐𝑎𝑛𝑎𝑙 𝑐𝑜𝑟𝑟𝑒𝑠𝑝𝑜𝑛𝑑𝑖𝑒𝑛𝑡𝑒.

𝑽𝑰. 𝑹𝒆𝒔𝒑𝒆𝒕𝒂 𝒍𝒂𝒔 𝒅𝒆𝒄𝒊𝒔𝒊𝒐𝒏𝒆𝒔 𝒅𝒆𝒍 𝒆𝒒𝒖𝒊𝒑𝒐
𝐿𝑎𝑠 𝑑𝑒𝑐𝑖𝑠𝑖𝑜𝑛𝑒𝑠 𝑑𝑒 𝑚𝑜𝑑𝑒𝑟𝑎𝑑𝑜𝑟𝑒𝑠 𝑦 𝑎𝑑𝑚𝑖𝑛𝑖𝑠𝑡𝑟𝑎𝑑𝑜𝑟𝑒𝑠 𝑑𝑒𝑏𝑒𝑟𝑎́𝑛 𝑟𝑒𝑠𝑝𝑒𝑡𝑎𝑟𝑠𝑒.

𝑽𝑰𝑰. 𝑷𝒓𝒐𝒕𝒆𝒈𝒆 𝒕𝒖 𝒊𝒅𝒆𝒏𝒕𝒊𝒅𝒂𝒅
𝑁𝑜 𝑐𝑜𝑚𝑝𝑎𝑟𝑡𝑎𝑠 𝑖𝑛𝑓𝑜𝑟𝑚𝑎𝑐𝑖𝑜́𝑛 𝑝𝑒𝑟𝑠𝑜𝑛𝑎𝑙.

𝑽𝑰𝑰𝑰. 𝑴𝒂𝒏𝒕𝒆́𝒏 𝒖𝒏 𝒂𝒎𝒃𝒊𝒆𝒏𝒕𝒆 𝒂𝒈𝒓𝒂𝒅𝒂𝒃𝒍𝒆
𝑇𝑜𝑑𝑜𝑠 𝑒𝑠𝑡𝑎́𝑛 𝑎𝑞𝑢𝑖́ 𝑝𝑎𝑟𝑎 𝑑𝑖𝑠𝑓𝑟𝑢𝑡𝑎𝑟.

𝑰𝑿. 𝑳𝒐𝒔 𝒗𝒂𝒄𝒊́𝒐𝒔 𝒍𝒆𝒈𝒂𝒍𝒆𝒔 𝒏𝒐 𝒕𝒆 𝒔𝒂𝒍𝒗𝒂𝒓𝒂́𝒏
𝐼𝑛𝑡𝑒𝑛𝑡𝑎𝑟 𝑒𝑣𝑎𝑑𝑖𝑟 𝑙𝑎𝑠 𝑟𝑒𝑔𝑙𝑎𝑠 𝑠𝑒𝑟𝑎́ 𝑠𝑎𝑛𝑐𝑖𝑜𝑛𝑎𝑑𝑜.

𝑿. 𝑫𝒊𝒔𝒇𝒓𝒖𝒕𝒂 𝒅𝒆𝒍 𝒗𝒊𝒂𝒋𝒆
𝐻𝑎𝑧 𝑎𝑚𝑖𝑔𝑜𝑠, 𝑐𝑜𝑚𝑝𝑎𝑟𝑡𝑒 𝑡𝑢𝑠 ℎ𝑖𝑠𝑡𝑜𝑟𝑖𝑎𝑠, 𝑒𝑥𝑝𝑙𝑜𝑟𝑎 𝑛𝑢𝑒𝑣𝑜𝑠 𝑚𝑢𝑛𝑑𝑜𝑠 𝑦 𝑚𝑎𝑛𝑡𝑒́𝑛 𝑣𝑖𝑣𝑎 𝑙𝑎 𝑙𝑙𝑎𝑚𝑎.`
            },

            {
              type: 14,
              spacing: 2
            },

            {
              type: 10,

              content:
'“𝑇𝑜𝑑𝑜 𝑒𝑟𝑟𝑎𝑛𝑡𝑒 𝑑𝑒𝑏𝑒 𝑝𝑟𝑜𝑛𝑢𝑛𝑐𝑖𝑎𝑟 𝑠𝑢 𝑝𝑟𝑖𝑚𝑒𝑟 𝑗𝑢𝑟𝑎𝑚𝑒𝑛𝑡𝑜.”\n𝑉𝑒𝑟𝑖𝑓𝑖́𝑐𝑎𝑡𝑒 𝑝𝑎𝑟𝑎 𝑎𝑐𝑐𝑒𝑑𝑒𝑟 𝑎𝑙 𝑟𝑒𝑖𝑛𝑜. 🌑'
            },

            verifyButton.toJSON()

          ]
        }

      ]

    });

    await interaction.reply({

      content:
        '✅ Panel de reglas enviado.',

      flags: 64

    });

  }

};