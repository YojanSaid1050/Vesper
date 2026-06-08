const { getGuildConfig, updateGuildSection, updateGuildConfig } = require('../database/guildManager');
const { mainPanel, generalPanel, botPanel, brandingPanel, tiktokPanel, twitchPanel, youtubePanel, testPanel } = require('../dashboard/panels');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkUser } = require('../platforms/tiktok/checks');
const { verifyStreamer } = require('../platforms/twitch/utils');
const { verifyChannel } = require('../platforms/youtube/utils');
const CacheManager = require('../core/CacheManager');
const verifyButton = require('./verifyButton');

const twitchCache = new CacheManager('./data/twitch');
const tiktokLiveCache = new CacheManager('./data/tiktok');
const tiktokVideosCache = new CacheManager('./data/tiktok');
const youtubeCache = new CacheManager('./data/youtube');

function cleanTwitchGuild(guildId) {
  const data = twitchCache.load('status', {});
  for (const key of Object.keys(data)) {
    if (key.startsWith(`${guildId}_`)) {
      delete data[key];
    }
  }
  twitchCache.save('status', data);
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

async function refreshYouTube(client, guildId, mode = 'default') {
  const config = getGuildConfig(guildId);
  const channelId = config.dashboard?.channel;
  const messageId = config.dashboard?.message;
  if (!channelId || !messageId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  const panel = await youtubePanel(guildId, mode);
  await message.edit(panel);
}

async function refreshTest(client, guildId) {
  const config = getGuildConfig(guildId);
  const channelId = config.dashboard?.channel;
  const messageId = config.dashboard?.message;
  if (!channelId || !messageId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  const panel = await testPanel(guildId);
  await message.edit(panel);
}

async function handleButton(interaction, client) {
  const customId = interaction.customId;

  const safeUpdate = async (data) => {
    try {
      if (!interaction.deferred && !interaction.replied) {
        return await interaction.update(data);
      }
    } catch (err) {
      if (err.code !== 10062) console.error('Update error:', err);
    }
  };

  // ==================================================
  // VERIFY BUTTON
  // ==================================================
  if (customId === 'verify_void') {
    return verifyButton(interaction);
  }

  // ==================================================
  // DASHBOARD NAVIGATION
  // ==================================================
  if (customId === 'dashboard_home') return safeUpdate(await mainPanel(interaction.guild.id));
  if (customId === 'dashboard_general') return safeUpdate(await generalPanel(interaction.guild.id));
  if (customId === 'dashboard_bot') return safeUpdate(await botPanel(interaction.guild.id));
  if (customId === 'dashboard_branding') return safeUpdate(await brandingPanel(interaction.guild.id));
  if (customId === 'dashboard_tiktok') return safeUpdate(await tiktokPanel(interaction.guild.id));
  if (customId === 'dashboard_twitch') return safeUpdate(await twitchPanel(interaction.guild.id));
  if (customId === 'dashboard_youtube') return safeUpdate(await youtubePanel(interaction.guild.id));
  if (customId === 'dashboard_tests') return safeUpdate(await testPanel(interaction.guild.id));

  // ==================================================
  // TEST PANEL SECTION BUTTONS
  // ==================================================
  if (customId === 'test_section_general') {
  updateGuildSection(interaction.guild.id, 'testPanel', { activeSection: 'general' });
  return safeUpdate(await testPanel(interaction.guild.id));
}

  if (customId === 'test_section_tiktok') {
    updateGuildSection(interaction.guild.id, 'testPanel', { activeSection: 'tiktok' });
    return safeUpdate(await testPanel(interaction.guild.id));
  }

  if (customId === 'test_section_twitch') {
    updateGuildSection(interaction.guild.id, 'testPanel', { activeSection: 'twitch' });
    return safeUpdate(await testPanel(interaction.guild.id));
  }

  if (customId === 'test_section_youtube') {
    updateGuildSection(interaction.guild.id, 'testPanel', { activeSection: 'youtube' });
    return safeUpdate(await testPanel(interaction.guild.id));
  }

  if (customId === 'test_section_branding') {
    updateGuildSection(interaction.guild.id, 'testPanel', { activeSection: 'branding' });
    return safeUpdate(await testPanel(interaction.guild.id));
  }

  if (customId === 'test_section_test') {
    updateGuildSection(interaction.guild.id, 'testPanel', { activeSection: 'test' });
    return safeUpdate(await testPanel(interaction.guild.id));
  }

  // ==================================================
  // BRANDING BUTTONS
  // ==================================================
  if (customId === 'branding_name') {
    const modal = new ModalBuilder()
      .setCustomId('branding_name_modal')
      .setTitle('Editar Nombre');
    const input = new TextInputBuilder()
      .setCustomId('server_name')
      .setLabel('Nombre del Bot')
      .setRequired(true)
      .setMaxLength(80)
      .setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'branding_avatar') {
    const modal = new ModalBuilder()
      .setCustomId('branding_avatar_modal')
      .setTitle('Editar Avatar');
    const input = new TextInputBuilder()
      .setCustomId('avatar_url')
      .setLabel('URL de la Imagen')
      .setRequired(true)
      .setPlaceholder('https://imagen.com/avatar.png')
      .setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'branding_reset') {
    updateGuildSection(interaction.guild.id, 'branding', { name: null, avatar: null });
    return safeUpdate(await brandingPanel(interaction.guild.id));
  }

  // ==================================================
  // TIKTOK BUTTONS
  // ==================================================
  if (customId === 'tiktok_add_user') {
    const modal = new ModalBuilder()
      .setCustomId('tiktok_add_modal')
      .setTitle('Añadir Usuario TikTok');
    const input = new TextInputBuilder()
      .setCustomId('username')
      .setLabel('Usuario TikTok')
      .setPlaceholder('@usuario')
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'tiktok_remove_user') {
    const modal = new ModalBuilder()
      .setCustomId('tiktok_remove_modal')
      .setTitle('Eliminar Usuario TikTok');
    const input = new TextInputBuilder()
      .setCustomId('username')
      .setLabel('Usuario TikTok')
      .setPlaceholder('@usuario')
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'tiktok_list_users') {
    const config = getGuildConfig(interaction.guild.id);
    const mode = config.tiktok?.showUsers ? 'default' : 'list';
    updateGuildSection(interaction.guild.id, 'tiktok', { showUsers: !config.tiktok?.showUsers });
    return safeUpdate(await tiktokPanel(interaction.guild.id, mode));
  }

  if (customId === 'tiktok_clear_all_users') {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Eliminar todos los usuarios de TikTok')
      .setDescription('¿Estás seguro de que quieres eliminar **todos** los usuarios de TikTok?\n\nEsta acción no se puede deshacer.')
      .setColor('#ff0000')
      .setFooter({ text: 'Confirma para continuar' });

    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_tiktok_delete_all')
      .setLabel('✅ Aceptar')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_action')
      .setLabel('❌ Cancelar')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    return interaction.reply({
      embeds: [embed],
      components: [row],
      flags: 64
    });
  }

  // ==================================================
  // TWITCH BUTTONS
  // ==================================================
  if (customId === 'twitch_add_user') {
    const modal = new ModalBuilder()
      .setCustomId('twitch_add_modal')
      .setTitle('Añadir Usuario Twitch');
    const input = new TextInputBuilder()
      .setCustomId('username')
      .setLabel('Usuario Twitch')
      .setPlaceholder('nombre_canal')
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'twitch_remove_user') {
    const modal = new ModalBuilder()
      .setCustomId('twitch_remove_modal')
      .setTitle('Eliminar Usuario Twitch');
    const input = new TextInputBuilder()
      .setCustomId('username')
      .setLabel('Usuario Twitch')
      .setPlaceholder('nombre_canal')
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'twitch_list_users') {
    const config = getGuildConfig(interaction.guild.id);
    updateGuildSection(interaction.guild.id, 'twitch', { showUsers: !config.twitch?.showUsers });
    return safeUpdate(await twitchPanel(interaction.guild.id));
  }

  if (customId === 'twitch_clear_all_users') {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Eliminar todos los streamers de Twitch')
      .setDescription('¿Estás seguro de que quieres eliminar **todos** los streamers de Twitch?\n\nEsta acción no se puede deshacer.')
      .setColor('#ff0000')
      .setFooter({ text: 'Confirma para continuar' });

    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_twitch_delete_all')
      .setLabel('✅ Aceptar')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_action')
      .setLabel('❌ Cancelar')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    return interaction.reply({
      embeds: [embed],
      components: [row],
      flags: 64
    });
  }

  // ==================================================
  // YOUTUBE BUTTONS
  // ==================================================
  if (customId === 'youtube_add_user') {
    const modal = new ModalBuilder()
      .setCustomId('youtube_add_modal')
      .setTitle('Añadir Canal de YouTube');
    const input = new TextInputBuilder()
      .setCustomId('channel_input')
      .setLabel('URL, @handle o nombre del canal')
      .setPlaceholder('https://youtube.com/@MrBeast')
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'youtube_remove_user') {
    const modal = new ModalBuilder()
      .setCustomId('youtube_remove_modal')
      .setTitle('Eliminar Canal de YouTube');
    const input = new TextInputBuilder()
      .setCustomId('channel_input')
      .setLabel('URL, @handle o nombre del canal')
      .setPlaceholder('@MrBeast')
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'youtube_list_users') {
    const config = getGuildConfig(interaction.guild.id);
    const mode = config.youtube?.showUsers ? 'default' : 'list';
    updateGuildSection(interaction.guild.id, 'youtube', { showUsers: !config.youtube?.showUsers });
    return safeUpdate(await youtubePanel(interaction.guild.id, mode));
  }

  if (customId === 'youtube_clear_all_users') {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Eliminar todos los canales de YouTube')
      .setDescription('¿Estás seguro de que quieres eliminar **todos** los canales de YouTube?\n\nEsta acción no se puede deshacer.')
      .setColor('#ff0000')
      .setFooter({ text: 'Confirma para continuar' });

    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_youtube_delete_all')
      .setLabel('✅ Aceptar')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_action')
      .setLabel('❌ Cancelar')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    return interaction.reply({
      embeds: [embed],
      components: [row],
      flags: 64
    });
  }

  // ==================================================
  // CONFIRM BUTTONS
  // ==================================================
  if (customId === 'confirm_tiktok_delete_all') {
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

  if (customId === 'confirm_twitch_delete_all') {
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

  if (customId === 'confirm_youtube_delete_all') {
    await interaction.deferUpdate();
    const guildId = interaction.guild.id;
    let config = getGuildConfig(guildId);
    config.youtube.users = [];
    await updateGuildConfig(guildId, config);
    cleanYouTubeGuild(guildId);
    const mode = config.youtube?.showUsers ? 'list' : 'default';
    await refreshYouTube(interaction.client, guildId, mode);
    return interaction.followUp({
      content: '✅ Todos los canales de YouTube fueron eliminados.',
      flags: 64
    });
  }

  if (customId === 'youtube_clear_confirm') {
    await interaction.deferUpdate();
    const config = getGuildConfig(interaction.guild.id);
    updateGuildSection(interaction.guild.id, 'youtube', { ...config.youtube, users: [] });
    cleanYouTubeGuild(interaction.guild.id);
    const mode = config.youtube?.showUsers ? 'list' : 'default';
    await refreshYouTube(interaction.client, interaction.guild.id, mode);
    return interaction.update({ content: '✅ Se eliminaron todos los canales del monitoreo de YouTube.', embeds: [], components: [] });
  }

  if (customId === 'youtube_clear_cancel') {
    return interaction.update({ content: '❌ Operación cancelada.', embeds: [], components: [] });
  }

  if (customId === 'cancel_action') {
    const embed = new EmbedBuilder()
      .setDescription('❌ Acción cancelada.')
      .setColor('#ff0000');
    return interaction.update({ embeds: [embed], components: [] });
  }

  console.log(`Botón no manejado: ${customId}`);
}

module.exports = { handleButton };