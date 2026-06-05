module.exports = ({
  streamer,
  title,
  game,
  viewers,
  thumbnail,
  streamUrl
}) => {

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
'# ✧°.⋆༺ 𝐴𝑛 𝑒𝑐ℎ𝑜 𝑐𝑎𝑙𝑙𝑠 𝑓𝑟𝑜𝑚 𝑏𝑒𝑦𝑜𝑛𝑑 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 ༻⋆.°✧'

          },

          {

            type: 14,

            spacing: 1

          },

          {

            type: 10,

            content:

`## ꒰ঌ ${streamer} 𝒉𝒂𝒔 𝒂𝒘𝒂𝒌𝒆𝒏𝒆𝒅

**${title}**

𓆰♕𓆪 𝑹𝒆𝒂𝒍𝒎: ${game || 'Unknown'}

𓆩ꨄ︎𓆪 𝑺𝒐𝒖𝒍𝒔 𝑾𝒂𝒕𝒄𝒉𝒊𝒏𝒈: ${viewers}

༺𓆩~~𝒂 𝒇𝒐𝒓𝒈𝒐𝒕𝒕𝒆𝒏 𝒆𝒎𝒃𝒆𝒓 𝒈𝒍𝒐𝒘𝒔 𝒐𝒏𝒄𝒆 𝒂𝒈𝒂𝒊𝒏~~𓆪༻`

          },

          {

            type: 12,

            items: [

              {

                media: {

                  url: thumbnail

                }

              }

            ]

          },

          {

            type: 1,

            components: [

              {

                type: 2,

                style: 5,

                label:
                  '☾ 𝑬𝒏𝒕𝒆𝒓 𝒕𝒉𝒆 𝒂𝒃𝒚𝒔𝒔',

                url:
                  streamUrl

              }

            ]

          }

        ]

      }

    ]

  };

};