// src/dashboard/panels.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../database/mongoManager');

async function mainPanel(guildId) {
  const embed = new EmbedBuilder()
    .setTitle('⛧°. ⋆༺ Chronicles of the Void ༻⋆. °⛧')
    .setDescription(
      '### The void watches. The embers record every choice.\n\n' +
      '༺𓆩~~You are not configuring a bot… you are shaping a relic.~~𓆪༻\n\n' +
      '👁️ **Eyes of the Void**\n' +
      'Los portales que vigilan la entrada y salida del servidor.\n\n' +
      '⚙️ **Inner Clockwork**\n' +
      'El mecanismo que mantiene vivo el latido del relicario.\n\n' +
      '🔥 **The Forge**\n' +
      'El lugar donde se forja la identidad y el rostro del relicario.\n\n' +
      '🎭 **Whispers**\n' +
      'Los ecos que susurran desde TikTok en el vacío.\n\n' +
      '👁️ **The Vigil**\n' +
      'Los ojos que nunca duermen sobre los canales de Twitch.\n\n' +
      '📀 **Eternal Records**\n' +
      'Los archivos que guardan todo eco que surge el vacío desde YouTube.\n\n' +
      '🔮 **The Seer\'s Lab**\n' +
      'El santuario donde se prueban los ecos, las luces y los susurros.\n\n' +
      '*Select the section that calls to you.*'
    )
    .setColor(0x000000)
    .setFooter({ text: 'Vesper Bot Dashboard' });

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

  return { embeds: [embed], components: [row1, row2] };
}

async function generalPanel(guildId) {
  const config = await getGuildConfig(guildId);
  const general = config.general || {};

  const embed = new EmbedBuilder()
    .setTitle('⛧°. ⋆༺ The Eyes of the Void ༻⋆. °⛧')
    .setDescription(
      '### The void sees everything, but it needs windows.\n\n' +
      '༺𓆩~~You are not configuring channels… you are opening portals.~~𓆪༻'
    )
    .addFields(
      { name: '👁️ **Bienvenida**', value: `Canal donde el vacío recibirá a los nuevos viajeros.\n${general.welcomeChannel ? `<#${general.welcomeChannel}>` : '`No vinculado`'}`, inline: false },
      { name: '👁️ **Despedida**', value: `Canal donde el vacío se despedirá de quienes se marchan.\n${general.goodbyeChannel ? `<#${general.goodbyeChannel}>` : '`No vinculado`'}`, inline: false },
      { name: '👁️ **Registros**', value: `Canal donde el vacío escribirá los sucesos del servidor.\n${general.logChannel ? `<#${general.logChannel}>` : '`No vinculado`'}`, inline: false }
    )
    .setColor(0xFFFFFF)
    .setFooter({ text: 'Selecciona un canal para vincularlo' });

  const welcomeMenu = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('general_welcome').setPlaceholder('🔮 Canal de bienvenida').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
  );
  const goodbyeMenu = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('general_goodbye').setPlaceholder('🌑 Canal de despedida').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
  );
  const logMenu = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('general_log').setPlaceholder('📜 Canal de registros').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
  );
  const homeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('← Volver').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [welcomeMenu, goodbyeMenu, logMenu, homeButton] };
}

async function botPanel(guildId) {
  const config = await getGuildConfig(guildId);
  const general = config.general || {};

  const embed = new EmbedBuilder()
    .setTitle('⛧°. ⋆༺ Inner Clockwork ༻⋆. °⛧')
    .setDescription(
      '### The machinery that breathes within the relic.\n\n' +
      '༺𓆩~~You are not configuring a bot… you are calibrating its heartbeat.~~𓆪༻'
    )
    .addFields(
      { name: '⚙️ **Rol de las máquinas**', value: `Rol que el vacío asignará a los bots automáticamente.\n${general.botRole ? `<@&${general.botRole}>` : '`No vinculado`'}`, inline: false },
      { name: '📜 **Registro de maquinaria**', value: `Canal donde el vacío registrará las acciones de los servidores.\n${general.botLogChannel ? `<#${general.botLogChannel}>` : '`No vinculado`'}`, inline: false }
    )
    .setColor(0x808080)
    .setFooter({ text: 'Vincula los engranajes para que la maquinaria funcione' });

  const roleMenu = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder().setCustomId('bot_role').setPlaceholder('⚙️ Rol para máquinas').setMinValues(1).setMaxValues(1)
  );
  const logChannelMenu = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('bot_log_channel').setPlaceholder('📜 Canal de registros').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
  );
  const homeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('← Volver').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [roleMenu, logChannelMenu, homeButton] };
}

