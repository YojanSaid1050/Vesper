const {
  updateGuildSection,
  getGuildConfig,
  updateGuildConfig
} = require('../utils/guildManager');
const mainPanel = require('../functions/Embeds/dashboard/mainPanel');
const brandingPanel = require('../functions/Embeds/dashboard/brandingPanel');
const tiktokPanel = require('../functions/Embeds/dashboard/tiktokPanel');
const twitchPanel = require('../functions/Embeds/dashboard/twitchPanel');

const checkUser = require('../functions/TikTok/checkUser');
const checkStreamer = require('../functions/Twitch/checkStreamer');

const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// =========================
// FUNCIÓN REFRESH DASHBOARD (para panel principal)
// =========================
async function refreshDashboard(client, guildId) {
  try {
    const config = getGuildConfig(guildId);
    const channelId = config.dashboard?.channel;
    const messageId = config.dashboard?.message;

    if (!channelId || !messageId) {
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      return;
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      return;
    }

    const panel = await mainPanel(guildId);
    await message.edit(panel);
  } catch (err) {
    console.error('❌ Error refrescando dashboard', err);
  }
}

// =========================
// FUNCIÓN REFRESH BRANDING
// =========================
async function refreshBranding(client, guildId) {
  try {
    const config = getGuildConfig(guildId);
    const channelId = config.dashboard?.channel;
    const messageId = config.dashboard?.message;

    if (!channelId || !messageId) {
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      return;
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      return;
    }

    const panel = await brandingPanel(guildId);
    await message.edit(panel);
  } catch (err) {
    console.error('❌ Error refrescando branding', err);
  }
}

// =========================
// FUNCIÓN REFRESH TIKTOK
// =========================
async function refreshTikTok(client, guildId, mode = 'default') {
  try {
    const config = getGuildConfig(guildId);
    const channelId = config.dashboard?.channel;
    const messageId = config.dashboard?.message;

    if (!channelId || !messageId) {
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      return;
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      return;
    }

    const panel = await tiktokPanel(guildId, mode);
    await message.edit(panel);
  } catch (err) {
    console.error('❌ Error refrescando tiktok', err);
  }
}

// =========================
// FUNCIÓN REFRESH TWITCH
// =========================
async function refreshTwitch(client, guildId) {
  try {
    const config = getGuildConfig(guildId);
    const channelId = config.dashboard?.channel;
    const messageId = config.dashboard?.message;

    if (!channelId || !messageId) {
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      return;
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      return;
    }

    const panel = await twitchPanel(guildId);
    await message.edit(panel);
  } catch (err) {
    console.error('❌ Error refrescando twitch', err);
  }
}

// =========================
// FUNCIÓN PARA VALIDAR URL DE IMAGEN
// =========================
function isValidImageUrl(url) {
  if (!url) return false;
  
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }
    
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)(\?.*)?$/i;
    return imageExtensions.test(parsedUrl.pathname);
  } catch {
    return false;
  }
}

// =========================
// FUNCIÓN PARA NORMALIZAR ARRAYS DE USUARIOS
// =========================
function normalizeUserArray(users) {
  return [...new Set(users.map(u => u.toLowerCase()))];
}

// =========================
// PATHS
// =========================
const baseDataPath = path.join(__dirname, '..', 'data');

const twitchStatusPath = path.join(baseDataPath, 'twitch', 'status.json');
const tiktokLivePath = path.join(baseDataPath, 'tiktok', 'liveStatus.json');
const tiktokVideosPath = path.join(baseDataPath, 'tiktok', 'videos.json');

