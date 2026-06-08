const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType } = require('discord.js');
const { getGuildConfig } = require('../database/guildManager');

async function mainPanel(guildId) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_general').setLabel('Eyes of the Void').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dashboard_bot').setLabel('Inner Clockwork').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dashboard_branding').setLabel('The Forge').setEmoji('🔥').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_tiktok').setLabel('Whispers').setEmoji('🎭').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dashboard_twitch').setLabel('The Vigil').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dashboard_youtube').setLabel('Eternal Records').setEmoji('📀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dashboard_tests').setLabel('The Seer\'s Lab').setEmoji('🔮').setStyle(ButtonStyle.Secondary)
  );

  return {
    flags: 32768,
    components: [{
      type: 17, accent_color: 0x000000, spoiler: false,
      components: [
        { type: 10, content: '# ⛧°. ⋆༺ 𝐶ℎ𝑟𝑜𝑛𝑖𝑐𝑙𝑒𝑠 𝑜𝑓 𝑡ℎ𝑒 𝑉𝑜𝑖𝑑 ༻⋆. °⛧' },
        { type: 14, spacing: 2 },
        { type: 10, content: '### 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑤𝑎𝑡𝑐ℎ𝑒𝑠. 𝑇ℎ𝑒 𝑒𝑚𝑏𝑒𝑟𝑠 𝑟𝑒𝑐𝑜𝑟𝑑 𝑒𝑣𝑒𝑟𝑦 𝑐ℎ𝑜𝑖𝑐𝑒.\n\n༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑐𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑖𝑛𝑔 𝑎 𝑏𝑜𝑡… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑠ℎ𝑎𝑝𝑖𝑛𝑔 𝑎 𝑟𝑒𝑙𝑖𝑐.~~𓆪༻' },
        { type: 14, spacing: 2 },
        { type: 10, content: '👁️ **𝐸𝑦𝑒𝑠 𝑜𝑓 𝑡ℎ𝑒 𝑉𝑜𝑖𝑑**\n𝐿𝑜𝑠 𝑝𝑜𝑟𝑡𝑎𝑙𝑒𝑠 𝑞𝑢𝑒 𝑣𝑖𝑔𝑖𝑙𝑎𝑛 𝑙𝑎 𝑒𝑛𝑡𝑟𝑎𝑑𝑎 𝑦 𝑠𝑎𝑙𝑖𝑑𝑎 𝑑𝑒𝑙 𝑠𝑒𝑟𝑣𝑖𝑑𝑜𝑟.' },
        { type: 10, content: '⚙️ **𝐼𝑛𝑛𝑒𝑟 𝐶𝑙𝑜𝑐𝑘𝑤𝑜𝑟𝑘**\n𝐸𝑙 𝑚𝑒𝑐𝑎𝑛𝑖𝑠𝑚𝑜 𝑞𝑢𝑒 𝑚𝑎𝑛𝑡𝑖𝑒𝑛𝑒 𝑣𝑖𝑣𝑜 𝑒𝑙 𝑙𝑎𝑡𝑖𝑑𝑜 𝑑𝑒𝑙 𝑟𝑒𝑙𝑖𝑐𝑎𝑟𝑖𝑜.' },
        { type: 10, content: '🔥 **𝑇ℎ𝑒 𝐹𝑜𝑟𝑔𝑒**\n𝐸𝑙 𝑙𝑢𝑔𝑎𝑟 𝑑𝑜𝑛𝑑𝑒 𝑠𝑒 𝑓𝑜𝑟𝑗𝑎 𝑙𝑎 𝑖𝑑𝑒𝑛𝑡𝑖𝑑𝑎𝑑 𝑦 𝑒𝑙 𝑟𝑜𝑠𝑡𝑟𝑜 𝑑𝑒𝑙 𝑟𝑒𝑙𝑖𝑐𝑎𝑟𝑖𝑜.' },
        { type: 10, content: '🎭 **𝑊ℎ𝑖𝑠𝑝𝑒𝑟𝑠**\n𝐿𝑜𝑠 𝑒𝑐𝑜𝑠 𝑞𝑢𝑒 𝑠𝑢𝑠𝑢𝑟𝑟𝑎𝑛 𝑑𝑒𝑠𝑑𝑒 𝑇𝑖𝑘𝑇𝑜𝑘 𝑒𝑛 𝑒𝑙 𝑣𝑎𝑐í𝑜.' },
        { type: 10, content: '👁️ **𝑇ℎ𝑒 𝑉𝑖𝑔𝑖𝑙**\n𝐿𝑜𝑠 𝑜𝑗𝑜𝑠 𝑞𝑢𝑒 𝑛𝑢𝑛𝑐𝑎 𝑑𝑢𝑒𝑟𝑚𝑒𝑛 𝑠𝑜𝑏𝑟𝑒 𝑙𝑜𝑠 𝑐𝑎𝑛𝑎𝑙𝑒𝑠 𝑑𝑒 𝑇𝑤𝑖𝑡𝑐ℎ.' },
        { type: 10, content: '📀 **𝐸𝑡𝑒𝑟𝑛𝑎𝑙 𝑅𝑒𝑐𝑜𝑟𝑑𝑠**\n𝐿𝑜𝑠 𝑎𝑟𝑐ℎ𝑖𝑣𝑜𝑠 𝑞𝑢𝑒 𝑔𝑢𝑎𝑟𝑑𝑎𝑛 𝑡𝑜𝑑𝑜 𝑒𝑐𝑜 𝑞𝑢𝑒 𝑠𝑢𝑟𝑐𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑑𝑒𝑠𝑑𝑒 𝑌𝑜𝑢𝑇𝑢𝑏𝑒.' },
        { type: 10, content: '🔮 **𝑇ℎ𝑒 𝑆𝑒𝑒𝑟\'𝑠 𝐿𝑎𝑏**\n𝐸𝑙 𝑠𝑎𝑛𝑡𝑢𝑎𝑟𝑖𝑜 𝑑𝑜𝑛𝑑𝑒 𝑠𝑒 𝑝𝑟𝑢𝑒𝑏𝑎𝑛 𝑙𝑜𝑠 𝑒𝑐𝑜𝑠, 𝑙𝑎𝑠 𝑙𝑢𝑐𝑒𝑠 𝑦 𝑙𝑜𝑠 𝑠𝑢𝑠𝑢𝑟𝑟𝑜𝑠.' },
        { type: 14, spacing: 2 },
        { type: 10, content: '𝑆𝑒𝑙𝑒𝑐𝑡 𝑡ℎ𝑒 𝑠𝑒𝑐𝑡𝑖𝑜𝑛 𝑡ℎ𝑎𝑡 𝑐𝑎𝑙𝑙𝑠 𝑡𝑜 𝑦𝑜𝑢.' },
        row1.toJSON(), row2.toJSON()
      ]
    }]
  };
}

