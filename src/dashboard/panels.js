const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType } = require('discord.js');
const { getGuildConfig } = require('../database/mongoManager');

// Función auxiliar para crear componentes correctamente
function createMessageComponents(accentColor, components) {
    return {
        components: [{
            type: 1,  // ✅ CORREGIDO: type 1 para ActionRow
            components: components
        }]
    };
}

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
    components: [row1.toJSON(), row2.toJSON()]
  };
}

async function generalPanel(guildId) {
  const config = await getGuildConfig(guildId);
  const general = config.general || {};
  
  const welcomeRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('general_welcome')
      .setPlaceholder('🔮 Canal de bienvenida')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1)
  );
  
  const goodbyeRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('general_goodbye')
      .setPlaceholder('🌑 Canal de despedida')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1)
  );
  
  const logRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('general_log')
      .setPlaceholder('📜 Canal de registros')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1)
  );
  
  const homeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)
  );

  return {
    content: `# ⛧°. ⋆༺ 𝑇ℎ𝑒 𝐸𝑦𝑒𝑠 𝑜𝑓 𝑡ℎ𝑒 𝑉𝑜𝑖𝑑 ༻⋆. °⛧\n\n### 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑠𝑒𝑒𝑠 𝑒𝑣𝑒𝑟𝑦𝑡ℎ𝑖𝑛𝑔, 𝑏𝑢𝑡 𝑖𝑡 𝑛𝑒𝑒𝑑𝑠 𝑤𝑖𝑛𝑑𝑜𝑤𝑠.\n\n༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑐𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑖𝑛𝑔 𝑐ℎ𝑎𝑛𝑛𝑒𝑙𝑠… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑜𝑝𝑒𝑛𝑖𝑛𝑔 𝑝𝑜𝑟𝑡𝑎𝑙𝑠.~~𓆪༻\n\n` +
      `👁️ **Bienvenida**\nCanal donde el vacío recibirá a los nuevos viajeros.\n${general.welcomeChannel ? `<#${general.welcomeChannel}>` : '`No vinculado`'}\n\n` +
      `👁️ **Despedida**\nCanal donde el vacío se despedirá de quienes se marchan.\n${general.goodbyeChannel ? `<#${general.goodbyeChannel}>` : '`No vinculado`'}\n\n` +
      `👁️ **Registros**\nCanal donde el vacío escribirá los sucesos del servidor.\n${general.logChannel ? `<#${general.logChannel}>` : '`No vinculado`'}\n\n` +
      `⚙️ **Vincula los portales**\nSelecciona un canal para asignarle una de las funciones del vacío.\n\n╰┈➤ˎˊ˗ Return to the main portal`,
    components: [welcomeRow.toJSON(), goodbyeRow.toJSON(), logRow.toJSON(), homeRow.toJSON()]
  };
}

async function botPanel(guildId) {
  const config = await getGuildConfig(guildId);
  const general = config.general || {};
  
  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('bot_role')
      .setPlaceholder('⚙️ Rol para máquinas')
      .setMinValues(1)
      .setMaxValues(1)
  );
  
  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('bot_log_channel')
      .setPlaceholder('📜 Canal de registros')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1)
  );
  
  const homeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)
  );

  return {
    content: `# ⛧°. ⋆༺ 𝐼𝑛𝑛𝑒𝑟 𝐶𝑙𝑜𝑐𝑘𝑤𝑜𝑟𝑘 ༻⋆. °⛧\n\n### 𝑇ℎ𝑒 𝑚𝑎𝑐ℎ𝑖𝑛𝑒𝑟𝑦 𝑡ℎ𝑎𝑡 𝑏𝑟𝑒𝑎𝑡ℎ𝑒𝑠 𝑤𝑖𝑡ℎ𝑖𝑛 𝑡ℎ𝑒 𝑟𝑒𝑙𝑖𝑐.\n\n༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑐𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑖𝑛𝑔 𝑎 𝑏𝑜𝑡… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑐𝑎𝑙𝑖𝑏𝑟𝑎𝑡𝑖𝑛𝑔 𝑖𝑡𝑠 ℎ𝑒𝑎𝑟𝑡𝑏𝑒𝑎𝑡.~~𓆪༻\n\n` +
      `⚙️ **Rol de las máquinas**\nRol que el vacío asignará a los bots automáticamente.\n${general.botRole ? `<@&${general.botRole}>` : '`No vinculado`'}\n\n` +
      `📜 **Registro de maquinaria**\nCanal donde el vacío registrará las acciones de los servidores.\n${general.botLogChannel ? `<#${general.botLogChannel}>` : '`No vinculado`'}\n\n` +
      `⚙️ **Vincula los engranajes**\nSelecciona un rol y un canal para que la maquinaria funcione en armonía.\n\n╰┈➤ˎˊ˗ Return to the main portal`,
    components: [roleRow.toJSON(), channelRow.toJSON(), homeRow.toJSON()]
  };
}