async function brandingPanel(guildId) {
  const config = await getGuildConfig(guildId);
  const branding = config.branding || {};

  const embed = new EmbedBuilder()
    .setTitle('⛧°. ⋆༺ The Forge ༻⋆. °⛧')
    .setDescription(
      '### The fires that mold the relic\'s face.\n\n' +
      '༺𓆩~~You are not configuring branding… you are forging an identity.~~𓆪༻'
    )
    .addFields(
      { name: '🔥 **Nombre en webhooks**', value: `El nombre que se mostrará en los mensajes de webhook.\n${branding.name ? `\`${branding.name}\`` : '`Nombre del bot`'}`, inline: false },
      { name: '🎭 **Avatar en webhooks**', value: `La imagen que se mostrará en los mensajes de webhook.\n${branding.avatar ? '`Forjado ✓`' : '`Avatar del bot`'}`, inline: false },
      { name: '⚠️ **Nota**', value: 'Esto solo afecta a los mensajes enviados por webhooks, **no cambia el nombre o avatar del bot principal**.', inline: false }
    )
    .setColor(0xFFA500)
    .setFooter({ text: 'Forja la identidad del relicario' });

  if (branding.avatar) embed.setThumbnail(branding.avatar);

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('branding_name').setLabel('Nombre').setEmoji('🔥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('branding_avatar').setLabel('Avatar').setEmoji('🎭').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('branding_reset').setLabel('Reset').setEmoji('⚡').setStyle(ButtonStyle.Secondary)
  );
  const homeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('← Volver').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [actionRow, homeButton] };
}

async function tiktokPanel(guildId, mode = 'default') {
  const config = await getGuildConfig(guildId);
  const tiktok = config.tiktok || {};
  const users = tiktok.users || [];
  const isList = mode === 'list';
  const liveChannel = tiktok.liveChannel || null;
  const videoChannel = tiktok.videoChannel || null;

  const embed = new EmbedBuilder()
    .setTitle('⛧°. ⋆༺ Whispers ༻⋆. °⛧')
    .setDescription(
      '### The void listens to fleeting sounds from beyond.\n\n' +
      '༺𓆩~~You are not setting up alerts… you are attuning ears to the unknown.~~𓆪༻'
    )
    .addFields(
      { name: '🎤 **Live Voices**', value: `Las voces que el vacío escucha en vivo.\n${liveChannel ? `<#${liveChannel}>` : '`No vinculado`'}`, inline: false },
      { name: '🎬 **Echoes Recorded**', value: `Los susurros que el vacío atrapa en sus archivos.\n${videoChannel ? `<#${videoChannel}>` : '`No vinculado`'}`, inline: false },
      { name: '👤 **Voices Attended**', value: `${users.length} susurros que el vacío ha captado.`, inline: false }
    )
    .setColor(0x1E90FF)
    .setFooter({ text: 'Ajusta los oídos del vacío' });

  if (isList && users.length > 0) {
    const userList = users.slice(0, 25).map(u => `• ${u}`).join('\n');
    const extra = users.length > 25 ? `\n• ... y ${users.length - 25} más` : '';
    embed.addFields({ name: '📋 **Susurros que el vacío escucha**', value: userList + extra, inline: false });
  } else if (isList && users.length === 0) {
    embed.addFields({ name: '📋 **Susurros que el vacío escucha**', value: '`Ningún susurro atendido`', inline: false });
  }

  const liveMenu = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('tiktok_live_channel').setPlaceholder('🎤 Canal para voces en vivo').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
  );
  const videoMenu = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('tiktok_video_channel').setPlaceholder('🎬 Canal para ecos grabados').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
  );
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tiktok_add_user').setLabel('Añadir').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tiktok_remove_user').setLabel('Eliminar').setEmoji('➖').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tiktok_list_users').setLabel(isList ? 'Ocultar' : 'Ver').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tiktok_clear_all_users').setLabel('Borrar todo').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
  const homeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('← Volver').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [liveMenu, videoMenu, actionRow, homeButton] };
}

async function twitchPanel(guildId) {
  const config = await getGuildConfig(guildId);
  const twitch = config.twitch || {};
  const users = twitch.users || [];
  const showUsers = twitch.showUsers ?? false;
  const liveChannel = twitch.liveChannel || null;

  const embed = new EmbedBuilder()
    .setTitle('⛧°. ⋆༺ The Vigil ༻⋆. °⛧')
    .setDescription(
      '### The void watches the streams as they descend.\n\n' +
      '༺𓆩~~You are not configuring monitoring… you are positioning watchtowers.~~𓆪༻'
    )
    .addFields(
      { name: '👁️ **Live Streams**', value: `El portal por donde el vacío anuncia cuando la luz irrumpe en la oscuridad.\n${liveChannel ? `<#${liveChannel}>` : '`No vinculado`'}`, inline: false },
      { name: '👥 **Ojos Vigilantes**', value: `${users.length} nombres que el vacío sigue en la eternidad.`, inline: false }
    )
    .setColor(0x800080)
    .setFooter({ text: 'Posiciona los vigilantes' });

  if (showUsers && users.length > 0) {
    const userList = users.slice(0, 25).map(u => `• ${u}`).join('\n');
    const extra = users.length > 25 ? `\n• ... y ${users.length - 25} más` : '';
    embed.addFields({ name: '📋 **Streamers que el vacío vigila**', value: userList + extra, inline: false });
  } else if (showUsers && users.length === 0) {
    embed.addFields({ name: '📋 **Streamers que el vacío vigila**', value: '`Ninguna alma en vigilancia`', inline: false });
  }

  const liveMenu = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('twitch_live_channel').setPlaceholder('👁️ Canal para avisos de luz').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
  );
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('twitch_add_user').setLabel('Añadir').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('twitch_remove_user').setLabel('Eliminar').setEmoji('➖').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('twitch_list_users').setLabel(showUsers ? 'Ocultar' : 'Ver').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('twitch_clear_all_users').setLabel('Borrar todo').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
  const homeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('← Volver').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [liveMenu, actionRow, homeButton] };
}

async function youtubePanel(guildId, mode = 'default') {
  const config = await getGuildConfig(guildId);
  const youtube = config.youtube || {};
  const users = youtube.users || [];
  const isList = mode === 'list';
  const liveChannel = youtube.liveChannel || null;
  const videoChannel = youtube.videoChannel || null;
  const shortChannel = youtube.shortChannel || null;

  const embed = new EmbedBuilder()
    .setTitle('⛧°. ⋆༺ Eternal Records ༻⋆. °⛧')
    .setDescription(
      '### The void archives every stream and echo that ever exists.\n\n' +
      '༺𓆩~~You are not configuring notifications… you are cataloging stars.~~𓆪༻'
    )
    .addFields(
      { name: '🔴 **Live Streams**', value: `La luz que irrumpe en la oscuridad.\n${liveChannel ? `<#${liveChannel}>` : '`No vinculado`'}`, inline: false },
      { name: '📹 **Recorded Visions**', value: `Los ecos que permanecen grabados.\n${videoChannel ? `<#${videoChannel}>` : '`No vinculado`'}`, inline: false },
      { name: '📱 **Fleeting Whispers**', value: `Los susurros que duran un instante.\n${shortChannel ? `<#${shortChannel}>` : '`No vinculado`'}`, inline: false },
      { name: '👁️ **Observed Channels**', value: `${users.length} sendas que el vacío recorre.`, inline: false }
    )
    .setColor(0xFF0000)
    .setFooter({ text: 'Cataloga las estrellas' });

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
        await new Promise(r => setTimeout(r, 100));
      }
      if (users.length > 15) {
        channelInfoList.push(`• ... y ${users.length - 15} canales más`);
      }
    } catch (error) {
      channelInfoList = [`• ${users.length} canales configurados (no se pudo cargar la información)`];
    }
    embed.addFields({ name: '📋 **Sendas que el vacío recorre**', value: channelInfoList.join('\n'), inline: false });
  } else if (isList && users.length === 0) {
    embed.addFields({ name: '📋 **Sendas que el vacío recorre**', value: '`Ninguna senda escogida`', inline: false });
  }

  const liveMenu = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('youtube_live_channel').setPlaceholder('🔴 Canal para luz en vivo').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
  );
  const videoMenu = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('youtube_video_channel').setPlaceholder('📹 Canal para ecos grabados').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
  );
  const shortsMenu = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('youtube_short_channel').setPlaceholder('📱 Canal para susurros efímeros').addChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)
  );
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('youtube_add_user').setLabel('Añadir').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('youtube_remove_user').setLabel('Eliminar').setEmoji('➖').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('youtube_list_users').setLabel(isList ? 'Ocultar' : 'Ver').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('youtube_clear_all_users').setLabel('Borrar todo').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
  const homeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('← Volver').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [liveMenu, videoMenu, shortsMenu, actionRow, homeButton] };
}

async function testPanel(guildId) {
  const config = await getGuildConfig(guildId);
  const branding = config.branding || {};
  const tiktok = config.tiktok || {};
  const twitch = config.twitch || {};
  const youtube = config.youtube || {};
  const activeSection = config.testPanel?.activeSection || 'general';

  let sectionTitle = '';
  let sectionContent = '';

  switch (activeSection) {
    case 'general':
      sectionTitle = '📊 **Current Configuration**';
      sectionContent = 
        '👁️ **General**\n' +
        '└ Welcome: ' + (config.general?.welcomeChannel ? `<#${config.general.welcomeChannel}>` : '`No vinculado`') + '\n' +
        '└ Goodbye: ' + (config.general?.goodbyeChannel ? `<#${config.general.goodbyeChannel}>` : '`No vinculado`') + '\n' +
        '└ Logs: ' + (config.general?.logChannel ? `<#${config.general.logChannel}>` : '`No vinculado`') + '\n' +
        '└ Bot Logs: ' + (config.general?.botLogChannel ? `<#${config.general.botLogChannel}>` : '`No vinculado`') + '\n' +
        '└ Bot Role: ' + (config.general?.botRole ? `<@&${config.general.botRole}>` : '`No vinculado`') + '\n\n' +
        '🎭 **Whispers (TikTok)**\n' +
        '└ Live Channel: ' + (tiktok.liveChannel ? `<#${tiktok.liveChannel}>` : '`No vinculado`') + '\n' +
        '└ Video Channel: ' + (tiktok.videoChannel ? `<#${tiktok.videoChannel}>` : '`No vinculado`') + '\n' +
        '└ Users: ' + (tiktok.users?.length || 0) + '\n\n' +
        '👁️ **The Vigil (Twitch)**\n' +
        '└ Live Channel: ' + (twitch.liveChannel ? `<#${twitch.liveChannel}>` : '`No vinculado`') + '\n' +
        '└ Users: ' + (twitch.users?.length || 0) + '\n\n' +
        '📀 **Eternal Records (YouTube)**\n' +
        '└ Live Channel: ' + (youtube.liveChannel ? `<#${youtube.liveChannel}>` : '`No vinculado`') + '\n' +
        '└ Video Channel: ' + (youtube.videoChannel ? `<#${youtube.videoChannel}>` : '`No vinculado`') + '\n' +
        '└ Shorts Channel: ' + (youtube.shortChannel ? `<#${youtube.shortChannel}>` : '`No vinculado`') + '\n' +
        '└ Users: ' + (youtube.users?.length || 0) + '\n\n' +
        '🎨 **Branding**\n' +
        '└ Name: ' + (branding.name || '`No configurado`') + '\n' +
        '└ Avatar: ' + (branding.avatar ? '✅ Configurado' : '`No configurado`');
      break;
    case 'tiktok':
      sectionTitle = '🎭 **Whispers - TikTok Commands**';
      sectionContent = '```\n📋 COMANDOS DE GESTIÓN\n├─ /tiktok-add <usuario>     → Añade un usuario a monitorear\n├─ /tiktok-remove <usuario>  → Elimina un usuario del monitoreo\n├─ /tiktok-list              → Muestra los usuarios monitoreados\n├─ /tiktok-clear             → Elimina todos los usuarios\n│\n⚙️ COMANDOS DE CONFIGURACIÓN\n├─ /tiktok-setchannel live <#canal>   → Canal para directos\n└─ /tiktok-setchannel videos <#canal> → Canal para videos\n│\n🧪 COMANDOS DE PRUEBA\n└─ /tiktok-test <usuario>    → Prueba una cuenta TikTok\n```\n\n📊 **Estado actual:**\n' +
        '└ Live Channel: ' + (tiktok.liveChannel ? `<#${tiktok.liveChannel}>` : '`No configurado`') + '\n' +
        '└ Video Channel: ' + (tiktok.videoChannel ? `<#${tiktok.videoChannel}>` : '`No configurado`') + '\n' +
        '└ Usuarios monitoreados: ' + (tiktok.users?.length || 0);
      break;
    case 'twitch':
      sectionTitle = '👁️ **The Vigil - Twitch Commands**';
      sectionContent = '```\n📋 COMANDOS DE GESTIÓN\n├─ /twitch-add <streamer>     → Añade un streamer a monitorear\n├─ /twitch-remove <streamer>  → Elimina un streamer del monitoreo\n├─ /twitch-list               → Muestra los streamers monitoreados\n├─ /twitch-clear              → Elimina todos los streamers\n│\n⚙️ COMANDOS DE CONFIGURACIÓN\n└─ /twitch-setchannel <#canal> → Canal para notificaciones\n│\n🧪 COMANDOS DE PRUEBA\n└─ /twitch-test <streamer>    → Prueba un streamer de Twitch\n```\n\n📊 **Estado actual:**\n' +
        '└ Live Channel: ' + (twitch.liveChannel ? `<#${twitch.liveChannel}>` : '`No configurado`') + '\n' +
        '└ Streamers monitoreados: ' + (twitch.users?.length || 0);
      break;
    case 'youtube':
      sectionTitle = '📀 **Eternal Records - YouTube Commands**';
      sectionContent = '```\n📋 COMANDOS DE GESTIÓN\n├─ /youtube-add <canal>       → Añade un canal a monitorear\n├─ /youtube-remove <canal>    → Elimina un canal del monitoreo\n├─ /youtube-list              → Muestra los canales monitoreados\n├─ /youtube-clear             → Elimina todos los canales\n│\n⚙️ COMANDOS DE CONFIGURACIÓN\n├─ /youtube-setchannel live <#canal>   → Canal para directos\n├─ /youtube-setchannel videos <#canal> → Canal para videos\n└─ /youtube-setchannel shorts <#canal> → Canal para shorts\n│\n🧪 COMANDOS DE PRUEBA\n└─ /youtube-test <tipo> <canal> → Prueba notificaciones de YouTube\n```\n\n📊 **Estado actual:**\n' +
        '└ Live Channel: ' + (youtube.liveChannel ? `<#${youtube.liveChannel}>` : '`No configurado`') + '\n' +
        '└ Video Channel: ' + (youtube.videoChannel ? `<#${youtube.videoChannel}>` : '`No configurado`') + '\n' +
        '└ Shorts Channel: ' + (youtube.shortChannel ? `<#${youtube.shortChannel}>` : '`No configurado`') + '\n' +
        '└ Canales monitoreados: ' + (youtube.users?.length || 0);
      break;
    case 'branding':
      sectionTitle = '🎨 **The Forge - Branding Commands**';
      sectionContent = '```\n🎨 COMANDOS DE BRANDING\n├─ /branding                   → Muestra la configuración actual\n├─ /setbotname <nombre>        → Configura el nombre del bot\n├─ /setbotavatar <url>         → Configura el avatar del bot\n└─ /resetbranding              → Restablece el branding\n```\n\n📊 **Estado actual:**\n' +
        '└ Nombre: ' + (branding.name || '`No configurado`') + '\n' +
        '└ Avatar: ' + (branding.avatar ? '✅ Configurado' : '`No configurado`');
      break;
    case 'test':
      sectionTitle = '🧪 **Test Commands**';
      sectionContent = '```\n🧪 COMANDOS DE PRUEBA\n├─ /testbranding <tipo>        → Prueba el branding (general/welcome/goodbye/twitch/tiktok/tiktokvideo)\n├─ /youtube-test <tipo> <canal> → Prueba YouTube (live/video/short/all)\n├─ /twitch-test <streamer>     → Prueba un streamer de Twitch\n└─ /tiktok-test <usuario>      → Prueba una cuenta de TikTok\n```\n\n📋 **Instrucciones:**\n• Los embeds de prueba se enviarán a los canales configurados\n• Verifica que el bot tenga permisos en los canales de destino\n• Si no ves el mensaje, revisa los permisos de webhook';
      break;
    default:
      sectionTitle = '📊 **Current Configuration**';
      sectionContent = '';
  }

  const embed = new EmbedBuilder()
    .setTitle('🔮 The Seer\'s Laboratory')
    .setDescription('### Where echoes are tested and visions are verified.\n\n༺𓆩~~Before a star shines in the void, it must be summoned.~~𓆪༻')
    .addFields({ name: sectionTitle, value: sectionContent || 'Selecciona una sección para ver los comandos.', inline: false })
    .setColor(0x00FF00)
    .setFooter({ text: 'El laboratorio del vidente' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('test_section_general').setLabel('📊 General').setStyle(activeSection === 'general' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('test_section_tiktok').setLabel('🎭 Whispers').setStyle(activeSection === 'tiktok' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('test_section_twitch').setLabel('👁️ Vigil').setStyle(activeSection === 'twitch' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('test_section_youtube').setLabel('📀 Records').setStyle(activeSection === 'youtube' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('test_section_branding').setLabel('🎨 Forge').setStyle(activeSection === 'branding' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('test_section_test').setLabel('🧪 Tests').setStyle(activeSection === 'test' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
  const homeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dashboard_home').setLabel('← Volver').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2, homeButton] };
}

module.exports = { mainPanel, generalPanel, botPanel, brandingPanel, tiktokPanel, twitchPanel, youtubePanel, testPanel };