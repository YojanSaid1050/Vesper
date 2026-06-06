const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType
} = require('discord.js');

const {
  getGuildConfig
} = require('../../../utils/guildManager');

module.exports = (guildId, mode = 'default') => {

  const config =
    getGuildConfig(guildId);

  const tiktok =
    config.tiktok || {};

  const users =
    tiktok.users || [];

  const isList =
    mode === 'list';

  return {

    flags: 32768,

    components: [

      {
        type: 17,
        accent_color: 0x000000,
        spoiler: false,

        components: [

          // =========================
          // HEADER
          // =========================
          {
            type: 10,
            content:
`# ⛧°. ⋆༺ 𝑬𝒄𝒉𝒐𝒆𝒔 𝒐𝒇 𝑻𝒊𝒌𝑻𝒐𝒌 ༻⋆. °⛧`
          },

          {
            type: 14,
            spacing: 2
          },

          // =========================
          // INTRO
          // =========================
          {
            type: 10,
            content:
`### 🎵 𝑻𝒉𝒆 𝒗𝒐𝒊𝒅 𝒍𝒊𝒔𝒕𝒆𝒏𝒔 𝒕𝒐 𝒔𝒉𝒂𝒓𝒆𝒅 𝒆𝒄𝒉𝒐𝒆𝒔.

𝑬𝒗𝒆𝒓𝒚 𝒓𝒆𝒂𝒍𝒎 𝒃𝒆𝒄𝒐𝒎𝒆𝒔 𝒂 𝒔𝒊𝒈𝒏𝒂𝒍.`
          },

          {
            type: 14,
            spacing: 2
          },

          // =========================
          // STATUS
          // =========================
          {
            type: 10,
            content:
`🔴 **𝑳𝒊𝒗𝒆 𝑪𝒉𝒂𝒏𝒏𝒆𝒍**
${tiktok.liveChannel ? `<#${tiktok.liveChannel}>` : '`No configurado`'}

🎬 **𝑽𝒊𝒅𝒆𝒐 𝑪𝒉𝒂𝒏𝒏𝒆𝒍**
${tiktok.videoChannel ? `<#${tiktok.videoChannel}>` : '`No configurado`'}

👤 **𝑹𝒆𝒈𝒊𝒔𝒕𝒆𝒓𝒆𝒅**
${users.length} streamers`
          },

          {
            type: 14,
            spacing: 2
          },

          // =========================
          // LIST VIEW (NUEVO)
          // =========================
          ...(isList ? [
            {
              type: 10,
              content:
`📋 **𝑼𝒔𝒆𝒓𝒔 𝑳𝒊𝒔𝒕**

${
  users.length
    ? users.map(u => `• @${u}`).join('\n')
    : '`No hay usuarios registrados`'
}`
            },
            {
              type: 14,
              spacing: 2
            }
          ] : []),

          // =========================
          // SELECT TITLE
          // =========================
          {
            type: 10,
            content:
`⚙️ 𝑪𝒐𝒏𝒇𝒊𝒈𝒖𝒓𝒂 𝒍𝒐𝒔 𝒄𝒂𝒏𝒂𝒍𝒆𝒔`
          },

          // LIVE CHANNEL
          new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId('tiktok_live_channel')
              .setPlaceholder('Seleccionar canal de directos')
              .addChannelTypes(ChannelType.GuildText)
              .setMinValues(1)
              .setMaxValues(1)
          ).toJSON(),

          // VIDEO CHANNEL
          new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId('tiktok_video_channel')
              .setPlaceholder('Seleccionar canal de videos')
              .addChannelTypes(ChannelType.GuildText)
              .setMinValues(1)
              .setMaxValues(1)
          ).toJSON(),

          {
            type: 14,
            spacing: 2
          },

          // =========================
          // ACTIONS
          // =========================
          {
            type: 10,
            content:
`👤 𝑴𝒂𝒏𝒂𝒈𝒆 𝒔𝒐𝒖𝒍𝒔`
          },

          new ActionRowBuilder().addComponents(

            new ButtonBuilder()
              .setCustomId('tiktok_add_user')
              .setLabel('Añadir')
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('tiktok_remove_user')
              .setLabel('Eliminar')
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('tiktok_list_users')
              .setLabel(isList ? 'Ocultar' : 'Ver')
              .setStyle(ButtonStyle.Secondary)

          ).toJSON(),

          {
            type: 14,
            spacing: 2
          },

          // =========================
          // BACK
          // =========================
          {
            type: 10,
            content:
`↩ 𝑅𝑒𝑡𝑢𝑟𝑛 𝑡𝑜 𝑡ℎ𝑒 𝑝𝑜𝑟𝑡𝑎𝑙`
          },

          new ActionRowBuilder().addComponents(

            new ButtonBuilder()
              .setCustomId('dashboard_home')
              .setLabel('Volver')
              .setStyle(ButtonStyle.Secondary)

          ).toJSON()

        ]

      }

    ]

  };

};