// src/platforms/twitch/embeds.js
const { formatNumber, escapeMarkdown } = require('./utils');

function liveEmbed(data) {
  const { streamer, title, game, viewers, thumbnail, streamUrl, pingText = '' } = data;

  if (!streamer || !streamUrl) {
    console.error('❌ Missing required data for liveEmbed:', { streamer, streamUrl });
    return null;
  }

  const formattedViewers = formatNumber(viewers);
  const truncatedTitle = title?.length > 100 ? title.substring(0, 97) + '...' : title || 'Sin título';
  const isValidThumbnail = thumbnail && (thumbnail.startsWith('http://') || thumbnail.startsWith('https://'));

  // Construir el título con el ping al final
  const titleWithPing = `## ꒰ঌ ${escapeMarkdown(streamer)} 𝒉𝒂𝒔 𝒂𝒘𝒂𝒌𝒆𝒏𝒆𝒅 ${pingText}\n\n**${escapeMarkdown(truncatedTitle)}**\n\n𓆰♕𓆪 𝑹𝒆𝒂𝒍𝒎: ${escapeMarkdown(game || 'Unknown')}\n\n𓆩ꨄ︎𓆪 𝑺𝒐𝒖𝒍𝒔 𝑾𝒂𝒕𝒄𝒉𝒊𝒏𝒈: ${formattedViewers}\n\n༺𓆩~~𝒂 𝒇𝒐𝒓𝒈𝒐𝒕𝒕𝒆𝒏 𝒆𝒎𝒃𝒆𝒓 𝒈𝒍𝒐𝒘𝒔 𝒐𝒏𝒄𝒆 𝒂𝒈𝒂𝒊𝒏~~𓆪༻`;

  return {
    flags: 32768,
    components: [{
      type: 17,
      accent_color: 0x800080,  // 🟣 MORADO
      spoiler: false,
      components: [
        {
          type: 10,
          content: '# ✧°.⋆༺ 𝐴𝑛 𝑒𝑐ℎ𝑜 𝑐𝑎𝑙𝑙𝑠 𝑓𝑟𝑜𝑚 𝑏𝑒𝑦𝑜𝑛𝑑 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 ༻⋆.°✧'
        },
        { type: 14, spacing: 1 },
        {
          type: 10,
          content: titleWithPing
        },
        ...(isValidThumbnail ? [{ type: 12, items: [{ media: { url: thumbnail } }] }] : []),
        {
          type: 1,
          components: [{ type: 2, style: 5, label: '☾ 𝑬𝒏𝒕𝒆𝒓 𝒕𝒉𝒆 𝒂𝒃𝒚𝒔𝒔', url: streamUrl }]
        }
      ]
    }]
  };
}

// Embed para logs de error
function errorLogEmbed(error, context, guildId, streamer = null) {
  return {
    embeds: [{
      title: '❌ Twitch Monitor Error',
      color: 0x800080,  // 🟣 MORADO
      fields: [
        { name: '📅 Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '🎯 Context', value: context, inline: true },
        { name: '🆔 Guild ID', value: guildId || 'Unknown', inline: true },
        ...(streamer ? [{ name: '🎭 Streamer', value: streamer, inline: true }] : []),
        { name: '⚠️ Error', value: `\`\`\`${error.message?.substring(0, 500) || error}\`\`\``, inline: false },
        ...(error.stack ? [{ name: '📚 Stack Trace', value: `\`\`\`js\n${error.stack.substring(0, 500)}\`\`\``, inline: false }] : [])
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Twitch Monitor System' }
    }]
  };
}

// Embed para eventos importantes
function infoLogEmbed(action, guildId, streamer, details = {}) {
  return {
    embeds: [{
      title: `🎮 Twitch ${action}`,
      color: 0x800080,  // 🟣 MORADO
      fields: [
        { name: '📅 Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '🆔 Guild', value: guildId, inline: true },
        { name: '🎭 Streamer', value: streamer, inline: true },
        ...Object.entries(details).map(([key, value]) => ({
          name: key,
          value: String(value),
          inline: true
        }))
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Twitch Monitor System' }
    }]
  };
}

// Embed para advertencias
function warnLogEmbed(message, guildId, streamer = null) {
  return {
    embeds: [{
      title: '⚠️ Twitch Monitor Warning',
      color: 0x800080,  // 🟣 MORADO
      fields: [
        { name: '📅 Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '🆔 Guild', value: guildId || 'Unknown', inline: true },
        ...(streamer ? [{ name: '🎭 Streamer', value: streamer, inline: true }] : []),
        { name: '📝 Message', value: message, inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Twitch Monitor System' }
    }]
  };
}

module.exports = { 
  liveEmbed,
  errorLogEmbed,
  infoLogEmbed,
  warnLogEmbed
};