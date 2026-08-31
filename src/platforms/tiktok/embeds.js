// src/platforms/tiktok/embeds.js
// Función auxiliar para escapar markdown
function escapeMarkdown(text) {
  if (!text) return '';
  const str = String(text);
  return str
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/\|/g, '\\|')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

// Función auxiliar para formatear números
function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  const number = typeof num === 'number' ? num : parseInt(num);
  if (isNaN(number)) return '0';
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return number.toString();
}

function liveEmbed(data) {
  const { 
    username, 
    nickname, 
    viewers = 0, 
    title = 'Transmisión en vivo', 
    cover, 
    liveUrl,
    pingText = ''
  } = data;

  if (!username || !liveUrl) {
    console.error('❌ Missing required data for liveEmbed:', { username, liveUrl });
    return null;
  }

  const formattedViewers = typeof viewers === 'number' ? viewers.toLocaleString() : viewers;
  const truncatedTitle = title.length > 100 ? title.substring(0, 97) + '...' : title;
  const isValidCover = cover && (cover.startsWith('http://') || cover.startsWith('https://'));

  // Construir el título con el ping al final
  const titleWithPing = `## ᯓᡣ𐭩 ${escapeMarkdown(nickname || username)} 𝒉𝒂𝒔 𝒓𝒆𝒔𝒐𝒏𝒂𝒕𝒆𝒅 ${pingText}\n\n**${escapeMarkdown(truncatedTitle)}**\n\n𓆰♕𓆪 𝑬𝒄𝒉𝒐 𝑶𝒓𝒊𝒈𝒊𝒏: @${escapeMarkdown(username)}\n\n𓆩ꨄ︎𓆪 𝑺𝒐𝒖𝒍𝒔 𝑳𝒊𝒔𝒕𝒆𝒏𝒊𝒏𝒈: ${formattedViewers}\n\n༺𓆩~~𝒄𝒂𝒏 𝒚𝒐𝒖 𝒉𝒆𝒂𝒓 𝒊𝒕 𝒃𝒆𝒚𝒐𝒏𝒅 𝒕𝒉𝒆 𝒔𝒌𝒚?~~𓆪༻`;

  return {
    flags: 32768,
    components: [{
      type: 17,
      accent_color: 0x1E90FF,  // 🔵 AZUL (DodgerBlue)
      spoiler: false,
      components: [
        {
          type: 10,
          content: '# ☽✮˚.⋆༺ 𝐴 𝑙𝑖𝑣𝑒 𝑒𝑐ℎ𝑜 ℎ𝑎𝑠 𝑐𝑟𝑜𝑠𝑠𝑒𝑑 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 ༻⋆.˚✮☾'
        },
        { type: 14, spacing: 1 },
        {
          type: 10,
          content: titleWithPing
        },
        ...(isValidCover ? [{ type: 12, items: [{ media: { url: cover } }] }] : []),
        {
          type: 1,
          components: [{
            type: 2, 
            style: 5, 
            label: '☾ 𝑨𝒏𝒔𝒘𝒆𝒓 𝒕𝒉𝒆 𝑪𝒂𝒍𝒍', 
            url: liveUrl
          }]
        }
      ]
    }]
  };
}