async function generalPanel(guildId) {
  const config = getGuildConfig(guildId);
  return {
    flags: 32768,
    components: [{
      type: 17, accent_color: 0xFFFFFF, spoiler: false, // Blanco
      components: [
        { type: 10, content: '# ⛧°. ⋆༺ 𝑇ℎ𝑒 𝐸𝑦𝑒𝑠 𝑜𝑓 𝑡ℎ𝑒 𝑉𝑜𝑖𝑑 ༻⋆. °⛧' },
        { type: 14, spacing: 2 },
        { type: 10, content: '### 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑠𝑒𝑒𝑠 𝑒𝑣𝑒𝑟𝑦𝑡ℎ𝑖𝑛𝑔, 𝑏𝑢𝑡 𝑖𝑡 𝑛𝑒𝑒𝑑𝑠 𝑤𝑖𝑛𝑑𝑜𝑤𝑠.\n\n༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑐𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑖𝑛𝑔 𝑐ℎ𝑎𝑛𝑛𝑒𝑙𝑠… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑜𝑝𝑒𝑛𝑖𝑛𝑔 𝑝𝑜𝑟𝑡𝑎𝑙𝑠.~~𓆪༻' },
        { type: 14, spacing: 2 },
        { type: 10, content: `👁️ **𝐵𝑖𝑒𝑛𝑣𝑒𝑛𝑖𝑑𝑎**\n𝐶𝑎𝑛𝑎𝑙 𝑑𝑜𝑛𝑑𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑟𝑒𝑐𝑖𝑏𝑖𝑟á 𝑎 𝑙𝑜𝑠 𝑛𝑢𝑒𝑣𝑜𝑠 𝑣𝑖𝑎𝑗𝑒𝑟𝑜𝑠.\n${config.general.welcomeChannel ? `<#${config.general.welcomeChannel}>` : '`No vinculado`'}\n\n👁️ **𝐷𝑒𝑠𝑝𝑒𝑑𝑖𝑑𝑎**\n𝐶𝑎𝑛𝑎𝑙 𝑑𝑜𝑛𝑑𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑠𝑒 𝑑𝑒𝑠𝑝𝑒𝑑𝑖𝑟á 𝑑𝑒 𝑞𝑢𝑖𝑒𝑛𝑒𝑠 𝑠𝑒 𝑚𝑎𝑟𝑐ℎ𝑎𝑛.\n${config.general.goodbyeChannel ? `<#${config.general.goodbyeChannel}>` : '`No vinculado`'}\n\n👁️ **𝑅𝑒𝑔𝑖𝑠𝑡𝑟𝑜𝑠**\n𝐶𝑎𝑛𝑎𝑙 𝑑𝑜𝑛𝑑𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑒𝑠𝑐𝑟𝑖𝑏𝑖𝑟á 𝑙𝑜𝑠 𝑠𝑢𝑐𝑒𝑠𝑜𝑠 𝑑𝑒𝑙 𝑠𝑒𝑟𝑣𝑖𝑑𝑜𝑟.\n${config.general.logChannel ? `<#${config.general.logChannel}>` : '`No vinculado`'}` },
        { type: 14, spacing: 2 },
        { type: 10, content: '⚙️ **𝑉𝑖𝑛𝑐𝑢𝑙𝑎 𝑙𝑜𝑠 𝑝𝑜𝑟𝑡𝑎𝑙𝑒𝑠**\n𝑆𝑒𝑙𝑒𝑐𝑐𝑖𝑜𝑛𝑎 𝑢𝑛 𝑐𝑎𝑛𝑎𝑙 𝑝𝑎𝑟𝑎 𝑎𝑠𝑖𝑔𝑛𝑎𝑟𝑙𝑒 𝑢𝑛𝑎 𝑑𝑒 𝑙𝑎𝑠 𝑓𝑢𝑛𝑐𝑖𝑜𝑛𝑒𝑠 𝑑𝑒𝑙 𝑣𝑎𝑐í𝑜.' },
        { type: 14, spacing: 1 },
        new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('general_welcome').setPlaceholder('🔮 𝐶𝑎𝑛𝑎𝑙 𝑑𝑒 𝑏𝑖𝑒𝑛𝑣𝑒𝑛𝑖𝑑𝑎').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)).toJSON(),
        new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('general_goodbye').setPlaceholder('🌑 𝐶𝑎𝑛𝑎𝑙 𝑑𝑒 𝑑𝑒𝑠𝑝𝑒𝑑𝑖𝑑𝑎').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)).toJSON(),
        new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('general_log').setPlaceholder('📜 𝐶𝑎𝑛𝑎𝑙 𝑑𝑒 𝑟𝑒𝑔𝑖𝑠𝑡𝑟𝑜𝑠').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)).toJSON(),
        { type: 14, spacing: 2 },
        { type: 10, content: '╰┈➤ˎˊ˗ 𝑅𝑒𝑡𝑢𝑟𝑛 𝑡𝑜 𝑡ℎ𝑒 𝑚𝑎𝑖𝑛 𝑝𝑜𝑟𝑡𝑎𝑙' },
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)).toJSON()
      ]
    }]
  };
}