async function brandingPanel(guildId) {
  const config = await getGuildConfig(guildId);
  const branding = config.branding || {};
  
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('branding_name').setLabel('Nombre').setStyle(ButtonStyle.Secondary).setEmoji('🔥'),
    new ButtonBuilder().setCustomId('branding_avatar').setLabel('Avatar').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
    new ButtonBuilder().setCustomId('branding_reset').setLabel('Reset').setStyle(ButtonStyle.Secondary).setEmoji('⚡')
  );
  
  const homeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)
  );

  let content = `# ⛧°. ⋆༺ 𝑇ℎ𝑒 𝐹𝑜𝑟𝑔𝑒 ༻⋆. °⛧\n\n### 𝑇ℎ𝑒 𝑓𝑖𝑟𝑒𝑠 𝑡ℎ𝑎𝑡 𝑚𝑜𝑙𝑑 𝑡ℎ𝑒 𝑟𝑒𝑙𝑖𝑐\'𝑠 𝑓𝑎𝑐𝑒.\n\n༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑐𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑖𝑛𝑔 𝑏𝑟𝑎𝑛𝑑𝑖𝑛𝑔… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑓𝑜𝑟𝑔𝑖𝑛𝑔 𝑎𝑛 𝑖𝑑𝑒𝑛𝑡𝑖𝑡𝑦.~~𓆪༻\n\n` +
    `🔥 **Nombre en webhooks**\nEl nombre que se mostrará en los mensajes de webhook.\n${branding.name ? `\`${branding.name}\`` : '`Nombre del bot`'}\n\n` +
    `🎭 **Avatar en webhooks**\nLa imagen que se mostrará en los mensajes de webhook.\n${branding.avatar ? '`Forjado ✓`' : '`Avatar del bot`'}\n\n` +
    `> ⚠️ **Nota:** Esto solo afecta a los mensajes enviados por webhooks, **no cambia el nombre o avatar del bot principal**.\n\n` +
    `⚙️ **Forja la identidad**\nSelecciona qué aspecto del relicario deseas moldear.\n\n╰┈➤ˎˊ˗ Return to the main portal`;

  return {
    content: content,
    components: [buttonRow.toJSON(), homeRow.toJSON()]
  };
}

async function tiktokPanel(guildId, mode = 'default') {
  const config = await getGuildConfig(guildId);
  const tiktok = config.tiktok || {};
  const users = tiktok.users || [];
  const isList = mode === 'list';
  const liveChannel = tiktok.liveChannel || null;
  const videoChannel = tiktok.videoChannel || null;

  const liveRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('tiktok_live_channel')
      .setPlaceholder('🎤 Canal para voces en vivo')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1)
  );
  
  const videoRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('tiktok_video_channel')
      .setPlaceholder('🎬 Canal para ecos grabados')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1)
  );
  
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tiktok_add_user').setLabel('Añadir').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tiktok_remove_user').setLabel('Eliminar').setEmoji('➖').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tiktok_list_users').setLabel(isList ? 'Ocultar' : 'Ver').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tiktok_clear_all_users').setLabel('Borrar todo').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
  
  const homeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)
  );

  let content = `# ⛧°. ⋆༺ 𝑊ℎ𝑖𝑠𝑝𝑒𝑟𝑠 ༻⋆. °⛧\n\n### 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑙𝑖𝑠𝑡𝑒𝑛𝑠 𝑡𝑜 𝑓𝑙𝑒𝑒𝑡𝑖𝑛𝑔 𝑠𝑜𝑢𝑛𝑑𝑠 𝑓𝑟𝑜𝑚 𝑏𝑒𝑦𝑜𝑛𝑑.\n\n༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑠𝑒𝑡𝑡𝑖𝑛𝑔 𝑢𝑝 𝑎𝑙𝑒𝑟𝑡𝑠… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑎𝑡𝑡𝑢𝑛𝑖𝑛𝑔 𝑒𝑎𝑟𝑠 𝑡𝑜 𝑡ℎ𝑒 𝑢𝑛𝑘𝑛𝑜𝑤𝑛.~~𓆪༻\n\n` +
    `🎤 **Live Voices**\nLas voces que el vacío escucha en vivo, resonando en la inmensidad.\n${liveChannel ? `<#${liveChannel}>` : '`No vinculado`'}\n\n` +
    `🎬 **Echoes Recorded**\nLos susurros que el vacío atrapa en sus archivos para la eternidad.\n${videoChannel ? `<#${videoChannel}>` : '`No vinculado`'}\n\n` +
    `👤 **Voces Atendidas**\n${users.length} susurros que el vacío ha captado.\n\n`;

  if (isList && users.length > 0) {
    content += `📋 **Susurros que el vacío escucha**\n${users.slice(0, 25).map(u => `• ${u}`).join('\n')}${users.length > 25 ? `\n• ... y ${users.length - 25} más` : ''}\n\n`;
  } else if (isList && users.length === 0) {
    content += `📋 **Susurros que el vacío escucha**\n\`Ningún susurro atendido\`\n\n`;
  }

  content += `⚙️ **Vincular los portales**\nSelecciona los canales por donde el vacío recibirá los ecos.\n\n` +
    `🎭 **Atender las voces**\nAgrega o elimina los nombres que el vacío debe escuchar.\n\n╰┈➤ˎˊ˗ Return to the main portal`;

  return {
    content: content,
    components: [liveRow.toJSON(), videoRow.toJSON(), buttonRow.toJSON(), homeRow.toJSON()]
  };
}

