function liveEmbed(data) {
  const { channelName, handle, title, viewers, thumbnail, liveUrl, startedAt, likes } = data;

  return {
    flags: 32768,
    components: [{
      type: 17,
      accent_color: 16777215,
      spoiler: false,
      components: [
        {
          type: 10,
          content: '# ✧˖°.⋆༺ 𝐴 𝑠𝑡𝑟𝑒𝑎𝑚 𝑜𝑓 𝑙𝑖𝑔ℎ𝑡 𝑝𝑖𝑒𝑟𝑐𝑒𝑠 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 ༻⋆.°˖✧'
        },
        { type: 14, spacing: 1 },
        {
          type: 10,
          content: `## ꒰ঌ ${channelName} 𝒉𝒂𝒔 𝒂𝒘𝒂𝒌𝒆𝒏𝒆𝒅 𝒕𝒉𝒆 𝒆𝒕𝒆𝒓𝒏𝒂𝒍 𝒆𝒚𝒆\n\n**${title}**\n\n𓆰♕𓆪 𝑺𝒕𝒓𝒆𝒂𝒎𝒊𝒏𝒈 𝑭𝒓𝒐𝒎\n@${handle || channelName}\n\n𓆩ꨄ︎𓆪 𝑶𝒃𝒔𝒆𝒓𝒗𝒆𝒓𝒔 𝒊𝒏 𝒕𝒉𝒆 𝑺𝒌𝒚\n${viewers.toLocaleString()} 👁️\n\n${startedAt ? `𓆰⌛𓆪 𝑻𝒊𝒎𝒆 𝒔𝒊𝒏𝒄𝒆 𝒕𝒉𝒆 𝒆𝒚𝒆 𝒐𝒑𝒆𝒏𝒆𝒅\n${startedAt}` : ''}\n\n${likes ? `𓆩❤️𓆪 𝑳𝒊𝒈𝒉𝒕𝒔 𝒐𝒇 𝒂𝒑𝒑𝒓𝒆𝒄𝒊𝒂𝒕𝒊𝒐𝒏\n${likes.toLocaleString()}` : ''}\n\n༺𓆩~~𝒂 𝒏𝒆𝒘 𝒄𝒆𝒍𝒆𝒔𝒕𝒊𝒂𝒍 𝒆𝒎𝒃𝒆𝒓 𝒃𝒖𝒓𝒏𝒔 𝒊𝒏 𝒕𝒉𝒆 𝒇𝒊𝒓𝒎𝒂𝒎𝒆𝒏𝒕~~𓆪༻`
        },
        ...(thumbnail ? [{ type: 12, items: [{ media: { url: thumbnail } }] }] : []),
        {
          type: 1,
          components: [{ type: 2, style: 5, label: '☾ 𝑾𝒊𝒕𝒏𝒆𝒔𝒔 𝒕𝒉𝒆 𝑳𝒊𝒈𝒉𝒕', url: liveUrl }]
        }
      ]
    }]
  };
}

function videoEmbed(user, video) {
  const { channelName, handle } = user;
  const { title, thumbnail, url, views, likes, publishedAt, duration } = video;

  return {
    flags: 32768,
    components: [{
      type: 17,
      accent_color: 16777215,
      spoiler: false,
      components: [
        {
          type: 10,
          content: '# ☽✧˚.⋆༺ 𝐴 𝑛𝑒𝑤 𝑟𝑒𝑐𝑜𝑟𝑑 𝑖𝑛 𝑡ℎ𝑒 𝑐𝑜𝑠𝑚𝑖𝑐 𝑙𝑖𝑏𝑟𝑎𝑟𝑦 ༻⋆.˚✧☾'
        },
        { type: 14, spacing: 1 },
        {
          type: 10,
          content: `## ᯓ⚝ ${channelName} 𝒉𝒂𝒔 𝒖𝒏𝒗𝒆𝒊𝒍𝒆𝒅 𝒂 𝒇𝒓𝒂𝒈𝒎𝒆𝒏𝒕\n\n**${title || '𝐴 𝑣𝑖𝑠𝑖𝑜𝑛 𝑓𝑟𝑜𝑚 𝑏𝑒𝑦𝑜𝑛𝑑'}**\n\n𓆰✦𓆪 𝑪𝒉𝒂𝒏𝒏𝒆𝒍\n@${handle || channelName}\n\n${views ? `𓆩👁️𓆪 𝑾𝒉𝒐 𝒉𝒂𝒗𝒆 𝒘𝒊𝒕𝒏𝒆𝒔𝒔𝒆𝒅\n${views.toLocaleString()}` : ''}\n\n${likes ? `𓆰❤️𓆪 𝑯𝒆𝒂𝒓𝒕𝒔 𝒕𝒉𝒂𝒕 𝒓𝒆𝒔𝒐𝒏𝒂𝒕𝒆𝒅\n${likes.toLocaleString()}` : ''}\n\n${duration ? `𓆩⏱️𓆪 𝑳𝒆𝒏𝒈𝒕𝒉 𝒐𝒇 𝒕𝒉𝒆 𝒗𝒊𝒔𝒊𝒐𝒏\n${duration}` : ''}\n\n${publishedAt ? `𓆰📅𓆪 𝑹𝒆𝒍𝒆𝒂𝒔𝒆𝒅 𝒊𝒏𝒕𝒐 𝒕𝒉𝒆 𝒗𝒐𝒊𝒅\n${publishedAt}` : ''}\n\n༺𓆩~~𝒂𝒏𝒐𝒕𝒉𝒆𝒓 𝒑𝒊𝒆𝒄𝒆 𝒐𝒇 𝒕𝒉𝒆 𝒄𝒆𝒍𝒆𝒔𝒕𝒊𝒂𝒍 𝒑𝒖𝒛𝒛𝒍𝒆 𝒇𝒊𝒏𝒅𝒔 𝒊𝒕𝒔 𝒑𝒍𝒂𝒄𝒆~~𓆪༻`
        },
        ...(thumbnail ? [{ type: 12, items: [{ media: { url: thumbnail } }] }] : []),
        {
          type: 1,
          components: [{ type: 2, style: 5, label: '✦ 𝑼𝒏𝒗𝒆𝒊𝒍 𝒕𝒉𝒆 𝑽𝒊𝒔𝒊𝒐𝒏', url: url }]
        }
      ]
    }]
  };
}