async function botPanel(guildId) {
  const config = getGuildConfig(guildId);
  return {
    flags: 32768,
    components: [{
      type: 17, accent_color: 0x808080, spoiler: false, // Gris
      components: [
        { type: 10, content: '# ⛧°. ⋆༺ 𝐼𝑛𝑛𝑒𝑟 𝐶𝑙𝑜𝑐𝑘𝑤𝑜𝑟𝑘 ༻⋆. °⛧' },
        { type: 14, spacing: 2 },
        { type: 10, content: '### 𝑇ℎ𝑒 𝑚𝑎𝑐ℎ𝑖𝑛𝑒𝑟𝑦 𝑡ℎ𝑎𝑡 𝑏𝑟𝑒𝑎𝑡ℎ𝑒𝑠 𝑤𝑖𝑡ℎ𝑖𝑛 𝑡ℎ𝑒 𝑟𝑒𝑙𝑖𝑐.\n\n༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑐𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑖𝑛𝑔 𝑎 𝑏𝑜𝑡… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑐𝑎𝑙𝑖𝑏𝑟𝑎𝑡𝑖𝑛𝑔 𝑖𝑡𝑠 ℎ𝑒𝑎𝑟𝑡𝑏𝑒𝑎𝑡.~~𓆪༻' },
        { type: 14, spacing: 2 },
        { type: 10, content: `⚙️ **𝑅𝑜𝑙 𝑑𝑒 𝑙𝑎𝑠 𝑚á𝑞𝑢𝑖𝑛𝑎𝑠**\n𝑅𝑜𝑙 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑎𝑠𝑖𝑔𝑛𝑎𝑟á 𝑎 𝑙𝑜𝑠 𝑏𝑜𝑡𝑠 𝑎𝑢𝑡𝑜𝑚á𝑡𝑖𝑐𝑎𝑚𝑒𝑛𝑡𝑒.\n${config.general.botRole ? `<@&${config.general.botRole}>` : '`No vinculado`'}\n\n📜 **𝑅𝑒𝑔𝑖𝑠𝑡𝑟𝑜 𝑑𝑒 𝑚𝑎𝑞𝑢𝑖𝑛𝑎𝑟𝑖𝑎**\n𝐶𝑎𝑛𝑎𝑙 𝑑𝑜𝑛𝑑𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑟𝑒𝑔𝑖𝑠𝑡𝑟𝑎𝑟á 𝑙𝑎𝑠 𝑎𝑐𝑐𝑖𝑜𝑛𝑒𝑠 𝑑𝑒 𝑙𝑜𝑠 𝑠𝑒𝑟𝑣𝑖𝑑𝑜𝑟𝑒𝑠.\n${config.general.botLogChannel ? `<#${config.general.botLogChannel}>` : '`No vinculado`'}` },
        { type: 14, spacing: 2 },
        { type: 10, content: '⚙️ **𝑉𝑖𝑛𝑐𝑢𝑙𝑎 𝑙𝑜𝑠 𝑒𝑛𝑔𝑟𝑎𝑛𝑎𝑗𝑒𝑠**\n𝑆𝑒𝑙𝑒𝑐𝑐𝑖𝑜𝑛𝑎 𝑢𝑛 𝑟𝑜𝑙 𝑦 𝑢𝑛 𝑐𝑎𝑛𝑎𝑙 𝑝𝑎𝑟𝑎 𝑞𝑢𝑒 𝑙𝑎 𝑚𝑎𝑞𝑢𝑖𝑛𝑎𝑟𝑖𝑎 𝑓𝑢𝑛𝑐𝑖𝑜𝑛𝑒 𝑒𝑛 𝑎𝑟𝑚𝑜𝑛í𝑎.' },
        { type: 14, spacing: 1 },
        new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('bot_role').setPlaceholder('⚙️ 𝑅𝑜𝑙 𝑝𝑎𝑟𝑎 𝑚á𝑞𝑢𝑖𝑛𝑎𝑠').setMinValues(1).setMaxValues(1)).toJSON(),
        new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('bot_log_channel').setPlaceholder('📜 𝐶𝑎𝑛𝑎𝑙 𝑑𝑒 𝑟𝑒𝑔𝑖𝑠𝑡𝑟𝑜𝑠').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)).toJSON(),
        { type: 14, spacing: 2 },
        { type: 10, content: '╰┈➤ˎˊ˗ 𝑅𝑒𝑡𝑢𝑟𝑛 𝑡𝑜 𝑡ℎ𝑒 𝑚𝑎𝑖𝑛 𝑝𝑜𝑟𝑡𝑎𝑙' },
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)).toJSON()
      ]
    }]
  };
}

