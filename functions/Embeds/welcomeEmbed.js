const {
  sendBrandedMessage
} = require('../../utils/webhookSender');

function buildWelcomePayload(
  member
) {

  return {

    flags: 32768,

    components: [

      {

        type: 17,

        accent_color: 16777215,

        spoiler: false,

        components: [

          {

            type: 10,

            content:
'# ⛧°. ⋆༺ 𝐴 𝑛𝑒𝑤 𝑤𝑎𝑛𝑑𝑒𝑟𝑒𝑟 ℎ𝑎𝑠 𝑎𝑟𝑟𝑖𝑣𝑒𝑑 ༻⋆. °⛧'

          },

          {

            type: 14,

            spacing: 1

          },

          {

            type: 10,

            content:
`### 𝑾𝒆𝒍𝒄𝒐𝒎𝒆 𝒕𝒐 𝑬𝒎𝒃𝒆𝒓𝒔 𝑽𝒐𝒊𝒅, ${member}!

༺𓆩~~𝐿𝑒𝑡 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 𝑔𝑢𝑖𝑑𝑒 𝑦𝑜𝑢𝑟 𝑝𝑎𝑡ℎ.~~𓆪༻`

          },

          {

            type: 12,

            items: [

              {

                media: {

                  url:
'https://i.redd.it/gaoeixac0boe1.gif'

                }

              }

            ]

          }

        ]

      }

    ]

  };

}

async function sendWelcome(
  member,
  canal
) {

  return sendBrandedMessage(

    canal,

    buildWelcomePayload(
      member
    )

  );

}

module.exports =
  sendWelcome;

module.exports.buildWelcomePayload =
  buildWelcomePayload;