// =========================
// SAFE FS
// =========================
function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadJSON(file) {
  try {
    if (!fs.existsSync(file)) return {};
    const raw = fs.readFileSync(file, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveJSON(file, data) {
  try {
    ensureDir(file);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error(`❌ Error guardando JSON ${file}`, err);
  }
}

// =========================
// CLEANERS
// =========================

function cleanTwitchStatus(guildId, username) {
  const data = loadJSON(twitchStatusPath);
  const key = `${guildId}_${username}`;
  if (data[key] !== undefined) {
    delete data[key];
  }
  saveJSON(twitchStatusPath, data);
}

function cleanTwitchGuild(guildId) {
  const data = loadJSON(twitchStatusPath);
  for (const key of Object.keys(data)) {
    if (key.startsWith(`${guildId}_`)) {
      delete data[key];
    }
  }
  saveJSON(twitchStatusPath, data);
}

function cleanTikTokLive(guildId, username) {
  const data = loadJSON(tiktokLivePath);
  if (data[guildId] && data[guildId][username] !== undefined) {
    delete data[guildId][username];
    if (Object.keys(data[guildId]).length === 0) {
      delete data[guildId];
    }
  }
  saveJSON(tiktokLivePath, data);
}

function cleanTikTokVideos(guildId, username) {
  const data = loadJSON(tiktokVideosPath);
  if (data[guildId] && data[guildId][username] !== undefined) {
    delete data[guildId][username];
    if (Object.keys(data[guildId]).length === 0) {
      delete data[guildId];
    }
  }
  saveJSON(tiktokVideosPath, data);
}

function cleanTikTokGuild(guildId) {
  const live = loadJSON(tiktokLivePath);
  delete live[guildId];
  saveJSON(tiktokLivePath, live);

  const videos = loadJSON(tiktokVideosPath);
  delete videos[guildId];
  saveJSON(tiktokVideosPath, videos);
}

// =========================
// MODULE PRINCIPAL
// =========================
module.exports = async function dashboardModals(interaction) {
  try {
    // ==================================================
    // MANEJAR BOTONES DE CONFIRMACIÓN
    // ==================================================
    if (interaction.isButton()) {
      
      // Cancelar acción
      if (interaction.customId === 'cancel_action') {
        // Eliminar el mensaje de confirmación y volver al panel anterior
        const embed = new EmbedBuilder()
          .setDescription('❌ Acción cancelada.')
          .setColor('#ff0000');
        
        return interaction.update({
          embeds: [embed],
          components: []
        });
      }
      
      // Confirmar eliminar todos los TikTok
      if (interaction.customId === 'confirm_tiktok_delete_all') {
        await interaction.deferUpdate();
        const guildId = interaction.guild.id;
        let config = getGuildConfig(guildId);
        
        config.tiktok.users = [];
        await updateGuildConfig(guildId, config);
        cleanTikTokGuild(guildId);
        
        const showUsers = config.tiktok?.showUsers || false;
        const mode = showUsers ? 'list' : 'default';
        await refreshTikTok(interaction.client, guildId, mode);
        
        // Enviar mensaje de éxito que desaparecerá después de 3 segundos
        return interaction.followUp({
          content: '✅ Todos los usuarios de TikTok fueron eliminados.',
          flags: 64,
          ephemeral: true
        });
      }
      
      // Confirmar eliminar todos los Twitch
      if (interaction.customId === 'confirm_twitch_delete_all') {
        await interaction.deferUpdate();
        const guildId = interaction.guild.id;
        let config = getGuildConfig(guildId);
        
        config.twitch.users = [];
        await updateGuildConfig(guildId, config);
        cleanTwitchGuild(guildId);
        await refreshTwitch(interaction.client, guildId);
        
        return interaction.followUp({
          content: '✅ Todos los streamers de Twitch fueron eliminados.',
          flags: 64,
          ephemeral: true
        });
      }
      
      return;
    }

    // ==================================================
    // MANEJAR MODALS
    // ==================================================
    if (!interaction.isModalSubmit()) return;

    if (!interaction.guild) {
      return interaction.reply({ 
        flags: 64, 
        content: '❌ Este comando solo puede usarse en un servidor.' 
      });
    }

    const guildId = interaction.guild.id;
    let config = getGuildConfig(guildId);

    if (!config.tiktok) config.tiktok = { users: [] };
    if (!config.twitch) config.twitch = { users: [] };
    if (!config.dashboard) config.dashboard = {};

    config.tiktok.users = normalizeUserArray(config.tiktok.users);
    config.twitch.users = normalizeUserArray(config.twitch.users);

    // ==================================================
    // BRANDING NAME
    // ==================================================
    if (interaction.customId === 'branding_name_modal') {
      const name = interaction.fields.getTextInputValue('server_name')?.trim();
      if (!name) {
        return interaction.reply({ flags: 64, content: '❌ Nombre inválido.' });
      }

      updateGuildSection(guildId, 'branding', { name });
      await refreshBranding(interaction.client, guildId);

      return interaction.reply({
        flags: 64,
        content: '✅ Nombre actualizado correctamente.'
      });
    }

    // ==================================================
    // BRANDING AVATAR
    // ==================================================
    if (interaction.customId === 'branding_avatar_modal') {
      const avatar = interaction.fields.getTextInputValue('avatar_url')?.trim();
      
      if (!avatar) {
        return interaction.reply({
          flags: 64,
          content: '❌ URL inválida. No puede estar vacía.'
        });
      }
      
      if (!isValidImageUrl(avatar)) {
        return interaction.reply({
          flags: 64,
          content: '❌ URL inválida. Debe ser una URL de imagen válida (jpg, jpeg, png, gif, webp, bmp, svg, ico).'
        });
      }

      updateGuildSection(guildId, 'branding', { avatar });
      await refreshBranding(interaction.client, guildId);

      return interaction.reply({
        flags: 64,
        content: '✅ Avatar actualizado correctamente.'
      });
    }

    // ==================================================
    // TIKTOK ADD
    // ==================================================
    if (interaction.customId === 'tiktok_add_modal') {
      await interaction.deferReply({ flags: 64 });

      const username = interaction.fields.getTextInputValue('username')
        .replace('@', '')
        .trim()
        .toLowerCase();

      if (!username) {
        return interaction.editReply({ content: '❌ Nombre de usuario inválido.' });
      }

      const user = await checkUser(username);
      if (!user?.exists) {
        return interaction.editReply({ content: '❌ Esa cuenta TikTok no existe.' });
      }

      const realUser = user.username.toLowerCase();
      
      config.tiktok.users = normalizeUserArray(config.tiktok.users);
      
      if (config.tiktok.users.includes(realUser)) {
        return interaction.editReply({ content: '⚠️ Ya está registrado.' });
      }

      config.tiktok.users.push(realUser);
      config.tiktok.users = normalizeUserArray(config.tiktok.users);
      
      await updateGuildConfig(guildId, config);
      
      const showUsers = config.tiktok?.showUsers || false;
      const mode = showUsers ? 'list' : 'default';
      await refreshTikTok(interaction.client, guildId, mode);

      return interaction.editReply({
        content: `✅ Usuario añadido: @${realUser}`
      });
    }

    // ==================================================
    // TIKTOK REMOVE
    // ==================================================
    if (interaction.customId === 'tiktok_remove_modal') {
      await interaction.deferReply({ flags: 64 });

      const username = interaction.fields.getTextInputValue('username')
        .replace('@', '')
        .trim()
        .toLowerCase();

      if (!username) {
        return interaction.editReply({ content: '❌ Nombre de usuario inválido.' });
      }

      const before = config.tiktok.users.length;
      config.tiktok.users = config.tiktok.users.filter(u => u !== username);
      
      if (before === config.tiktok.users.length) {
        return interaction.editReply({ content: '❌ Ese usuario no está registrado.' });
      }

      await updateGuildConfig(guildId, config);
      cleanTikTokLive(guildId, username);
      cleanTikTokVideos(guildId, username);
      
      const showUsers = config.tiktok?.showUsers || false;
      const mode = showUsers ? 'list' : 'default';
      await refreshTikTok(interaction.client, guildId, mode);

      return interaction.editReply({
        content: `✅ Eliminado: @${username}`
      });
    }

    // ==================================================
    // TWITCH ADD
    // ==================================================
    if (interaction.customId === 'twitch_add_modal') {
      await interaction.deferReply({ flags: 64 });

      const username = interaction.fields.getTextInputValue('username')
        .replace('@', '')
        .trim()
        .toLowerCase();

      if (!username) {
        return interaction.editReply({ content: '❌ Nombre de usuario inválido.' });
      }

      const data = await checkStreamer(username);
      if (!data?.exists) {
        return interaction.editReply({ content: '❌ No existe.' });
      }

      config.twitch.users = normalizeUserArray(config.twitch.users);
      
      if (config.twitch.users.includes(username)) {
        return interaction.editReply({ content: '⚠️ Ya registrado.' });
      }

      config.twitch.users.push(username);
      config.twitch.users = normalizeUserArray(config.twitch.users);
      
      await updateGuildConfig(guildId, config);
      await refreshTwitch(interaction.client, guildId);

      return interaction.editReply({
        content: `✅ Streamer añadido: ${username}`
      });
    }

    // ==================================================
    // TWITCH REMOVE
    // ==================================================
    if (interaction.customId === 'twitch_remove_modal') {
      await interaction.deferReply({ flags: 64 });

      const username = interaction.fields.getTextInputValue('username')
        .replace('@', '')
        .trim()
        .toLowerCase();

      if (!username) {
        return interaction.editReply({ content: '❌ Nombre de usuario inválido.' });
      }

      const before = config.twitch.users.length;
      config.twitch.users = config.twitch.users.filter(u => u !== username);
      
      if (before === config.twitch.users.length) {
        return interaction.editReply({ content: '❌ Ese streamer no está registrado.' });
      }

      await updateGuildConfig(guildId, config);
      cleanTwitchStatus(guildId, username);
      await refreshTwitch(interaction.client, guildId);

      return interaction.editReply({
        content: `✅ Eliminado: ${username}`
      });
    }

  } catch (error) {
    console.error('❌ Error dashboardModals', error);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ Ocurrió un error al procesar tu solicitud.'
        });
      } else if (!interaction.replied) {
        await interaction.reply({
          flags: 64,
          content: '❌ Ocurrió un error al procesar tu solicitud.'
        });
      }
    } catch (err) {
      console.error('❌ Error al enviar mensaje de error:', err);
    }
  }
};