async function brandingPanel(guildId) {
  const config = getGuildConfig(guildId);
  const branding = config.branding || {};
  
  const components = [
    { type: 10, content: '# ⛧°. ⋆༺ 𝑇ℎ𝑒 𝐹𝑜𝑟𝑔𝑒 ༻⋆. °⛧' },
    { type: 14, spacing: 2 },
    { type: 10, content: '### 𝑇ℎ𝑒 𝑓𝑖𝑟𝑒𝑠 𝑡ℎ𝑎𝑡 𝑚𝑜𝑙𝑑 𝑡ℎ𝑒 𝑟𝑒𝑙𝑖𝑐\'𝑠 𝑓𝑎𝑐𝑒.\n\n༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑐𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑖𝑛𝑔 𝑏𝑟𝑎𝑛𝑑𝑖𝑛𝑔… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑓𝑜𝑟𝑔𝑖𝑛𝑔 𝑎𝑛 𝑖𝑑𝑒𝑛𝑡𝑖𝑡𝑦.~~𓆪༻' },
    { type: 14, spacing: 2 },
    { type: 10, content: `🔥 **𝑁𝑜𝑚𝑏𝑟𝑒 𝑑𝑒𝑙 𝑟𝑒𝑙𝑖𝑐𝑎𝑟𝑖𝑜**\n𝐸𝑙 𝑛𝑜𝑚𝑏𝑟𝑒 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑝𝑟𝑜𝑐𝑙𝑎𝑚𝑎𝑟á 𝑎𝑛𝑡𝑒 𝑙𝑜𝑠 𝑑𝑒𝑚á𝑠.\n${branding.name ? `\`${branding.name}\`` : '`No vinculado`'}\n\n🎭 **𝑅𝑜𝑠𝑡𝑟𝑜 𝑑𝑒𝑙 𝑟𝑒𝑙𝑖𝑐𝑎𝑟𝑖𝑜**\n𝐿𝑎 𝑖𝑚𝑎𝑔𝑒𝑛 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑚𝑜𝑠𝑡𝑟𝑎𝑟á 𝑐𝑜𝑚𝑜 𝑠𝑢 𝑒𝑠𝑝𝑒𝑗𝑜.\n${branding.avatar ? '`Forjado ✓`' : '`No vinculado`'}` }
  ];

  if (branding.avatar) {
    components.push(
      { type: 14, spacing: 1 },
      { type: 12, items: [{ media: { url: branding.avatar } }] }
    );
  }

  components.push(
    { type: 14, spacing: 2 },
    { type: 10, content: '⚙️ **𝐹𝑜𝑟𝑗𝑎 𝑙𝑎 𝑖𝑑𝑒𝑛𝑡𝑖𝑑𝑎𝑑**\n𝑆𝑒𝑙𝑒𝑐𝑐𝑖𝑜𝑛𝑎 𝑞𝑢é 𝑎𝑠𝑝𝑒𝑐𝑡𝑜 𝑑𝑒𝑙 𝑟𝑒𝑙𝑖𝑐𝑎𝑟𝑖𝑜 𝑑𝑒𝑠𝑒𝑎𝑠 𝑚𝑜𝑙𝑑𝑒𝑎𝑟.' },
    { type: 14, spacing: 1 },
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('branding_name').setLabel('Nombre').setStyle(ButtonStyle.Secondary).setEmoji('🔥'),
      new ButtonBuilder().setCustomId('branding_avatar').setLabel('Avatar').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
      new ButtonBuilder().setCustomId('branding_reset').setLabel('Reset').setStyle(ButtonStyle.Secondary).setEmoji('⚡')
    ).toJSON(),
    { type: 14, spacing: 2 },
    { type: 10, content: '╰┈➤ˎˊ˗ Return to the main portal' },
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)
    ).toJSON()
  );

  return {
    flags: 32768,
    components: [{
      type: 17,
      accent_color: 0xFFA500, // Naranja
      spoiler: false,
      components: components
    }]
  };
}

async function tiktokPanel(guildId, mode = 'default') {
  const config = getGuildConfig(guildId);
  const tiktok = config.tiktok || {};
  const users = tiktok.users || [];
  const isList = mode === 'list';
  const liveChannel = tiktok.liveChannel || null;
  const videoChannel = tiktok.videoChannel || null;

  return {
    flags: 32768,
    components: [{
      type: 17, accent_color: 0x1E90FF, spoiler: false, // Azul
      components: [
        { type: 10, content: '# ⛧°. ⋆༺ 𝑊ℎ𝑖𝑠𝑝𝑒𝑟𝑠 ༻⋆. °⛧' },
        { type: 14, spacing: 2 },
        { type: 10, content: '### 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑙𝑖𝑠𝑡𝑒𝑛𝑠 𝑡𝑜 𝑓𝑙𝑒𝑒𝑡𝑖𝑛𝑔 𝑠𝑜𝑢𝑛𝑑𝑠 𝑓𝑟𝑜𝑚 𝑏𝑒𝑦𝑜𝑛𝑑.\n\n༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑠𝑒𝑡𝑡𝑖𝑛𝑔 𝑢𝑝 𝑎𝑙𝑒𝑟𝑡𝑠… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑎𝑡𝑡𝑢𝑛𝑖𝑛𝑔 𝑒𝑎𝑟𝑠 𝑡𝑜 𝑡ℎ𝑒 𝑢𝑛𝑘𝑛𝑜𝑤𝑛.~~𓆪༻' },
        { type: 14, spacing: 2 },
        { type: 10, content: `🎤 **𝐿𝑖𝑣𝑒 𝑉𝑜𝑖𝑐𝑒𝑠**\n𝐿𝑎𝑠 𝑣𝑜𝑐𝑒𝑠 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑒𝑠𝑐𝑢𝑐ℎ𝑎 𝑒𝑛 𝑣𝑖𝑣𝑜, 𝑟𝑒𝑠𝑜𝑛𝑎𝑛𝑑𝑜 𝑒𝑛 𝑙𝑎 𝑖𝑛𝑚𝑒𝑛𝑠𝑖𝑑𝑎𝑑.\n${liveChannel ? `<#${liveChannel}>` : '`No vinculado`'}\n\n🎬 **𝐸𝑐ℎ𝑜𝑒𝑠 𝑅𝑒𝑐𝑜𝑟𝑑𝑒𝑑**\n𝐿𝑜𝑠 𝑠𝑢𝑠𝑢𝑟𝑟𝑜𝑠 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑎𝑡𝑟𝑎𝑝𝑎 𝑒𝑛 𝑠𝑢𝑠 𝑎𝑟𝑐ℎ𝑖𝑣𝑜𝑠 𝑝𝑎𝑟𝑎 𝑙𝑎 𝑒𝑡𝑒𝑟𝑛𝑖𝑑𝑎𝑑.\n${videoChannel ? `<#${videoChannel}>` : '`No vinculado`'}\n\n👤 **𝑉𝑜𝑐𝑒𝑠 𝐴𝑡𝑒𝑛𝑑𝑖𝑑𝑎𝑠**\n${users.length} 𝑠𝑢𝑠𝑢𝑟𝑟𝑜𝑠 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 ℎ𝑎 𝑐𝑎𝑝𝑡𝑎𝑑𝑜.` },
        { type: 14, spacing: 2 },
        ...(isList ? [{ type: 10, content: `📋 **𝑆𝑢𝑠𝑢𝑟𝑟𝑜𝑠 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑒𝑠𝑐𝑢𝑐ℎ𝑎**\n${users.length ? users.map(u => `• ${u}`).join('\n') : '`𝑁𝑖𝑛𝑔𝑢𝑛 𝑠𝑢𝑠𝑢𝑟𝑟𝑜 𝑎𝑡𝑒𝑛𝑑𝑖𝑑𝑜`'}` }, { type: 14, spacing: 2 }] : []),
        { type: 10, content: '⚙️ **𝑉𝑖𝑛𝑐𝑢𝑙𝑎𝑟 𝑙𝑜𝑠 𝑝𝑜𝑟𝑡𝑎𝑙𝑒𝑠**\n𝑆𝑒𝑙𝑒𝑐𝑐𝑖𝑜𝑛𝑎 𝑙𝑜𝑠 𝑐𝑎𝑛𝑎𝑙𝑒𝑠 𝑝𝑜𝑟 𝑑𝑜𝑛𝑑𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑟𝑒𝑐𝑖𝑏𝑖𝑟á 𝑙𝑜𝑠 𝑒𝑐𝑜𝑠.' },
        { type: 14, spacing: 1 },
        new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('tiktok_live_channel').setPlaceholder('🎤 𝐶𝑎𝑛𝑎𝑙 𝑝𝑎𝑟𝑎 𝑣𝑜𝑐𝑒𝑠 𝑒𝑛 𝑣𝑖𝑣𝑜').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)).toJSON(),
        new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('tiktok_video_channel').setPlaceholder('🎬 𝐶𝑎𝑛𝑎𝑙 𝑝𝑎𝑟𝑎 𝑒𝑐𝑜𝑠 𝑔𝑟𝑎𝑏𝑎𝑑𝑜𝑠').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)).toJSON(),
        { type: 14, spacing: 2 },
        { type: 10, content: '🎭 **𝐴𝑡𝑒𝑛𝑑𝑒𝑟 𝑙𝑎𝑠 𝑣𝑜𝑐𝑒𝑠**\n𝐴𝑔𝑟𝑒𝑔𝑎 𝑜 𝑒𝑙𝑖𝑚𝑖𝑛𝑎 𝑙𝑜𝑠 𝑛𝑜𝑚𝑏𝑟𝑒𝑠 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑑𝑒𝑏𝑒 𝑒𝑠𝑐𝑢𝑐ℎ𝑎𝑟.' },
        { type: 14, spacing: 1 },
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('tiktok_add_user').setLabel('Añadir').setEmoji('➕').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tiktok_remove_user').setLabel('Eliminar').setEmoji('➖').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tiktok_list_users').setLabel(isList ? 'Ocultar' : 'Ver').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tiktok_clear_all_users').setLabel('Borrar todo').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
        ).toJSON(),
        { type: 14, spacing: 2 },
        { type: 10, content: '╰┈➤ˎˊ˗ 𝑅𝑒𝑡𝑢𝑟𝑛 𝑡𝑜 𝑡ℎ𝑒 𝑚𝑎𝑖𝑛 𝑝𝑜𝑟𝑡𝑎𝑙' },
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)).toJSON()
      ]
    }]
  };
}

async function twitchPanel(guildId) {
  const config = getGuildConfig(guildId);
  const twitch = config.twitch || {};
  const users = twitch.users || [];
  const showUsers = twitch.showUsers ?? false;
  const liveChannel = twitch.liveChannel || null;

  return {
    flags: 32768,
    components: [{
      type: 17, accent_color: 0x800080, spoiler: false, // Morado
      components: [
        { type: 10, content: '# ⛧°. ⋆༺ 𝑇ℎ𝑒 𝑉𝑖𝑔𝑖𝑙 ༻⋆. °⛧' },
        { type: 14, spacing: 2 },
        { type: 10, content: '### 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑤𝑎𝑡𝑐ℎ𝑒𝑠 𝑡ℎ𝑒 𝑠𝑡𝑟𝑒𝑎𝑚𝑠 𝑎𝑠 𝑡ℎ𝑒𝑦 𝑑𝑒𝑠𝑐𝑒𝑛𝑑.\n\n༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑐𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑖𝑛𝑔 𝑚𝑜𝑛𝑖𝑡𝑜𝑟𝑖𝑛𝑔… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑝𝑜𝑠𝑖𝑡𝑖𝑜𝑛𝑖𝑛𝑔 𝑤𝑎𝑡𝑐ℎ𝑡𝑜𝑤𝑒𝑟𝑠.~~𓆪༻' },
        { type: 14, spacing: 2 },
        { type: 10, content: `👁️ **𝐿𝑖𝑣𝑒 𝑆𝑡𝑟𝑒𝑎𝑚𝑠**\n𝐸𝑙 𝑝𝑜𝑟𝑡𝑎𝑙 𝑝𝑜𝑟 𝑑𝑜𝑛𝑑𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑎𝑛𝑢𝑛𝑐𝑖𝑎 𝑐𝑢𝑎𝑛𝑑𝑜 𝑙𝑎 𝑙𝑢𝑧 𝑖𝑟𝑟𝑢𝑚𝑝𝑒 𝑒𝑛 𝑙𝑎 𝑜𝑠𝑐𝑢𝑟𝑖𝑑𝑎𝑑.\n${liveChannel ? `<#${liveChannel}>` : '`No vinculado`'}\n\n👥 **𝑂𝑗𝑜𝑠 𝑉𝑖𝑔𝑖𝑙𝑎𝑛𝑡𝑒𝑠**\n${users.length} 𝑛𝑜𝑚𝑏𝑟𝑒𝑠 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑠𝑖𝑔𝑢𝑒 𝑒𝑛 𝑙𝑎 𝑒𝑡𝑒𝑟𝑛𝑖𝑑𝑎𝑑.` },
        { type: 14, spacing: 2 },
        ...(showUsers ? [{ type: 10, content: `📋 **𝑆𝑡𝑟𝑒𝑎𝑚𝑒𝑟𝑠 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑣𝑖𝑔𝑖𝑙𝑎**\n${users.length ? users.map(u => `• ${u}`).join('\n') : '`𝑁𝑖𝑛𝑔𝑢𝑛𝑎 𝑎𝑙𝑚𝑎 𝑒𝑛 𝑣𝑖𝑔𝑖𝑙𝑎𝑛𝑐𝑖𝑎`'}` }, { type: 14, spacing: 2 }] : []),
        { type: 10, content: '⚙️ **𝐶𝑎𝑛𝑎𝑙 𝑑𝑒 𝑛𝑜𝑡𝑖𝑓𝑖𝑐𝑎𝑐𝑖𝑜𝑛𝑒𝑠**\n𝑆𝑒𝑙𝑒𝑐𝑐𝑖𝑜𝑛𝑎 𝑒𝑙 𝑝𝑜𝑟𝑡𝑎𝑙 𝑑𝑜𝑛𝑑𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑝𝑟𝑜𝑐𝑙𝑎𝑚𝑎𝑟á 𝑙𝑜𝑠 𝑎𝑣𝑖𝑠𝑜𝑠.' },
        { type: 14, spacing: 1 },
        new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('twitch_live_channel').setPlaceholder('👁️ 𝐶𝑎𝑛𝑎𝑙 𝑝𝑎𝑟𝑎 𝑎𝑣𝑖𝑠𝑜𝑠 𝑑𝑒 𝑙𝑢𝑧').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)).toJSON(),
        { type: 14, spacing: 2 },
        { type: 10, content: '🎭 **𝐴𝑑𝑚𝑖𝑛𝑖𝑠𝑡𝑟𝑎𝑟 𝑣𝑖𝑔𝑖𝑙𝑎𝑛𝑡𝑒𝑠**\n𝐴𝑔𝑟𝑒𝑔𝑎 𝑜 𝑒𝑙𝑖𝑚𝑖𝑛𝑎 𝑙𝑜𝑠 𝑛𝑜𝑚𝑏𝑟𝑒𝑠 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑑𝑒𝑏𝑒 𝑣𝑖𝑔𝑖𝑙𝑎𝑟.' },
        { type: 14, spacing: 1 },
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('twitch_add_user').setLabel('Añadir').setEmoji('➕').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('twitch_remove_user').setLabel('Eliminar').setEmoji('➖').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('twitch_list_users').setLabel(showUsers ? 'Ocultar' : 'Ver').setEmoji('📋').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('twitch_clear_all_users').setLabel('Borrar todo').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
        ).toJSON(),
        { type: 14, spacing: 2 },
        { type: 10, content: '╰┈➤ˎˊ˗ 𝑅𝑒𝑡𝑢𝑟𝑛 𝑡𝑜 𝑡ℎ𝑒 𝑚𝑎𝑖𝑛 𝑝𝑜𝑟𝑡𝑎𝑙' },
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)).toJSON()
      ]
    }]
  };
}

async function youtubePanel(guildId, mode = 'default') {
  const config = getGuildConfig(guildId);
  const youtube = config.youtube || {};
  const users = youtube.users || [];
  const isList = mode === 'list';
  const liveChannel = youtube.liveChannel || null;
  const videoChannel = youtube.videoChannel || null;
  const shortChannel = youtube.shortChannel || null;

  let channelInfoList = [];
  if (isList && users.length > 0) {
    const { getChannelInfo } = require('../platforms/youtube/utils');
    for (const channelId of users.slice(0, 15)) {
      const info = await getChannelInfo(channelId);
      if (info) {
        channelInfoList.push(`• **${info.name}**\n  └ \`${info.handle || info.id}\``);
      } else {
        channelInfoList.push(`• \`${channelId}\` (⚠️ No encontrado)`);
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return {
    flags: 32768,
    components: [{
      type: 17, accent_color: 0xFF0000, spoiler: false, // Rojo
      components: [
        { type: 10, content: '# ⛧°. ⋆༺ 𝐸𝑡𝑒𝑟𝑛𝑎𝑙 𝑅𝑒𝑐𝑜𝑟𝑑𝑠 ༻⋆. °⛧' },
        { type: 14, spacing: 2 },
        { type: 10, content: '### 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑎𝑟𝑐ℎ𝑖𝑣𝑒𝑠 𝑒𝑣𝑒𝑟𝑦 𝑠𝑡𝑟𝑒𝑎𝑚 𝑎𝑛𝑑 𝑒𝑐ℎ𝑜 𝑡ℎ𝑎𝑡 𝑒𝑣𝑒𝑟 𝑒𝑥𝑖𝑠𝑡𝑠.\n\n༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑐𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑖𝑛𝑔 𝑛𝑜𝑡𝑖𝑓𝑖𝑐𝑎𝑡𝑖𝑜𝑛𝑠… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑐𝑎𝑡𝑎𝑙𝑜𝑔𝑖𝑛𝑔 𝑠𝑡𝑎𝑟𝑠.~~𓆪༻' },
        { type: 14, spacing: 2 },
        { type: 10, content: `🔴 **𝐿𝑖𝑣𝑒 𝑆𝑡𝑟𝑒𝑎𝑚𝑠**\n𝐿𝑎 𝑙𝑢𝑧 𝑞𝑢𝑒 𝑖𝑟𝑟𝑢𝑚𝑝𝑒 𝑒𝑛 𝑙𝑎 𝑜𝑠𝑐𝑢𝑟𝑖𝑑𝑎𝑑, 𝑡𝑟𝑎𝑛𝑠𝑚𝑖𝑡𝑖𝑑𝑎 𝑒𝑛 𝑣𝑖𝑣𝑜 𝑑𝑒𝑠𝑑𝑒 𝑒𝑙 𝑓𝑖𝑛 𝑑𝑒𝑙 𝑢𝑛𝑖𝑣𝑒𝑟𝑠𝑜.\n${liveChannel ? `<#${liveChannel}>` : '`No vinculado`'}\n\n📹 **𝑅𝑒𝑐𝑜𝑟𝑑𝑒𝑑 𝑉𝑖𝑠𝑖𝑜𝑛𝑠**\n𝐿𝑜𝑠 𝑒𝑐𝑜𝑠 𝑞𝑢𝑒 𝑝𝑒𝑟𝑚𝑎𝑛𝑒𝑐𝑒𝑛, 𝑔𝑟𝑎𝑏𝑎𝑑𝑜𝑠 𝑝𝑎𝑟𝑎 𝑙𝑎 𝑒𝑡𝑒𝑟𝑛𝑖𝑑𝑎𝑑 𝑒𝑛 𝑙𝑜𝑠 𝑎𝑟𝑐ℎ𝑖𝑣𝑜𝑠 𝑑𝑒𝑙 𝑣𝑎𝑐í𝑜.\n${videoChannel ? `<#${videoChannel}>` : '`No vinculado`'}\n\n📱 **𝐹𝑙𝑒𝑒𝑡𝑖𝑛𝑔 𝑊ℎ𝑖𝑠𝑝𝑒𝑟𝑠**\n𝐿𝑜𝑠 𝑠𝑢𝑠𝑢𝑟𝑟𝑜𝑠 𝑞𝑢𝑒 𝑑𝑢𝑟𝑎𝑛 𝑢𝑛 𝑖𝑛𝑠𝑡𝑎𝑛𝑡𝑒, 𝑝𝑒𝑟𝑜 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑟𝑒𝑐𝑜𝑔𝑒 𝑐𝑜𝑛 𝑎𝑛𝑠𝑖𝑎.\n${shortChannel ? `<#${shortChannel}>` : '`No vinculado`'}\n\n👁️ **𝑂𝑏𝑠𝑒𝑟𝑣𝑒𝑑 𝐶ℎ𝑎𝑛𝑛𝑒𝑙𝑠**\n${users.length} 𝑠𝑒𝑛𝑑𝑎𝑠 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑟𝑒𝑐𝑜𝑟𝑟𝑒.` },
        { type: 14, spacing: 2 },
        ...(isList && channelInfoList.length > 0 ? [
          { type: 10, content: `📋 **𝑆𝑒𝑛𝑑𝑎𝑠 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑟𝑒𝑐𝑜𝑟𝑟𝑒**\n${channelInfoList.join('\n')}` },
          { type: 14, spacing: 2 }
        ] : []),
        ...(isList && users.length === 0 ? [
          { type: 10, content: '📋 **𝑆𝑒𝑛𝑑𝑎𝑠 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑟𝑒𝑐𝑜𝑟𝑟𝑒**\n`𝑁𝑖𝑛𝑔𝑢𝑛𝑎 𝑠𝑒𝑛𝑑𝑎 𝑒𝑠𝑐𝑜𝑔𝑖𝑑𝑎`' },
          { type: 14, spacing: 2 }
        ] : []),
        { type: 10, content: '⚙️ **𝑉𝑖𝑛𝑐𝑢𝑙𝑎𝑟 𝑙𝑜𝑠 𝑝𝑜𝑟𝑡𝑎𝑙𝑒𝑠**\n𝑆𝑒𝑙𝑒𝑐𝑐𝑖𝑜𝑛𝑎 𝑙𝑜𝑠 𝑐𝑎𝑛𝑎𝑙𝑒𝑠 𝑑𝑜𝑛𝑑𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑣𝑒𝑟𝑡𝑒𝑟á 𝑐𝑎𝑑𝑎 𝑡𝑖𝑝𝑜 𝑑𝑒 𝑚𝑒𝑛𝑠𝑎𝑗𝑒.' },
        { type: 14, spacing: 1 },
        new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder().setCustomId('youtube_live_channel').setPlaceholder('🔴 𝐶𝑎𝑛𝑎𝑙 𝑝𝑎𝑟𝑎 𝑙𝑢𝑧 𝑒𝑛 𝑣𝑖𝑣𝑜').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
        ).toJSON(),
        new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder().setCustomId('youtube_video_channel').setPlaceholder('📹 𝐶𝑎𝑛𝑎𝑙 𝑝𝑎𝑟𝑎 𝑒𝑐𝑜𝑠 𝑔𝑟𝑎𝑏𝑎𝑑𝑜𝑠').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
        ).toJSON(),
        new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder().setCustomId('youtube_short_channel').setPlaceholder('📱 𝐶𝑎𝑛𝑎𝑙 𝑝𝑎𝑟𝑎 𝑠𝑢𝑠𝑢𝑟𝑟𝑜𝑠 𝑒𝑓í𝑚𝑒𝑟𝑜𝑠').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
        ).toJSON(),
        { type: 14, spacing: 2 },
        { type: 10, content: '🎭 **𝐴𝑡𝑒𝑛𝑑𝑒𝑟 𝑙𝑎𝑠 𝑠𝑒𝑛𝑑𝑎𝑠**\n𝐴𝑔𝑟𝑒𝑔𝑎 𝑜 𝑒𝑙𝑖𝑚𝑖𝑛𝑎 𝑙𝑜𝑠 𝑛𝑜𝑚𝑏𝑟𝑒𝑠 𝑞𝑢𝑒 𝑒𝑙 𝑣𝑎𝑐í𝑜 𝑑𝑒𝑏𝑒 𝑣𝑖𝑔𝑖𝑙𝑎𝑟.' },
        { type: 14, spacing: 1 },
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('youtube_add_user').setLabel('Añadir').setEmoji('➕').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('youtube_remove_user').setLabel('Eliminar').setEmoji('➖').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('youtube_list_users').setLabel(isList ? 'Ocultar' : 'Ver').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('youtube_clear_all_users').setLabel('Borrar todo').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
        ).toJSON(),
        { type: 14, spacing: 2 },
        { type: 10, content: '╰┈➤ˎˊ˗ 𝑅𝑒𝑡𝑢𝑟𝑛 𝑡𝑜 𝑡ℎ𝑒 𝑚𝑎𝑖𝑛 𝑝𝑜𝑟𝑡𝑎𝑙' },
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)
        ).toJSON()
      ]
    }]
  };
}