async function twitchPanel(guildId) {
  const config = await getGuildConfig(guildId);
  const twitch = config.twitch || {};
  const users = twitch.users || [];
  const showUsers = twitch.showUsers ?? false;
  const liveChannel = twitch.liveChannel || null;

  const liveRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('twitch_live_channel')
      .setPlaceholder('👁️ Canal para avisos de luz')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1)
  );
  
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('twitch_add_user').setLabel('Añadir').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('twitch_remove_user').setLabel('Eliminar').setEmoji('➖').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('twitch_list_users').setLabel(showUsers ? 'Ocultar' : 'Ver').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('twitch_clear_all_users').setLabel('Borrar todo').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
  
  const homeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)
  );

  let content = `# ⛧°. ⋆༺ 𝑇ℎ𝑒 𝑉𝑖𝑔𝑖𝑙 ༻⋆. °⛧\n\n### 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑤𝑎𝑡𝑐ℎ𝑒𝑠 𝑡ℎ𝑒 𝑠𝑡𝑟𝑒𝑎𝑚𝑠 𝑎𝑠 𝑡ℎ𝑒𝑦 𝑑𝑒𝑠𝑐𝑒𝑛𝑑.\n\n༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑐𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑖𝑛𝑔 𝑚𝑜𝑛𝑖𝑡𝑜𝑟𝑖𝑛𝑔… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑝𝑜𝑠𝑖𝑡𝑖𝑜𝑛𝑖𝑛𝑔 𝑤𝑎𝑡𝑐ℎ𝑡𝑜𝑤𝑒𝑟𝑠.~~𓆪༻\n\n` +
    `👁️ **Live Streams**\nEl portal por donde el vacío anuncia cuando la luz irrumpe en la oscuridad.\n${liveChannel ? `<#${liveChannel}>` : '`No vinculado`'}\n\n` +
    `👥 **Ojos Vigilantes**\n${users.length} nombres que el vacío sigue en la eternidad.\n\n`;

  if (showUsers && users.length > 0) {
    content += `📋 **Streamers que el vacío vigila**\n${users.slice(0, 25).map(u => `• ${u}`).join('\n')}${users.length > 25 ? `\n• ... y ${users.length - 25} más` : ''}\n\n`;
  } else if (showUsers && users.length === 0) {
    content += `📋 **Streamers que el vacío vigila**\n\`Ninguna alma en vigilancia\`\n\n`;
  }

  content += `⚙️ **Canal de notificaciones**\nSelecciona el portal donde el vacío proclamará los avisos.\n\n` +
    `🎭 **Administrar vigilantes**\nAgrega o elimina los nombres que el vacío debe vigilar.\n\n╰┈➤ˎˊ˗ Return to the main portal`;

  return {
    content: content,
    components: [liveRow.toJSON(), buttonRow.toJSON(), homeRow.toJSON()]
  };
}

