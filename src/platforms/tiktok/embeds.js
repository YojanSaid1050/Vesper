function liveEmbed(data) {
  const { username, nickname, viewers, title, cover, liveUrl } = data;

  return {
    flags: 32768,
    components: [{
      type: 17,
      accent_color: 16777215,
      spoiler: false,
      components: [
        {
          type: 10,
          content: '# ☽✮˚.⋆༺ 𝐴 𝑙𝑖𝑣𝑒 𝑒𝑐ℎ𝑜 ℎ𝑎𝑠 𝑐𝑟𝑜𝑠𝑠𝑒𝑑 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 ༻⋆.˚✮☾'
        },
        { type: 14, spacing: 1 },
        {
          type: 10,
          content: `## ᯓᡣ𐭩 ${nickname} 𝒉𝒂𝒔 𝒓𝒆𝒔𝒐𝒏𝒂𝒕𝒆𝒅\n\n**${title}**\n\n𓆰♕𓆪 𝑬𝒄𝒉𝒐 𝑶𝒓𝒊𝒈𝒊𝒏: @${username}\n\n𓆩ꨄ︎𓆪 𝑺𝒐𝒖𝒍𝒔 𝑳𝒊𝒔𝒕𝒆𝒏𝒊𝒏𝒈: ${viewers}\n\n༺𓆩~~𝒄𝒂𝒏 𝒚𝒐𝒖 𝒉𝒆𝒂𝒓 𝒊𝒕 𝒃𝒆𝒚𝒐𝒏𝒅 𝒕𝒉𝒆 𝒔𝒌𝒚?~~𓆪༻`
        },
        ...(cover ? [{ type: 12, items: [{ media: { url: cover } }] }] : []),
        {
          type: 1,
          components: [{ type: 2, style: 5, label: '☾ 𝑨𝒏𝒔𝒘𝒆𝒓 𝒕𝒉𝒆 𝑪𝒂𝒍𝒍', url: liveUrl }]
        }
      ]
    }]
  };
}

function videoEmbed(data) {
  const { username, nickname, description, thumbnail, url, playCount, commentCount } = data;

  return {
    flags: 32768,
    components: [{
      type: 17,
      accent_color: 16777215,
      spoiler: false,
      components: [
        {
          type: 10,
          content: '# ☽✦˚.⋆༺ 𝐴 𝑛𝑒𝑤 𝑠𝑖𝑔𝑛𝑎𝑙 𝑟𝑒𝑎𝑐ℎ𝑒𝑠 𝑡ℎ𝑒 𝑠𝑡𝑎𝑟𝑠 ༻⋆.˚✦☾'
        },
        { type: 14, spacing: 1 },
        {
          type: 10,
          content: `## ᯓ⚝ ${nickname || username} 𝒉𝒂𝒔 𝒍𝒆𝒇𝒕 𝒂 𝒕𝒓𝒂𝒄𝒆\n\n**${description || '𝐴 𝑓𝑜𝑟𝑔𝑜𝑡𝑡𝑒𝑛 𝑓𝑟𝑎𝑔𝑚𝑒𝑛𝑡 𝑑𝑟𝑖𝑓𝑡𝑠 𝑡ℎ𝑟𝑜𝑢𝑔ℎ 𝑡ℎ𝑒 𝑛𝑖𝑔ℎ𝑡 𝑠𝑘𝑦...'}**\n\n𓆰✦𓆪 𝑺𝒊𝒈𝒏𝒂𝒍 𝑶𝒓𝒊𝒈𝒊𝒏\n@${username}\n\n𓆩☽𓆪 𝑺𝒕𝒂𝒓𝒔 𝑹𝒆𝒂𝒄𝒉𝒆𝒅\n${playCount || 0}\n\n𓆰✧𓆪 𝑹𝒆𝒔𝒐𝒏𝒂𝒏𝒄𝒆𝒔\n${commentCount || 0}\n\n༺𓆩~~𝒂𝒏𝒐𝒕𝒉𝒆𝒓 𝒎𝒆𝒎𝒐𝒓𝒚 𝒏𝒐𝒘 𝒔𝒉𝒊𝒏𝒆𝒔 𝒂𝒎𝒐𝒏𝒈 𝒕𝒉𝒆 𝒔𝒕𝒂𝒓𝒔~~𓆪༻`
        },
        ...(thumbnail ? [{ type: 12, items: [{ media: { url: thumbnail } }] }] : []),
        {
          type: 1,
          components: [{ type: 2, style: 5, label: '✦ 𝑹𝒆𝒂𝒄𝒉 𝒇𝒐𝒓 𝒕𝒉𝒆 𝑺𝒕𝒂𝒓𝒔', url: url }]
        }
      ]
    }]
  };
}

module.exports = { liveEmbed, videoEmbed };