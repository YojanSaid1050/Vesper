module.exports = async (member, canal) => {

  await canal.send({
    flags: 32768,
    components: [
      {
        type: 17,
        accent_color: 0,
        spoiler: false,
        components: [

          {
            type: 10,
            content: '# ☾°.⋆༺ 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑐𝑙𝑎𝑖𝑚𝑠 𝑎𝑛𝑜𝑡ℎ𝑒𝑟 𝑠𝑜𝑢𝑙 ༻⋆.°☽'
          },

          {
            type: 14,
            spacing: 1
          },

          {
            type: 10,
            content:
`### 𝑭𝒂𝒓𝒆𝒘𝒆𝒍𝒍, ${member.user.username}...

𝑨𝒏𝒐𝒕𝒉𝒆𝒓 𝒆𝒄𝒉𝒐 𝒇𝒂𝒍𝒍𝒔 𝒔𝒊𝒍𝒆𝒏𝒕.

༺𓆩~~𝑀𝑎𝑦 𝑖𝑡𝑠 𝑒𝑚𝑏𝑒𝑟𝑠 𝑐𝑜𝑛𝑡𝑖𝑛𝑢𝑒 𝑡𝑜 𝑏𝑢𝑟𝑛 𝑏𝑒𝑦𝑜𝑛𝑑 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑.~~𓆪༻`
          },

          {
            type: 12,
            items: [
              {
                media: {
                  url: 'https://i.redd.it/vru2z0kl9uaf1.gif'
                }
              }
            ]
          }

        ]
      }
    ]
  });

};