async function youtubePanel(guildId, mode = 'default') {
  const config = await getGuildConfig(guildId);
  const youtube = config.youtube || {};
  const users = youtube.users || [];
  const isList = mode === 'list';
  const liveChannel = youtube.liveChannel || null;
  const videoChannel = youtube.videoChannel || null;
  const shortChannel = youtube.shortChannel || null;

  const liveRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('youtube_live_channel')
      .setPlaceholder('🔴 Canal para luz en vivo')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1)
  );
  
  const videoRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('youtube_video_channel')
      .setPlaceholder('📹 Canal para ecos grabados')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1)
  );
  
  const shortRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('youtube_short_channel')
      .setPlaceholder('📱 Canal para susurros efímeros')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1)
  );
  
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('youtube_add_user').setLabel('Añadir').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('youtube_remove_user').setLabel('Eliminar').setEmoji('➖').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('youtube_list_users').setLabel(isList ? 'Ocultar' : 'Ver').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('youtube_clear_all_users').setLabel('Borrar todo').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
  
  const homeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)
  );

  let content = `# ⛧°. ⋆༺ 𝐸𝑡𝑒𝑟𝑛𝑎𝑙 𝑅𝑒𝑐𝑜𝑟𝑑𝑠 ༻⋆. °⛧\n\n### 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑎𝑟𝑐ℎ𝑖𝑣𝑒𝑠 𝑒𝑣𝑒𝑟𝑦 𝑠𝑡𝑟𝑒𝑎𝑚 𝑎𝑛𝑑 𝑒𝑐ℎ𝑜 𝑡ℎ𝑎𝑡 𝑒𝑣𝑒𝑟 𝑒𝑥𝑖𝑠𝑡𝑠.\n\n༺𓆩~~𝑌𝑜𝑢 𝑎𝑟𝑒 𝑛𝑜𝑡 𝑐𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑖𝑛𝑔 𝑛𝑜𝑡𝑖𝑓𝑖𝑐𝑎𝑡𝑖𝑜𝑛𝑠… 𝑦𝑜𝑢 𝑎𝑟𝑒 𝑐𝑎𝑡𝑎𝑙𝑜𝑔𝑖𝑛𝑔 𝑠𝑡𝑎𝑟𝑠.~~𓆪༻\n\n` +
    `🔴 **Live Streams**\nLa luz que irrumpe en la oscuridad, transmitida en vivo desde el fin del universo.\n${liveChannel ? `<#${liveChannel}>` : '`No vinculado`'}\n\n` +
    `📹 **Recorded Visions**\nLos ecos que permanecen, grabados para la eternidad en los archivos del vacío.\n${videoChannel ? `<#${videoChannel}>` : '`No vinculado`'}\n\n` +
    `📱 **Fleeting Whispers**\nLos susurros que duran un instante, pero que el vacío recoge con ansia.\n${shortChannel ? `<#${shortChannel}>` : '`No vinculado`'}\n\n` +
    `👁️ **Observed Channels**\n${users.length} sendas que el vacío recorre.\n\n`;

  if (isList && users.length > 0) {
    let channelInfoList = [];
    try {
      const { getChannelInfo } = require('../platforms/youtube/utils');
      for (const channelId of users.slice(0, 15)) {
        const info = await getChannelInfo(channelId);
        if (info) {
          channelInfoList.push(`• **${info.name}**\n  └ \`${info.handle || info.id}\``);
        } else {
          channelInfoList.push(`• \`${channelId}\` (⚠️ No encontrado)`);
        }
      }
      if (users.length > 15) {
        channelInfoList.push(`• ... y ${users.length - 15} canales más`);
      }
    } catch (error) {
      channelInfoList = [`• ${users.length} canales configurados (no se pudo cargar la información)`];
    }
    content += `📋 **Sendas que el vacío recorre**\n${channelInfoList.join('\n')}\n\n`;
  } else if (isList && users.length === 0) {
    content += `📋 **Sendas que el vacío recorre**\n\`Ninguna senda escogida\`\n\n`;
  }

  content += `⚙️ **Vincular los portales**\nSelecciona los canales donde el vacío verterá cada tipo de mensaje.\n\n` +
    `🎭 **Atender las sendas**\nAgrega o elimina los nombres que el vacío debe vigilar.\n\n╰┈➤ˎˊ˗ Return to the main portal`;

  return {
    content: content,
    components: [liveRow.toJSON(), videoRow.toJSON(), shortRow.toJSON(), buttonRow.toJSON(), homeRow.toJSON()]
  };
}