function shortEmbed(user, short) {
  const { channelName, handle } = user;
  const { title, thumbnail, url, views, likes, publishedAt } = short;

  return {
    flags: 32768,
    components: [{
      type: 17,
      accent_color: 16777215,
      spoiler: false,
      components: [
        {
          type: 10,
          content: '# ✧𓆩✧°.⋆༺ 𝐴 𝑞𝑢𝑖𝑐𝑘 𝑒𝑐ℎ𝑜 𝑓𝑟𝑜𝑚 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 ༻⋆.°✧𓆪✧'
        },
        { type: 14, spacing: 1 },
        {
          type: 10,
          content: `## ᯓᡣ𐭩 ${channelName} 𝒓𝒆𝒍𝒆𝒂𝒔𝒆𝒅 𝒂 𝒇𝒍𝒆𝒆𝒕𝒊𝒏𝒈 𝒘𝒉𝒊𝒔𝒑𝒆𝒓\n\n**${title || '𝐴 𝑚𝑜𝑚𝑒𝑛𝑡 𝑐𝑎𝑢𝑔ℎ𝑡 𝑖𝑛 𝑡ℎ𝑒 𝑠𝑖𝑙𝑣𝑒𝑟 𝑙𝑖𝑔ℎ𝑡'}**\n\n𓆰♢𓆪 𝑺𝒐𝒖𝒓𝒄𝒆\n@${handle || channelName}\n\n${views ? `𓆩👁️𓆪 𝑬𝒚𝒆𝒔 𝒕𝒉𝒂𝒕 𝒔𝒂𝒘 𝒕𝒉𝒆 𝒇𝒍𝒂𝒔𝒉\n${views.toLocaleString()}` : ''}\n\n${likes ? `𓆰❤️𓆪 𝑺𝒑𝒂𝒓𝒌𝒔 𝒐𝒇 𝒂𝒑𝒑𝒓𝒆𝒄𝒊𝒂𝒕𝒊𝒐𝒏\n${likes.toLocaleString()}` : ''}\n\n${publishedAt ? `𓆩📅𓆪 𝑾𝒉𝒆𝒏 𝒕𝒉𝒆 𝒘𝒉𝒊𝒔𝒑𝒆𝒓 𝒆𝒄𝒉𝒐𝒆𝒅\n${publishedAt}` : ''}\n\n༺𓆩~~𝒂 𝒔𝒉𝒂𝒓𝒆𝒅 𝒎𝒐𝒎𝒆𝒏𝒕 𝒅𝒓𝒊𝒇𝒕𝒔 𝒕𝒉𝒓𝒐𝒖𝒈𝒉 𝒕𝒉𝒆 𝒄𝒐𝒔𝒎𝒐𝒔~~𓆪༻`
        },
        ...(thumbnail ? [{ type: 12, items: [{ media: { url: thumbnail } }] }] : []),
        {
          type: 1,
          components: [{ type: 2, style: 5, label: 'ꕤ 𝑾𝒊𝒕𝒏𝒆𝒔𝒔 𝒕𝒉𝒆 𝑾𝒉𝒊𝒔𝒑𝒆𝒓', url: url }]
        }
      ]
    }]
  };
}

module.exports = { liveEmbed, videoEmbed, shortEmbed };