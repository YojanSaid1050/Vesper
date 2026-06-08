const { updateGuildSection, getGuildConfig, updateGuildConfig } = require('../database/guildManager');
const { brandingPanel, tiktokPanel, twitchPanel, mainPanel } = require('../dashboard/panels');
const { checkUser } = require('../platforms/tiktok/checks');
const { verifyStreamer } = require('../platforms/twitch/utils');
const CacheManager = require('../core/CacheManager');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const twitchCache = new CacheManager('./data/twitch');
const tiktokLiveCache = new CacheManager('./data/tiktok');
const tiktokVideosCache = new CacheManager('./data/tiktok');

// ==================================================
// FUNCIONES DE REFRESH
// ==================================================

async function refreshDashboard(client, guildId) {
  const config = getGuildConfig(guildId);
  const channelId = config.dashboard?.channel;
  const messageId = config.dashboard?.message;
  if (!channelId || !messageId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  const panel = await mainPanel(guildId);
  await message.edit(panel);
}

async function refreshBranding(client, guildId) {
  const config = getGuildConfig(guildId);
  const channelId = config.dashboard?.channel;
  const messageId = config.dashboard?.message;
  if (!channelId || !messageId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  const panel = await brandingPanel(guildId);
  await message.edit(panel);
}

async function refreshTikTok(client, guildId, mode = 'default') {
  const config = getGuildConfig(guildId);
  const channelId = config.dashboard?.channel;
  const messageId = config.dashboard?.message;
  if (!channelId || !messageId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  const panel = await tiktokPanel(guildId, mode);
  await message.edit(panel);
}

async function refreshTwitch(client, guildId) {
  const config = getGuildConfig(guildId);
  const channelId = config.dashboard?.channel;
  const messageId = config.dashboard?.message;
  if (!channelId || !messageId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  const panel = await twitchPanel(guildId);
  await message.edit(panel);
}

// ==================================================
// FUNCIONES DE VALIDACIÓN
// ==================================================

function isValidImageUrl(url) {
  if (!url) return false;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return false;
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)(\?.*)?$/i.test(parsedUrl.pathname);
  } catch { return false; }
}

function normalizeUserArray(users) {
  return [...new Set(users.map(u => u.toLowerCase()))];
}

// ==================================================
// FUNCIONES DE LIMPIEZA (CLEANERS)
// ==================================================

function cleanTwitchStatus(guildId, username) {
  const data = twitchCache.load('status', {});
  const key = `${guildId}_${username}`;
  if (data[key] !== undefined) {
    delete data[key];
    twitchCache.save('status', data);
  }
}

function cleanTwitchGuild(guildId) {
  const data = twitchCache.load('status', {});
  for (const key of Object.keys(data)) {
    if (key.startsWith(`${guildId}_`)) {
      delete data[key];
    }
  }
  twitchCache.save('status', data);
}

function cleanTikTokLive(guildId, username) {
  const data = tiktokLiveCache.load('liveStatus', {});
  if (data[guildId] && data[guildId][username] !== undefined) {
    delete data[guildId][username];
    if (Object.keys(data[guildId]).length === 0) {
      delete data[guildId];
    }
    tiktokLiveCache.save('liveStatus', data);
  }
}

function cleanTikTokVideos(guildId, username) {
  const data = tiktokVideosCache.load('videos', {});
  if (data[guildId] && data[guildId][username] !== undefined) {
    delete data[guildId][username];
    if (Object.keys(data[guildId]).length === 0) {
      delete data[guildId];
    }
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

// ==================================================
// FUNCIÓN PARA REFRESCAR PANEL DESPUÉS DE ACCIONES
// ==================================================

async function refreshPanel(interaction, panelFn, ...args) {
  const panel = await panelFn(interaction.guild.id, ...args);
  try {
    await interaction.update(panel);
  } catch {
    await interaction.message.edit(panel);
  }
}

// ==================================================
// HANDLER PRINCIPAL
// ==================================================

async function handleModal(interaction, client) {
  // Manejar botones de confirmación
  if (interaction.isButton()) {
    if (interaction.customId === 'cancel_action') {
      const embed = new EmbedBuilder()
        .setDescription('❌ Acción cancelada.')
        .setColor('#ff0000');
      return interaction.update({ embeds: [embed], components: [] });
    }

    if (interaction.customId === 'confirm_tiktok_delete_all') {
      await interaction.deferUpdate();
      const guildId = interaction.guild.id;
      let config = getGuildConfig(guildId);
      config.tiktok.users = [];
      await updateGuildConfig(guildId, config);
      cleanTikTokGuild(guildId);
      const mode = config.tiktok?.showUsers ? 'list' : 'default';
      await refreshTikTok(interaction.client, guildId, mode);
      return interaction.followUp({
        content: '✅ Todos los usuarios de TikTok fueron eliminados.',
        flags: 64
      });
    }

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
        flags: 64
      });
    }

    if (interaction.customId === 'youtube_clear_confirm') {
      await interaction.deferUpdate();
      const config = getGuildConfig(interaction.guild.id);
      updateGuildSection(interaction.guild.id, 'youtube', { ...config.youtube, users: [] });
      return interaction.update({ content: '✅ Se eliminaron todos los canales del monitoreo de YouTube.', embeds: [], components: [] });
    }

    if (interaction.customId === 'youtube_clear_cancel') {
      await interaction.deferUpdate();
      return interaction.update({ content: '❌ Operación cancelada.', embeds: [], components: [] });
    }

    if (interaction.customId === 'tiktok_clear_confirm') {
      await interaction.deferUpdate();
      const config = getGuildConfig(interaction.guild.id);
      updateGuildSection(interaction.guild.id, 'tiktok', { ...config.tiktok, users: [] });
      cleanTikTokGuild(interaction.guild.id);
      return interaction.update({ content: '✅ Se eliminaron todos los usuarios del monitoreo de TikTok.', embeds: [], components: [] });
    }

    if (interaction.customId === 'tiktok_clear_cancel') {
      await interaction.deferUpdate();
      return interaction.update({ content: '❌ Operación cancelada.', embeds: [], components: [] });
    }

    if (interaction.customId === 'twitch_clear_confirm') {
      await interaction.deferUpdate();
      const config = getGuildConfig(interaction.guild.id);
      updateGuildSection(interaction.guild.id, 'twitch', { ...config.twitch, users: [] });
      cleanTwitchGuild(interaction.guild.id);
      return interaction.update({ content: '✅ Se eliminaron todos los streamers del monitoreo de Twitch.', embeds: [], components: [] });
    }

    if (interaction.customId === 'twitch_clear_cancel') {
      await interaction.deferUpdate();
      return interaction.update({ content: '❌ Operación cancelada.', embeds: [], components: [] });
    }

    return;
  }

  // Manejar modales
  if (!interaction.isModalSubmit()) return;

  if (!interaction.guild) {
    return interaction.reply({ content: '❌ Este comando solo puede usarse en un servidor.', flags: 64 });
  }

  const guildId = interaction.guild.id;
  let config = getGuildConfig(guildId);
  if (!config.tiktok) config.tiktok = { users: [] };
  if (!config.twitch) config.twitch = { users: [] };
  config.tiktok.users = normalizeUserArray(config.tiktok.users);
  config.twitch.users = normalizeUserArray(config.twitch.users);

  // Branding Name
  if (interaction.customId === 'branding_name_modal') {
    const name = interaction.fields.getTextInputValue('server_name')?.trim();
    if (name) {
      updateGuildSection(guildId, 'branding', { name });
      await refreshBranding(interaction.client, guildId);
      return interaction.reply({ content: '✅ Nombre actualizado correctamente.', flags: 64 });
    }
    return interaction.reply({ content: '❌ Nombre inválido.', flags: 64 });
  }

  // Branding Avatar
  if (interaction.customId === 'branding_avatar_modal') {
    const avatar = interaction.fields.getTextInputValue('avatar_url')?.trim();
    if (avatar && isValidImageUrl(avatar)) {
      updateGuildSection(guildId, 'branding', { avatar });
      await refreshBranding(interaction.client, guildId);
      return interaction.reply({ content: '✅ Avatar actualizado correctamente.', flags: 64 });
    }
    return interaction.reply({ content: '❌ URL de imagen inválida.', flags: 64 });
  }

  // TikTok Add
  if (interaction.customId === 'tiktok_add_modal') {
    await interaction.deferReply({ flags: 64 });
    const username = interaction.fields.getTextInputValue('username').replace('@', '').trim().toLowerCase();
    if (!username) return interaction.editReply({ content: '❌ Nombre de usuario inválido.' });

    const user = await checkUser(username);
    if (!user?.exists) return interaction.editReply({ content: '❌ Esa cuenta TikTok no existe.' });

    const realUser = user.username.toLowerCase();
    if (config.tiktok.users.includes(realUser)) return interaction.editReply({ content: '⚠️ Ya está registrado.' });

    config.tiktok.users.push(realUser);
    config.tiktok.users = normalizeUserArray(config.tiktok.users);
    await updateGuildConfig(guildId, config);

    const mode = config.tiktok?.showUsers ? 'list' : 'default';
    await refreshTikTok(interaction.client, guildId, mode);
    return interaction.editReply({ content: `✅ Usuario añadido: @${realUser}` });
  }

  // TikTok Remove
  if (interaction.customId === 'tiktok_remove_modal') {
    await interaction.deferReply({ flags: 64 });
    const username = interaction.fields.getTextInputValue('username').replace('@', '').trim().toLowerCase();
    if (!username) return interaction.editReply({ content: '❌ Nombre de usuario inválido.' });

    if (!config.tiktok.users.includes(username)) return interaction.editReply({ content: '❌ Ese usuario no está registrado.' });

    config.tiktok.users = config.tiktok.users.filter(u => u !== username);
    await updateGuildConfig(guildId, config);
    cleanTikTokLive(guildId, username);
    cleanTikTokVideos(guildId, username);

    const mode = config.tiktok?.showUsers ? 'list' : 'default';
    await refreshTikTok(interaction.client, guildId, mode);
    return interaction.editReply({ content: `✅ Eliminado: @${username}` });
  }

  // Twitch Add
  if (interaction.customId === 'twitch_add_modal') {
    await interaction.deferReply({ flags: 64 });
    const username = interaction.fields.getTextInputValue('username').replace('@', '').trim().toLowerCase();
    if (!username) return interaction.editReply({ content: '❌ Nombre de usuario inválido.' });

    const data = await verifyStreamer(username);
    if (!data?.exists) return interaction.editReply({ content: '❌ Ese canal de Twitch no existe.' });

    if (config.twitch.users.includes(username)) return interaction.editReply({ content: '⚠️ Ya registrado.' });

    config.twitch.users.push(username);
    config.twitch.users = normalizeUserArray(config.twitch.users);
    await updateGuildConfig(guildId, config);

    await refreshTwitch(interaction.client, guildId);
    return interaction.editReply({ content: `✅ Streamer añadido: ${username}` });
  }

  // Twitch Remove
  if (interaction.customId === 'twitch_remove_modal') {
    await interaction.deferReply({ flags: 64 });
    const username = interaction.fields.getTextInputValue('username').replace('@', '').trim().toLowerCase();
    if (!username) return interaction.editReply({ content: '❌ Nombre de usuario inválido.' });

    if (!config.twitch.users.includes(username)) return interaction.editReply({ content: '❌ Ese streamer no está registrado.' });

    config.twitch.users = config.twitch.users.filter(u => u !== username);
    await updateGuildConfig(guildId, config);
    cleanTwitchStatus(guildId, username);

    await refreshTwitch(interaction.client, guildId);
    return interaction.editReply({ content: `✅ Eliminado: ${username}` });
  }
}

module.exports = { handleModal, refreshDashboard, refreshBranding, refreshTikTok, refreshTwitch };