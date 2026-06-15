const { updateGuildSection, getGuildConfig, updateGuildConfig } = require('../database/mongoManager');
const { brandingPanel, tiktokPanel, twitchPanel, youtubePanel } = require('../dashboard/panels');
const { updateDashboard, getActivePanel } = require('../dashboard/updater');
const { checkUser } = require('../platforms/tiktok/checks');
const { verifyStreamer } = require('../platforms/twitch/utils');
const { verifyChannel } = require('../platforms/youtube/utils');
const { clearWebhookCache } = require('../utils/webhookSender');
const CacheManager = require('../core/CacheManager');
const { EmbedBuilder } = require('discord.js');

const twitchCache = new CacheManager('./data/twitch');
const tiktokLiveCache = new CacheManager('./data/tiktok');
const tiktokVideosCache = new CacheManager('./data/tiktok');
const youtubeCache = new CacheManager('./data/youtube');

// Función para responder al modal y procesar en segundo plano
async function processModalAsync(interaction, client, callback) {
  await interaction.reply({ 
    content: '⏳ **Procesando solicitud...**\n\nLa verificación puede tomar unos segundos. Te notificaré cuando termine.', 
    flags: 64 
  });
  
  setTimeout(async () => {
    try {
      const result = await callback();
      
      const followUp = {
        content: result.message,
        flags: 64
      };
      
      if (result.embed) {
        followUp.embeds = [result.embed];
      }
      
      await interaction.followUp(followUp);
      
      const activePanel = await getActivePanel(interaction.guild.id);
      await updateDashboard(client, interaction.guild.id, activePanel.type, activePanel.mode);
      
    } catch (error) {
      console.error('Error en procesamiento asíncrono:', error);
      await interaction.followUp({ 
        content: `❌ Error: ${error.message}`, 
        flags: 64 
      });
    }
  }, 100);
}

async function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return false;
    const contentType = response.headers.get('content-type');
    return contentType && contentType.startsWith('image/');
  } catch {
    return false;
  }
}

// Función para normalizar arrays según la plataforma
function normalizeUserArray(users, platform = 'general') {
  if (platform === 'youtube') {
    // Los IDs de YouTube son case-sensitive, mantener original
    return [...new Set(users)];
  }
  // Para TikTok y Twitch, los usernames no son case-sensitive
  return [...new Set(users.map(u => u.toLowerCase()))];
}

function cleanTwitchStatus(guildId, username) {
  const data = twitchCache.load('status', {});
  const key = `${guildId}_${username}`;
  if (data[key] !== undefined) delete data[key];
  twitchCache.save('status', data);
}

function cleanTwitchGuild(guildId) {
  const data = twitchCache.load('status', {});
  for (const key of Object.keys(data)) {
    if (key.startsWith(`${guildId}_`)) delete data[key];
  }
  twitchCache.save('status', data);
}

function cleanTikTokLive(guildId, username) {
  const data = tiktokLiveCache.load('liveStatus', {});
  if (data[guildId] && data[guildId][username] !== undefined) {
    delete data[guildId][username];
    if (Object.keys(data[guildId]).length === 0) delete data[guildId];
    tiktokLiveCache.save('liveStatus', data);
  }
}

function cleanTikTokVideos(guildId, username) {
  const data = tiktokVideosCache.load('videos', {});
  if (data[guildId] && data[guildId][username] !== undefined) {
    delete data[guildId][username];
    if (Object.keys(data[guildId]).length === 0) delete data[guildId];
    tiktokVideosCache.save('videos', data);
  }
}

function cleanTikTokGuild(guildId) {
  const live = tiktokLiveCache.load('liveStatus', {});
  delete live[guildId];
  tiktokLiveCache.save('liveStatus', live);
  const videos = tiktokVideosCache.load('videos', {});
  delete videos[guildId];
  tiktokVideosCache.save('videos', videos);
}

