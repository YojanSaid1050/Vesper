function buildTikTokVideoPayload(
  data,
  item
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
'# ☽✦˚.⋆༺ 𝐴 𝑛𝑒𝑤 𝑠𝑖𝑔𝑛𝑎𝑙 𝑟𝑒𝑎𝑐ℎ𝑒𝑠 𝑡ℎ𝑒 𝑠𝑡𝑎𝑟𝑠 ༻⋆.˚✦☾'

          },

          {

            type: 14,

            spacing: 1

          },

          {

            type: 10,

            content:

`## ᯓ⚝ ${data.nickname || data.username} 𝒉𝒂𝒔 𝒍𝒆𝒇𝒕 𝒂 𝒕𝒓𝒂𝒄𝒆

**${data.description || '𝐴 𝑓𝑜𝑟𝑔𝑜𝑡𝑡𝑒𝑛 𝑓𝑟𝑎𝑔𝑚𝑒𝑛𝑡 𝑑𝑟𝑖𝑓𝑡𝑠 𝑡ℎ𝑟𝑜𝑢𝑔ℎ 𝑡ℎ𝑒 𝑛𝑖𝑔ℎ𝑡 𝑠𝑘𝑦...'}**

𓆰✦𓆪 𝑺𝒊𝒈𝒏𝒂𝒍 𝑶𝒓𝒊𝒈𝒊𝒏
@${data.username}

𓆩☽𓆪 𝑺𝒕𝒂𝒓𝒔 𝑹𝒆𝒂𝒄𝒉𝒆𝒅
${item.playCount || 0}

𓆰✧𓆪 𝑹𝒆𝒔𝒐𝒏𝒂𝒏𝒄𝒆𝒔
${item.commentCount || 0}

༺𓆩~~𝒂𝒏𝒐𝒕𝒉𝒆𝒓 𝒎𝒆𝒎𝒐𝒓𝒚 𝒏𝒐𝒘 𝒔𝒉𝒊𝒏𝒆𝒔 𝒂𝒎𝒐𝒏𝒈 𝒕𝒉𝒆 𝒔𝒕𝒂𝒓𝒔~~𓆪༻`

          },

          {

            type: 12,

            items: [

              {

                media: {

                  url: data.thumbnail

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
'✦ 𝑹𝒆𝒂𝒄𝒉 𝒇𝒐𝒓 𝒕𝒉𝒆 𝑺𝒕𝒂𝒓𝒔',

                url: data.url

              }

            ]

          }

        ]

      }

    ]

  };

}

module.exports =
  buildTikTokVideoPayload;

module.exports.buildTikTokVideoPayload =
  buildTikTokVideoPayload;