async function testPanel(guildId) {
  const config = await getGuildConfig(guildId);
  const branding = config.branding || {};
  const tiktok = config.tiktok || {};
  const twitch = config.twitch || {};
  const youtube = config.youtube || {};
  const activeSection = config.testPanel?.activeSection || 'general';

  let sectionContent = '';
  let sectionTitle = '';

  switch (activeSection) {
    case 'general':
      sectionTitle = '📊 **Current Configuration**';
      sectionContent = 
        `👁️ **General**\n` +
        `└ Welcome: ${config.general?.welcomeChannel ? `<#${config.general.welcomeChannel}>` : '`No vinculado`'}\n` +
        `└ Goodbye: ${config.general?.goodbyeChannel ? `<#${config.general.goodbyeChannel}>` : '`No vinculado`'}\n` +
        `└ Logs: ${config.general?.logChannel ? `<#${config.general.logChannel}>` : '`No vinculado`'}\n` +
        `└ Bot Logs: ${config.general?.botLogChannel ? `<#${config.general.botLogChannel}>` : '`No vinculado`'}\n` +
        `└ Bot Role: ${config.general?.botRole ? `<@&${config.general.botRole}>` : '`No vinculado`'}\n\n` +
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

  const sectionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('test_section_general').setLabel('📊 General').setStyle(activeSection === 'general' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('test_section_tiktok').setLabel('🎭 Whispers').setStyle(activeSection === 'tiktok' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('test_section_twitch').setLabel('👁️ Vigil').setStyle(activeSection === 'twitch' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('test_section_youtube').setLabel('📀 Records').setStyle(activeSection === 'youtube' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
  
  const sectionRow2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('test_section_branding').setLabel('🎨 Forge').setStyle(activeSection === 'branding' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('test_section_test').setLabel('🧪 Tests').setStyle(activeSection === 'test' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
  
  const homeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)
  );

  return {
    content: `# 🔮 𝑇ℎ𝑒 𝑆𝑒𝑒𝑟\'𝑠 𝐿𝑎𝑏𝑜𝑟𝑎𝑡𝑜𝑟𝑦\n\n### 𝑊ℎ𝑒𝑟𝑒 𝑒𝑐ℎ𝑜𝑒𝑠 𝑎𝑟𝑒 𝑡𝑒𝑠𝑡𝑒𝑑 𝑎𝑛𝑑 𝑣𝑖𝑠𝑖𝑜𝑛𝑠 𝑎𝑟𝑒 𝑣𝑒𝑟𝑖𝑓𝑖𝑒𝑑.\n\n༺𓆩~~𝐵𝑒𝑓𝑜𝑟𝑒 𝑎 𝑠𝑡𝑎𝑟 𝑠ℎ𝑖𝑛𝑒𝑠 𝑖𝑛 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑, 𝑖𝑡 𝑚𝑢𝑠𝑡 𝑏𝑒 𝑠𝑢𝑚𝑚𝑜𝑛𝑒𝑑.~~𓆪༻\n\n` +
      `${sectionTitle}\n\n${sectionContent}\n\n╰┈➤ˎˊ˗ Return to the main portal`,
    components: [sectionRow.toJSON(), sectionRow2.toJSON(), homeRow.toJSON()]
  };
}

module.exports = { mainPanel, generalPanel, botPanel, brandingPanel, tiktokPanel, twitchPanel, youtubePanel, testPanel };