function cleanYouTubeGuild(guildId) {
  const liveStatus = youtubeCache.load('liveStatus', {});
  delete liveStatus[guildId];
  youtubeCache.save('liveStatus', liveStatus);
  const videos = youtubeCache.load('videos', {});
  delete videos[guildId];
  youtubeCache.save('videos', videos);
  const shorts = youtubeCache.load('shorts', {});
  delete shorts[guildId];
  youtubeCache.save('shorts', shorts);
}

async function handleModal(interaction, client) {
  if (!interaction.isModalSubmit()) return;
  if (!interaction.guild) {
    try {
      await interaction.reply({ content: '❌ Este comando solo puede usarse en un servidor.', flags: 64 });
    } catch (e) {}
    return;
  }

  const guildId = interaction.guild.id;
  
  // Branding Name (solo para webhooks, NO cambia el bot)
  if (interaction.customId === 'branding_name_modal') {
    const name = interaction.fields.getTextInputValue('server_name')?.trim();
    if (name) {
      await updateGuildSection(guildId, 'branding', { name });
      clearWebhookCache(guildId);
    }
    await interaction.reply({ 
      content: `✅ Nombre de webhooks actualizado a: **${name}**\n\n> ⚠️ **Nota:** Esto NO cambia el nombre del bot principal.`, 
      flags: 64 
    });
    const activePanel = await getActivePanel(guildId);
    await updateDashboard(client, guildId, activePanel.type, activePanel.mode);
    return;
  }

  // Branding Avatar (solo para webhooks, NO cambia el bot)
  if (interaction.customId === 'branding_avatar_modal') {
    const avatar = interaction.fields.getTextInputValue('avatar_url')?.trim();
    
    if (!avatar) {
      await interaction.reply({ content: '❌ URL inválida.', flags: 64 });
      return;
    }
    
    await interaction.reply({ content: '🔍 Verificando imagen...', flags: 64 });
    
    const isValid = await isValidImageUrl(avatar);
    
    if (!isValid) {
      return interaction.editReply({ 
        content: '❌ URL inválida. Asegúrate de que:\n• La URL sea válida\n• Apunte a una imagen (jpg, jpeg, png, gif, webp)\n• La imagen sea accesible públicamente' 
      });
    }
    
    await updateGuildSection(guildId, 'branding', { avatar });
    clearWebhookCache(guildId);
    
    await interaction.editReply({ 
      content: `✅ Avatar de webhooks actualizado.\n\n> ⚠️ **Nota:** Esto NO cambia el avatar del bot principal.`, 
      flags: 64 
    });
    
    const activePanel = await getActivePanel(guildId);
    await updateDashboard(client, guildId, activePanel.type, activePanel.mode);
    return;
  }

  // TikTok Add
  if (interaction.customId === 'tiktok_add_modal') {
    const username = interaction.fields.getTextInputValue('username').replace('@', '').trim().toLowerCase();
    
    if (!username) {
      await interaction.reply({ content: '❌ Nombre de usuario inválido.', flags: 64 });
      return;
    }
    
    await processModalAsync(interaction, client, async () => {
      const user = await checkUser(username);
      
      if (!user?.exists) {
        return { message: `❌ No se encontró el usuario **@${username}** en TikTok.\n\nVerifica que el nombre sea correcto.` };
      }
      
      const realUser = user.username.toLowerCase();
      let config = await getGuildConfig(guildId);
      if (!config.tiktok) config.tiktok = { users: [] };
      config.tiktok.users = normalizeUserArray(config.tiktok.users, 'tiktok');
      
      if (config.tiktok.users.includes(realUser)) {
        return { message: `⚠️ El usuario **@${realUser}** ya está en la lista de monitoreo.` };
      }
      
      config.tiktok.users.push(realUser);
      config.tiktok.users = normalizeUserArray(config.tiktok.users, 'tiktok');
      await updateGuildConfig(guildId, config);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Usuario añadido')
        .setDescription(`**@${realUser}** ha sido añadido a la lista de monitoreo.`)
        .addFields(
          { name: '📊 Total usuarios', value: `${config.tiktok.users.length}`, inline: true },
          { name: '🎭 Nickname', value: user.nickname || realUser, inline: true }
        )
        .setColor(0x00FF00)
        .setTimestamp();
      
      return { message: `✅ **@${realUser}** añadido correctamente.`, embed };
    });
    return;
  }

  // TikTok Remove
  if (interaction.customId === 'tiktok_remove_modal') {
    const username = interaction.fields.getTextInputValue('username').replace('@', '').trim().toLowerCase();
    
    if (!username) {
      await interaction.reply({ content: '❌ Nombre de usuario inválido.', flags: 64 });
      return;
    }
    
    await processModalAsync(interaction, client, async () => {
      let config = await getGuildConfig(guildId);
      if (!config.tiktok) config.tiktok = { users: [] };
      config.tiktok.users = normalizeUserArray(config.tiktok.users, 'tiktok');
      
      const existingUser = config.tiktok.users.find(u => u === username);
      
      if (!existingUser) {
        return { message: `❌ El usuario **@${username}** no está en la lista de monitoreo.\n\nUsa /tiktok-list para ver los usuarios actuales.` };
      }
      
      config.tiktok.users = config.tiktok.users.filter(u => u !== username);
      await updateGuildConfig(guildId, config);
      cleanTikTokLive(guildId, existingUser);
      cleanTikTokVideos(guildId, existingUser);
      
      return { message: `✅ **@${existingUser}** eliminado de la lista de monitoreo.\n\n📋 Usuarios restantes: ${config.tiktok.users.length}` };
    });
    return;
  }

  // Twitch Add
  if (interaction.customId === 'twitch_add_modal') {
    const username = interaction.fields.getTextInputValue('username').replace('@', '').trim().toLowerCase();
    
    if (!username) {
      await interaction.reply({ content: '❌ Nombre de usuario inválido.', flags: 64 });
      return;
    }
    
    await processModalAsync(interaction, client, async () => {
      const data = await verifyStreamer(username);
      
      if (!data?.exists) {
        return { message: `❌ No se encontró el streamer **${username}** en Twitch.\n\nVerifica que el nombre sea correcto.` };
      }
      
      let config = await getGuildConfig(guildId);
      if (!config.twitch) config.twitch = { users: [] };
      config.twitch.users = normalizeUserArray(config.twitch.users, 'twitch');
      
      if (config.twitch.users.includes(username)) {
        return { message: `⚠️ El streamer **${data.name}** ya está en la lista de monitoreo.` };
      }
      
      config.twitch.users.push(username);
      config.twitch.users = normalizeUserArray(config.twitch.users, 'twitch');
      await updateGuildConfig(guildId, config);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Streamer añadido')
        .setDescription(`**${data.name}** ha sido añadido a la lista de monitoreo.`)
        .addFields(
          { name: '📊 Total streamers', value: `${config.twitch.users.length}`, inline: true },
          { name: '🎭 Login', value: data.login, inline: true }
        )
        .setThumbnail(data.avatar)
        .setColor(0x9146FF)
        .setTimestamp();
      
      return { message: `✅ **${data.name}** añadido correctamente.`, embed };
    });
    return;
  }

  // Twitch Remove
  if (interaction.customId === 'twitch_remove_modal') {
    const username = interaction.fields.getTextInputValue('username').replace('@', '').trim().toLowerCase();
    
    if (!username) {
      await interaction.reply({ content: '❌ Nombre de usuario inválido.', flags: 64 });
      return;
    }
    
    await processModalAsync(interaction, client, async () => {
      let config = await getGuildConfig(guildId);
      if (!config.twitch) config.twitch = { users: [] };
      config.twitch.users = normalizeUserArray(config.twitch.users, 'twitch');
      
      const existingUser = config.twitch.users.find(u => u === username);
      
      if (!existingUser) {
        return { message: `❌ El streamer **${username}** no está en la lista de monitoreo.\n\nUsa /twitch-list para ver los streamers actuales.` };
      }
      
      config.twitch.users = config.twitch.users.filter(u => u !== username);
      await updateGuildConfig(guildId, config);
      cleanTwitchStatus(guildId, existingUser);
      
      return { message: `✅ **${existingUser}** eliminado de la lista de monitoreo.\n\n📋 Streamers restantes: ${config.twitch.users.length}` };
    });
    return;
  }

  // YouTube Add - CORREGIDO
  if (interaction.customId === 'youtube_add_modal') {
    const input = interaction.fields.getTextInputValue('channel_input').trim();
    
    if (!input) {
      await interaction.reply({ content: '❌ Nombre de canal inválido.', flags: 64 });
      return;
    }
    
    await processModalAsync(interaction, client, async () => {
      const channel = await verifyChannel(input);
      
      if (!channel.exists) {
        return { message: `❌ No se encontró el canal **${input}** en YouTube.\n\nVerifica que el nombre, handle o URL sea correcto.` };
      }
      
      let config = await getGuildConfig(guildId);
      if (!config.youtube) config.youtube = { users: [] };
      // YouTube: NO convertir a minúsculas, mantener ID original case-sensitive
      config.youtube.users = normalizeUserArray(config.youtube.users, 'youtube');
      
      // Comparación case-sensitive para YouTube IDs
      const channelId = channel.id;
      const exists = config.youtube.users.some(id => id === channelId);
      
      if (exists) {
        return { message: `⚠️ El canal **${channel.name}** ya está en la lista de monitoreo.` };
      }
      
      config.youtube.users.push(channelId);
      config.youtube.users = normalizeUserArray(config.youtube.users, 'youtube');
      await updateGuildConfig(guildId, config);
      
      console.log(`[YouTube] Canal guardado con ID: ${channelId} (original: ${channel.id})`);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Canal añadido')
        .setDescription(`**${channel.name}** ha sido añadido a la lista de monitoreo.`)
        .addFields(
          { name: '📊 Total canales', value: `${config.youtube.users.length}`, inline: true },
          { name: '👥 Suscriptores', value: channel.subscribers?.toLocaleString() || 'N/A', inline: true },
          { name: '📺 Handle', value: `@${channel.handle || channel.id}`, inline: true },
          { name: '🆔 ID', value: channel.id, inline: false }
        )
        .setThumbnail(channel.avatar)
        .setColor(0xFF0000)
        .setTimestamp();
      
      return { message: `✅ **${channel.name}** añadido correctamente.`, embed };
    });
    return;
  }

  // YouTube Remove
if (interaction.customId === 'youtube_remove_modal') {
  const input = interaction.fields.getTextInputValue('channel_input').trim();
  
  if (!input) {
    await interaction.reply({ content: '❌ Nombre de canal inválido.', flags: 64 });
    return;
  }
  
  await processModalAsync(interaction, client, async () => {
    let config = await getGuildConfig(guildId);
    if (!config.youtube) config.youtube = { users: [] };
    config.youtube.users = normalizeUserArray(config.youtube.users, 'youtube');
    
    let foundChannelId = null;
    let foundChannelName = null;
    
    for (const channelId of config.youtube.users) {
      const info = await verifyChannel(channelId);
      if (info.exists) {
        const inputLower = input.toLowerCase();
        const handleLower = info.handle?.toLowerCase();
        const nameLower = info.name?.toLowerCase();
        
        if (channelId === input || handleLower === inputLower || nameLower === inputLower) {
          foundChannelId = channelId;
          foundChannelName = info.name;
          break;
        }
      }
    }
    
    if (!foundChannelId) {
      return { message: `❌ No se encontró el canal **${input}** en la lista de monitoreo.\n\nUsa /youtube-list para ver los canales actuales.` };
    }
    
    config.youtube.users = config.youtube.users.filter(u => u !== foundChannelId);
    await updateGuildConfig(guildId, config);
    
    const { cleanYouTubeChannelCache } = require('../platforms/youtube/monitors');
    cleanYouTubeChannelCache(guildId, foundChannelId);  // ✅ Solo borra la caché del canal eliminado
    
    return { message: `✅ **${foundChannelName || foundChannelId}** eliminado de la lista de monitoreo.\n\n📋 Canales restantes: ${config.youtube.users.length}` };
  });
  return;
}
}

module.exports = { handleModal };