function videoEmbed(data) {
  const { 
    username, 
    nickname, 
    description = '', 
    thumbnail, 
    url, 
    playCount = 0, 
    commentCount = 0,
    pingText = ''
  } = data;

  if (!username || !url) {
    console.error('❌ Missing required data for videoEmbed:', { username, url });
    return null;
  }

  const formattedPlays = formatNumber(playCount);
  const formattedComments = formatNumber(commentCount);
  const truncatedDescription = description.length > 150 ? description.substring(0, 147) + '...' : description;
  const isValidThumbnail = thumbnail && (thumbnail.startsWith('http://') || thumbnail.startsWith('https://'));
  const finalDescription = truncatedDescription || '𝐴 𝑓𝑜𝑟𝑔𝑜𝑡𝑡𝑒𝑛 𝑓𝑟𝑎𝑔𝑚𝑒𝑛𝑡 𝑑𝑟𝑖𝑓𝑡𝑠 𝑡ℎ𝑟𝑜𝑢𝑔ℎ 𝑡ℎ𝑒 𝑛𝑖𝑔ℎ𝑡 𝑠𝑘𝑦...';

  // Construir el título con el ping al final
  const titleWithPing = `## ᯓ⚝ ${escapeMarkdown(nickname || username)} 𝒉𝒂𝒔 𝒍𝒆𝒇𝒕 𝒂 𝒕𝒓𝒂𝒄𝒆 ${pingText}\n\n**${escapeMarkdown(finalDescription)}**\n\n𓆰✦𓆪 𝑺𝒊𝒈𝒏𝒂𝒍 𝑶𝒓𝒊𝒈𝒊𝒏\n@${escapeMarkdown(username)}\n\n𓆩☽𓆪 𝑺𝒕𝒂𝒓𝒔 𝑹𝒆𝒂𝒄𝒉𝒆𝒅\n${formattedPlays}\n\n𓆰✧𓆪 𝑹𝒆𝒔𝒐𝒏𝒂𝒏𝒄𝒆𝒔\n${formattedComments}\n\n༺𓆩~~𝒂𝒏𝒐𝒕𝒉𝒆𝒓 𝒎𝒆𝒎𝒐𝒓𝒚 𝒏𝒐𝒘 𝒔𝒉𝒊𝒏𝒆𝒔 𝒂𝒎𝒐𝒏𝒈 𝒕𝒉𝒆 𝒔𝒕𝒂𝒓𝒔~~𓆪༻`;

  return {
    flags: 32768,
    components: [{
      type: 17,
      accent_color: 0x1E90FF,  // 🔵 AZUL (DodgerBlue)
      spoiler: false,
      components: [
        {
          type: 10,
          content: '# ☽✦˚.⋆༺ 𝐴 𝑛𝑒𝑤 𝑠𝑖𝑔𝑛𝑎𝑙 𝑟𝑒𝑎𝑐ℎ𝑒𝑠 𝑡ℎ𝑒 𝑠𝑡𝑎𝑟𝑠 ༻⋆.˚✦☾'
        },
        { type: 14, spacing: 1 },
        {
          type: 10,
          content: titleWithPing
        },
        ...(isValidThumbnail ? [{ type: 12, items: [{ media: { url: thumbnail } }] }] : []),
        {
          type: 1,
          components: [{
            type: 2, 
            style: 5, 
            label: '✦ 𝑹𝒆𝒂𝒄𝒉 𝒇𝒐𝒓 𝒕𝒉𝒆 𝑺𝒕𝒂𝒓𝒔', 
            url: url
          }]
        }
      ]
    }]
  };
}

// Embed para logs de error
function errorLogEmbed(error, context, guildId, username = null) {
  const timestamp = new Date().toISOString();
  
  return {
    embeds: [{
      title: '❌ TikTok Monitor Error',
      color: 0x1E90FF,  // 🔵 AZUL
      fields: [
        { name: '📅 Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '🎯 Context', value: context, inline: true },
        { name: '🆔 Guild ID', value: guildId || 'Unknown', inline: true },
        ...(username ? [{ name: '👤 Username', value: `@${username}`, inline: true }] : []),
        { name: '⚠️ Error', value: `\`\`\`${error.message?.substring(0, 500) || error}\`\`\``, inline: false },
        ...(error.stack ? [{ name: '📚 Stack Trace', value: `\`\`\`js\n${error.stack.substring(0, 500)}\`\`\``, inline: false }] : [])
      ],
      timestamp: timestamp,
      footer: { text: 'TikTok Monitor System' }
    }]
  };
}

function infoLogEmbed(action, guildId, username, details = {}) {
  return {
    embeds: [{
      title: `📹 TikTok ${action}`,
      color: 0x1E90FF,  // 🔵 AZUL
      fields: [
        { name: '📅 Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '🆔 Guild', value: guildId, inline: true },
        { name: '👤 User', value: `@${username}`, inline: true },
        ...Object.entries(details).map(([key, value]) => ({
          name: key,
          value: String(value),
          inline: true
        }))
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'TikTok Monitor System' }
    }]
  };
}

function warnLogEmbed(message, guildId, username = null) {
  return {
    embeds: [{
      title: '⚠️ TikTok Monitor Warning',
      color: 0x1E90FF,  // 🔵 AZUL
      fields: [
        { name: '📅 Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '🆔 Guild', value: guildId || 'Unknown', inline: true },
        ...(username ? [{ name: '👤 User', value: `@${username}`, inline: true }] : []),
        { name: '📝 Message', value: message, inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'TikTok Monitor System' }
    }]
  };
}

module.exports = { 
  liveEmbed, 
  videoEmbed,
  errorLogEmbed,
  infoLogEmbed,
  warnLogEmbed
};