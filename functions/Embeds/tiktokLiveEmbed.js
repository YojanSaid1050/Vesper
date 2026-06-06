function buildTikTokLivePayload({
  username,
  nickname,
  viewers,
  title,
  cover,
  liveUrl
}) {

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
'# ☽✮˚.⋆༺ 𝐴 𝑙𝑖𝑣𝑒 𝑒𝑐ℎ𝑜 ℎ𝑎𝑠 𝑐𝑟𝑜𝑠𝑠𝑒𝑑 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 ༻⋆.˚✮☾'

          },

          {

            type: 14,

            spacing: 1

          },

          {

            type: 10,

            content:

`## ᯓᡣ𐭩 ${nickname} 𝒉𝒂𝒔 𝒓𝒆𝒔𝒐𝒏𝒂𝒕𝒆𝒅

**${title}**

𓆰♕𓆪 𝑬𝒄𝒉𝒐 𝑶𝒓𝒊𝒈𝒊𝒏: @${username}

𓆩ꨄ︎𓆪 𝑺𝒐𝒖𝒍𝒔 𝑳𝒊𝒔𝒕𝒆𝒏𝒊𝒏𝒈: ${viewers}

༺𓆩~~𝒄𝒂𝒏 𝒚𝒐𝒖 𝒉𝒆𝒂𝒓 𝒊𝒕 𝒃𝒆𝒚𝒐𝒏𝒅 𝒕𝒉𝒆 𝒔𝒌𝒚?~~𓆪༻`

          },

          ...(cover ? [

            {

              type: 12,

              items: [

                {

                  media: {

                    url: cover

                  }

                }

              ]

            }

          ] : []),

          {

            type: 1,

            components: [

              {

                type: 2,

                style: 5,

                label:
'☾ 𝑨𝒏𝒔𝒘𝒆𝒓 𝒕𝒉𝒆 𝑪𝒂𝒍𝒍',

                url: liveUrl

              }

            ]

          }

        ]

      }

    ]

  };

}

module.exports =
  buildTikTokLivePayload;

module.exports.buildTikTokLivePayload =
  buildTikTokLivePayload;