async function testPanel(guildId) {
  const config = getGuildConfig(guildId);
  const branding = config.branding || {};
  const tiktok = config.tiktok || {};
  const twitch = config.twitch || {};
  const youtube = config.youtube || {};
  const activeSection = config.testPanel?.activeSection || 'general';

  // Contenido dinámico según la sección activa
  let sectionContent = '';
  let sectionTitle = '';

  switch (activeSection) {
    case 'general':
      sectionTitle = '📊 **Current Configuration**';
      sectionContent = 
        `👁️ **General**\n` +
        `└ Welcome: ${config.general.welcomeChannel ? `<#${config.general.welcomeChannel}>` : '`No vinculado`'}\n` +
        `└ Goodbye: ${config.general.goodbyeChannel ? `<#${config.general.goodbyeChannel}>` : '`No vinculado`'}\n` +
        `└ Logs: ${config.general.logChannel ? `<#${config.general.logChannel}>` : '`No vinculado`'}\n` +
        `└ Bot Logs: ${config.general.botLogChannel ? `<#${config.general.botLogChannel}>` : '`No vinculado`'}\n` +
        `└ Bot Role: ${config.general.botRole ? `<@&${config.general.botRole}>` : '`No vinculado`'}\n\n` +
        `🎭 **Whispers (TikTok)**\n` +
        `└ Live Channel: ${tiktok.liveChannel ? `<#${tiktok.liveChannel}>` : '`No vinculado`'}\n` +
        `└ Video Channel: ${tiktok.videoChannel ? `<#${tiktok.videoChannel}>` : '`No vinculado`'}\n` +
        `└ Users: ${tiktok.users?.length || 0}\n\n` +
        `👁️ **The Vigil (Twitch)**\n` +
        `└ Live Channel: ${twitch.liveChannel ? `<#${twitch.liveChannel}>` : '`No vinculado`'}\n` +
        `└ Users: ${twitch.users?.length || 0}\n\n` +
        `📀 **Eternal Records (YouTube)**\n` +
        `└ Live Channel: ${youtube.liveChannel ? `<#${youtube.liveChannel}>` : '`No vinculado`'}\n` +
        `└ Video Channel: ${youtube.videoChannel ? `<#${youtube.videoChannel}>` : '`No vinculado`'}\n` +
        `└ Shorts Channel: ${youtube.shortChannel ? `<#${youtube.shortChannel}>` : '`No vinculado`'}\n` +
        `└ Users: ${youtube.users?.length || 0}\n\n` +
        `🎨 **Branding**\n` +
        `└ Name: ${branding.name || '`No configurado`'}\n` +
        `└ Avatar: ${branding.avatar ? '✅ Configurado' : '`No configurado`'}`;
      break;

    case 'tiktok':
      sectionTitle = '🎭 **Whispers - TikTok Commands**';
      sectionContent =
        '```\n' +
        '📋 COMANDOS DE GESTIÓN\n' +
        '├─ /tiktok-add <usuario>     → Añade un usuario a monitorear\n' +
        '├─ /tiktok-remove <usuario>  → Elimina un usuario del monitoreo\n' +
        '├─ /tiktok-list              → Muestra los usuarios monitoreados\n' +
        '├─ /tiktok-clear             → Elimina todos los usuarios\n' +
        '│\n' +
        '⚙️ COMANDOS DE CONFIGURACIÓN\n' +
        '├─ /tiktok-setchannel live <#canal>   → Canal para directos\n' +
        '└─ /tiktok-setchannel videos <#canal> → Canal para videos\n' +
        '│\n' +
        '🧪 COMANDOS DE PRUEBA\n' +
        '└─ /tiktok-test <usuario>    → Prueba una cuenta TikTok\n' +
        '```\n\n' +
        '📊 **Estado actual:**\n' +
        `└ Live Channel: ${tiktok.liveChannel ? `<#${tiktok.liveChannel}>` : '`No configurado`'}\n` +
        `└ Video Channel: ${tiktok.videoChannel ? `<#${tiktok.videoChannel}>` : '`No configurado`'}\n` +
        `└ Usuarios monitoreados: ${tiktok.users?.length || 0}`;
      break;

    case 'twitch':
      sectionTitle = '👁️ **The Vigil - Twitch Commands**';
      sectionContent =
        '```\n' +
        '📋 COMANDOS DE GESTIÓN\n' +
        '├─ /twitch-add <streamer>     → Añade un streamer a monitorear\n' +
        '├─ /twitch-remove <streamer>  → Elimina un streamer del monitoreo\n' +
        '├─ /twitch-list               → Muestra los streamers monitoreados\n' +
        '├─ /twitch-clear              → Elimina todos los streamers\n' +
        '│\n' +
        '⚙️ COMANDOS DE CONFIGURACIÓN\n' +
        '└─ /twitch-setchannel <#canal> → Canal para notificaciones\n' +
        '│\n' +
        '🧪 COMANDOS DE PRUEBA\n' +
        '└─ /twitch-test <streamer>    → Prueba un streamer de Twitch\n' +
        '```\n\n' +
        '📊 **Estado actual:**\n' +
        `└ Live Channel: ${twitch.liveChannel ? `<#${twitch.liveChannel}>` : '`No configurado`'}\n` +
        `└ Streamers monitoreados: ${twitch.users?.length || 0}`;
      break;

    case 'youtube':
      sectionTitle = '📀 **Eternal Records - YouTube Commands**';
      sectionContent =
        '```\n' +
        '📋 COMANDOS DE GESTIÓN\n' +
        '├─ /youtube-add <canal>       → Añade un canal a monitorear\n' +
        '├─ /youtube-remove <canal>    → Elimina un canal del monitoreo\n' +
        '├─ /youtube-list              → Muestra los canales monitoreados\n' +
        '├─ /youtube-clear             → Elimina todos los canales\n' +
        '│\n' +
        '⚙️ COMANDOS DE CONFIGURACIÓN\n' +
        '├─ /youtube-setchannel live <#canal>   → Canal para directos\n' +
        '├─ /youtube-setchannel videos <#canal> → Canal para videos\n' +
        '└─ /youtube-setchannel shorts <#canal> → Canal para shorts\n' +
        '│\n' +
        '🧪 COMANDOS DE PRUEBA\n' +
        '└─ /youtube-test <tipo> <canal> → Prueba notificaciones de YouTube\n' +
        '```\n\n' +
        '📊 **Estado actual:**\n' +
        `└ Live Channel: ${youtube.liveChannel ? `<#${youtube.liveChannel}>` : '`No configurado`'}\n` +
        `└ Video Channel: ${youtube.videoChannel ? `<#${youtube.videoChannel}>` : '`No configurado`'}\n` +
        `└ Shorts Channel: ${youtube.shortChannel ? `<#${youtube.shortChannel}>` : '`No configurado`'}\n` +
        `└ Canales monitoreados: ${youtube.users?.length || 0}`;
      break;

    case 'branding':
      sectionTitle = '🎨 **The Forge - Branding Commands**';
      sectionContent =
        '```\n' +
        '🎨 COMANDOS DE BRANDING\n' +
        '├─ /branding                   → Muestra la configuración actual\n' +
        '├─ /setbotname <nombre>        → Configura el nombre del bot\n' +
        '├─ /setbotavatar <url>         → Configura el avatar del bot\n' +
        '└─ /resetbranding              → Restablece el branding\n' +
        '```\n\n' +
        '📊 **Estado actual:**\n' +
        `└ Nombre: ${branding.name || '`No configurado`'}\n` +
        `└ Avatar: ${branding.avatar ? '✅ Configurado' : '`No configurado`'}`;
      break;

    case 'test':
      sectionTitle = '🧪 **Test Commands**';
      sectionContent =
        '```\n' +
        '🧪 COMANDOS DE PRUEBA\n' +
        '├─ /testbranding <tipo>        → Prueba el branding (general/welcome/goodbye/twitch/tiktok/tiktokvideo)\n' +
        '├─ /youtube-test <tipo> <canal> → Prueba YouTube (live/video/short/all)\n' +
        '├─ /twitch-test <streamer>     → Prueba un streamer de Twitch\n' +
        '└─ /tiktok-test <usuario>      → Prueba una cuenta de TikTok\n' +
        '```\n\n' +
        '📋 **Instrucciones:**\n' +
        '• Los embeds de prueba se enviarán a los canales configurados\n' +
        '• Verifica que el bot tenga permisos en los canales de destino\n' +
        '• Si no ves el mensaje, revisa los permisos de webhook';
      break;

    default:
      sectionTitle = '📊 **Current Configuration**';
      sectionContent = '';
  }

  return {
    flags: 32768,
    components: [{
      type: 17, accent_color: 0x00FF00, spoiler: false,
      components: [
        { type: 10, content: '# 🔮 𝑇ℎ𝑒 𝑆𝑒𝑒𝑟\'𝑠 𝐿𝑎𝑏𝑜𝑟𝑎𝑡𝑜𝑟𝑦' },
        { type: 14, spacing: 2 },
        { type: 10, content: '### 𝑊ℎ𝑒𝑟𝑒 𝑒𝑐ℎ𝑜𝑒𝑠 𝑎𝑟𝑒 𝑡𝑒𝑠𝑡𝑒𝑑 𝑎𝑛𝑑 𝑣𝑖𝑠𝑖𝑜𝑛𝑠 𝑎𝑟𝑒 𝑣𝑒𝑟𝑖𝑓𝑖𝑒𝑑.\n\n༺𓆩~~𝐵𝑒𝑓𝑜𝑟𝑒 𝑎 𝑠𝑡𝑎𝑟 𝑠ℎ𝑖𝑛𝑒𝑠 𝑖𝑛 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑, 𝑖𝑡 𝑚𝑢𝑠𝑡 𝑏𝑒 𝑠𝑢𝑚𝑚𝑜𝑛𝑒𝑑.~~𓆪༻' },
        { type: 14, spacing: 2 },
        
        // Botones de navegación entre secciones
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('test_section_general').setLabel('📊 General').setStyle(activeSection === 'general' ? ButtonStyle.Primary : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('test_section_tiktok').setLabel('🎭 Whispers').setStyle(activeSection === 'tiktok' ? ButtonStyle.Primary : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('test_section_twitch').setLabel('👁️ Vigil').setStyle(activeSection === 'twitch' ? ButtonStyle.Primary : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('test_section_youtube').setLabel('📀 Records').setStyle(activeSection === 'youtube' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        ).toJSON(),
        
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('test_section_branding').setLabel('🎨 Forge').setStyle(activeSection === 'branding' ? ButtonStyle.Primary : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('test_section_test').setLabel('🧪 Tests').setStyle(activeSection === 'test' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        ).toJSON(),
        
        { type: 14, spacing: 2 },
        
        // Contenido dinámico
        { type: 10, content: sectionTitle },
        { type: 14, spacing: 1 },
        { type: 10, content: sectionContent },
        
        { type: 14, spacing: 2 },
        { type: 10, content: '╰┈➤ˎˊ˗ 𝑅𝑒𝑡𝑢𝑟𝑛 𝑡𝑜 𝑡ℎ𝑒 𝑚𝑎𝑖𝑛 𝑝𝑜𝑟𝑡𝑎𝑙' },
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)
        ).toJSON()
      ]
    }]
  };
}

module.exports = { mainPanel, generalPanel, botPanel, brandingPanel, tiktokPanel, twitchPanel, youtubePanel, testPanel };