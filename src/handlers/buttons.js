// src/handlers/buttons.js
const { getGuildConfig, updateGuildSection, updateGuildConfig } = require('../database/mongoManager');
const { mainPanel, generalPanel, botPanel, brandingPanel, tiktokPanel, twitchPanel, youtubePanel, testPanel } = require('../dashboard/panels');
const { updateDashboard, setActivePanel, getActivePanel, updateBrandingPanel } = require('../dashboard/updater'); // ← AÑADIR updateBrandingPanel
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
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
    if (key.startsWith(`${guildId}_`)) delete data[key];
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

async function getPanelMode(guildId, platform) {
  const config = await getGuildConfig(guildId);
  if (platform === 'tiktok') return config.tiktok?.showUsers ? 'list' : 'default';
  if (platform === 'youtube') return config.youtube?.showUsers ? 'list' : 'default';
  return 'default';
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

  if (customId === 'verify_void') return verifyButton(interaction);

  // ==================================================
  // DASHBOARD NAVIGATION
  // ==================================================
  if (customId === 'dashboard_home') {
    await setActivePanel(interaction.guild.id, 'main');
    return safeUpdate(await mainPanel(interaction.guild.id));
  }
  if (customId === 'dashboard_general') {
    await setActivePanel(interaction.guild.id, 'general');
    return safeUpdate(await generalPanel(interaction.guild.id));
  }
  if (customId === 'dashboard_bot') {
    await setActivePanel(interaction.guild.id, 'bot');
    return safeUpdate(await botPanel(interaction.guild.id));
  }
  if (customId === 'dashboard_branding') {
    await setActivePanel(interaction.guild.id, 'branding');
    return safeUpdate(await brandingPanel(interaction.guild.id));
  }
  if (customId === 'dashboard_tiktok') {
    await setActivePanel(interaction.guild.id, 'tiktok');
    const mode = await getPanelMode(interaction.guild.id, 'tiktok');
    return safeUpdate(await tiktokPanel(interaction.guild.id, mode));
  }
  if (customId === 'dashboard_twitch') {
    await setActivePanel(interaction.guild.id, 'twitch');
    return safeUpdate(await twitchPanel(interaction.guild.id));
  }
  if (customId === 'dashboard_youtube') {
    await setActivePanel(interaction.guild.id, 'youtube');
    const mode = await getPanelMode(interaction.guild.id, 'youtube');
    return safeUpdate(await youtubePanel(interaction.guild.id, mode));
  }
  if (customId === 'dashboard_tests') {
    await setActivePanel(interaction.guild.id, 'tests');
    return safeUpdate(await testPanel(interaction.guild.id));
  }

  // ==================================================
  // TEST PANEL SECTION BUTTONS
  // ==================================================
  const testSections = ['general', 'tiktok', 'twitch', 'youtube', 'branding', 'test'];
  if (testSections.some(s => customId === `test_section_${s}`)) {
    const section = customId.replace('test_section_', '');
    await updateGuildSection(interaction.guild.id, 'testPanel', { activeSection: section });
    return safeUpdate(await testPanel(interaction.guild.id));
  }

  // ==================================================
  // BRANDING BUTTONS
  // ==================================================
  if (customId === 'branding_name') {
    const modal = new ModalBuilder().setCustomId('branding_name_modal').setTitle('Editar Nombre');
    const input = new TextInputBuilder().setCustomId('server_name').setLabel('Nombre del Bot').setRequired(true).setMaxLength(80).setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'branding_avatar') {
    const modal = new ModalBuilder().setCustomId('branding_avatar_modal').setTitle('Editar Avatar');
    const input = new TextInputBuilder().setCustomId('avatar_url').setLabel('URL de la Imagen').setRequired(true).setPlaceholder('https://imagen.com/avatar.png').setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'branding_reset') {
    await updateGuildSection(interaction.guild.id, 'branding', { name: null, avatar: null });
    await safeUpdate(interaction, await brandingPanel(interaction.guild.id));
    
    // ACTUALIZAR DASHBOARD DE BRANDING DIRECTAMENTE
    await updateBrandingPanel(client, interaction.guild.id);
    return;
  }

  // ==================================================
  // BOTONES DE LIMPIEZA - GENERAL PANEL
  // ==================================================
  if (customId === 'general_clear_welcome') {
    await updateGuildSection(interaction.guild.id, 'general', { welcomeChannel: null });
    await safeUpdate(interaction, await generalPanel(interaction.guild.id));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }
  if (customId === 'general_clear_goodbye') {
    await updateGuildSection(interaction.guild.id, 'general', { goodbyeChannel: null });
    await safeUpdate(interaction, await generalPanel(interaction.guild.id));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }
  if (customId === 'general_clear_log') {
    await updateGuildSection(interaction.guild.id, 'general', { logChannel: null });
    await safeUpdate(interaction, await generalPanel(interaction.guild.id));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }

  // ==================================================
  // BOTONES DE LIMPIEZA - BOT PANEL
  // ==================================================
  if (customId === 'bot_clear_role') {
    await updateGuildSection(interaction.guild.id, 'general', { botRole: null });
    await safeUpdate(interaction, await botPanel(interaction.guild.id));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }
  if (customId === 'bot_clear_log_channel') {
    await updateGuildSection(interaction.guild.id, 'general', { botLogChannel: null });
    await safeUpdate(interaction, await botPanel(interaction.guild.id));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }

  // ==================================================
  // BOTONES DE LIMPIEZA - TIKTOK PANEL
  // ==================================================
  if (customId === 'tiktok_clear_live_channel') {
    await updateGuildSection(interaction.guild.id, 'tiktok', { liveChannel: null });
    const mode = await getPanelMode(interaction.guild.id, 'tiktok');
    await safeUpdate(interaction, await tiktokPanel(interaction.guild.id, mode));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }
  if (customId === 'tiktok_clear_video_channel') {
    await updateGuildSection(interaction.guild.id, 'tiktok', { videoChannel: null });
    const mode = await getPanelMode(interaction.guild.id, 'tiktok');
    await safeUpdate(interaction, await tiktokPanel(interaction.guild.id, mode));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }
  if (customId === 'tiktok_clear_ping_role') {
    await updateGuildSection(interaction.guild.id, 'tiktok', { pingRole: null });
    const mode = await getPanelMode(interaction.guild.id, 'tiktok');
    await safeUpdate(interaction, await tiktokPanel(interaction.guild.id, mode));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }

  // ==================================================
  // BOTONES DE LIMPIEZA - TWITCH PANEL
  // ==================================================
  if (customId === 'twitch_clear_live_channel') {
    await updateGuildSection(interaction.guild.id, 'twitch', { liveChannel: null });
    await safeUpdate(interaction, await twitchPanel(interaction.guild.id));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }
  if (customId === 'twitch_clear_ping_role') {
    await updateGuildSection(interaction.guild.id, 'twitch', { pingRole: null });
    await safeUpdate(interaction, await twitchPanel(interaction.guild.id));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }

  // ==================================================
  // BOTONES DE LIMPIEZA - YOUTUBE PANEL
  // ==================================================
  if (customId === 'youtube_clear_live_channel') {
    await updateGuildSection(interaction.guild.id, 'youtube', { liveChannel: null });
    const mode = await getPanelMode(interaction.guild.id, 'youtube');
    await safeUpdate(interaction, await youtubePanel(interaction.guild.id, mode));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }
  if (customId === 'youtube_clear_video_channel') {
    await updateGuildSection(interaction.guild.id, 'youtube', { videoChannel: null });
    const mode = await getPanelMode(interaction.guild.id, 'youtube');
    await safeUpdate(interaction, await youtubePanel(interaction.guild.id, mode));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }
  if (customId === 'youtube_clear_short_channel') {
    await updateGuildSection(interaction.guild.id, 'youtube', { shortChannel: null });
    const mode = await getPanelMode(interaction.guild.id, 'youtube');
    await safeUpdate(interaction, await youtubePanel(interaction.guild.id, mode));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }
  if (customId === 'youtube_clear_ping_role') {
    await updateGuildSection(interaction.guild.id, 'youtube', { pingRole: null });
    const mode = await getPanelMode(interaction.guild.id, 'youtube');
    await safeUpdate(interaction, await youtubePanel(interaction.guild.id, mode));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }

  // ==================================================
  // TIKTOK BUTTONS
  // ==================================================
  if (customId === 'tiktok_add_user' || customId === 'tiktok_remove_user') {
    const modal = new ModalBuilder()
      .setCustomId(customId === 'tiktok_add_user' ? 'tiktok_add_modal' : 'tiktok_remove_modal')
      .setTitle(customId === 'tiktok_add_user' ? 'Añadir Usuario TikTok' : 'Eliminar Usuario TikTok');
    const input = new TextInputBuilder().setCustomId('username').setLabel('Usuario TikTok').setPlaceholder('@usuario').setRequired(true).setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'tiktok_list_users') {
    const config = await getGuildConfig(interaction.guild.id);
    const newShow = !config.tiktok?.showUsers;
    const mode = newShow ? 'list' : 'default';
    await updateGuildSection(interaction.guild.id, 'tiktok', { showUsers: newShow });
    await safeUpdate(interaction, await tiktokPanel(interaction.guild.id, mode));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }

  if (customId === 'tiktok_clear_all_users') {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Eliminar todos los usuarios de TikTok')
      .setDescription('¿Estás seguro de que quieres eliminar **todos** los usuarios de TikTok?\n\nEsta acción no se puede deshacer.')
      .setColor(0xff0000);
    const confirmButton = new ButtonBuilder().setCustomId('confirm_tiktok_delete_all').setLabel('✅ Aceptar').setStyle(ButtonStyle.Danger);
    const cancelButton = new ButtonBuilder().setCustomId('cancel_action').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
  }

  // ==================================================
  // TWITCH BUTTONS
  // ==================================================
  if (customId === 'twitch_add_user' || customId === 'twitch_remove_user') {
    const modal = new ModalBuilder()
      .setCustomId(customId === 'twitch_add_user' ? 'twitch_add_modal' : 'twitch_remove_modal')
      .setTitle(customId === 'twitch_add_user' ? 'Añadir Usuario Twitch' : 'Eliminar Usuario Twitch');
    const input = new TextInputBuilder().setCustomId('username').setLabel('Usuario Twitch').setPlaceholder('nombre_canal').setRequired(true).setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'twitch_list_users') {
    const config = await getGuildConfig(interaction.guild.id);
    await updateGuildSection(interaction.guild.id, 'twitch', { showUsers: !config.twitch?.showUsers });
    await safeUpdate(interaction, await twitchPanel(interaction.guild.id));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }

  if (customId === 'twitch_clear_all_users') {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Eliminar todos los streamers de Twitch')
      .setDescription('¿Estás seguro de que quieres eliminar **todos** los streamers de Twitch?\n\nEsta acción no se puede deshacer.')
      .setColor(0xff0000);
    const confirmButton = new ButtonBuilder().setCustomId('confirm_twitch_delete_all').setLabel('✅ Aceptar').setStyle(ButtonStyle.Danger);
    const cancelButton = new ButtonBuilder().setCustomId('cancel_action').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
  }

  // ==================================================
  // YOUTUBE BUTTONS
  // ==================================================
  if (customId === 'youtube_add_user' || customId === 'youtube_remove_user') {
    const modal = new ModalBuilder()
      .setCustomId(customId === 'youtube_add_user' ? 'youtube_add_modal' : 'youtube_remove_modal')
      .setTitle(customId === 'youtube_add_user' ? 'Añadir Canal de YouTube' : 'Eliminar Canal de YouTube');
    const input = new TextInputBuilder().setCustomId('channel_input').setLabel('URL, @handle o nombre del canal').setPlaceholder('https://youtube.com/@canal').setRequired(true).setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'youtube_list_users') {
    const config = await getGuildConfig(interaction.guild.id);
    const newShow = !config.youtube?.showUsers;
    const mode = newShow ? 'list' : 'default';
    await updateGuildSection(interaction.guild.id, 'youtube', { showUsers: newShow });
    await safeUpdate(interaction, await youtubePanel(interaction.guild.id, mode));
    
    const activePanel = await getActivePanel(interaction.guild.id);
    await updateDashboard(interaction.client, interaction.guild.id, activePanel.type, activePanel.mode);
    return;
  }

  if (customId === 'youtube_clear_all_users') {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Eliminar todos los canales de YouTube')
      .setDescription('¿Estás seguro de que quieres eliminar **todos** los canales de YouTube?\n\nEsta acción no se puede deshacer.')
      .setColor(0xff0000);
    const confirmButton = new ButtonBuilder().setCustomId('confirm_youtube_delete_all').setLabel('✅ Aceptar').setStyle(ButtonStyle.Danger);
    const cancelButton = new ButtonBuilder().setCustomId('cancel_action').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
  }

  // ==================================================
  // CONFIRM BUTTONS
  // ==================================================
  if (customId === 'confirm_tiktok_delete_all') {
    await interaction.deferUpdate();
    const guildId = interaction.guild.id;
    let config = await getGuildConfig(guildId);
    config.tiktok.users = [];
    await updateGuildConfig(guildId, config);
    cleanTikTokGuild(guildId);
    
    const successEmbed = new EmbedBuilder()
      .setDescription('✅ Todos los usuarios de TikTok han sido eliminados.')
      .setColor(0x00ff00);
    await interaction.editReply({ embeds: [successEmbed], components: [] });
    
    const activePanel = await getActivePanel(guildId);
    await updateDashboard(client, guildId, activePanel.type, activePanel.mode);
    return;
  }

  if (customId === 'confirm_twitch_delete_all') {
    await interaction.deferUpdate();
    const guildId = interaction.guild.id;
    let config = await getGuildConfig(guildId);
    config.twitch.users = [];
    await updateGuildConfig(guildId, config);
    cleanTwitchGuild(guildId);
    
    const successEmbed = new EmbedBuilder()
      .setDescription('✅ Todos los streamers de Twitch han sido eliminados.')
      .setColor(0x00ff00);
    await interaction.editReply({ embeds: [successEmbed], components: [] });
    
    const activePanel = await getActivePanel(guildId);
    await updateDashboard(client, guildId, activePanel.type, activePanel.mode);
    return;
  }

  if (customId === 'confirm_youtube_delete_all') {
    await interaction.deferUpdate();
    const guildId = interaction.guild.id;
    let config = await getGuildConfig(guildId);
    config.youtube.users = [];
    await updateGuildConfig(guildId, config);
    cleanYouTubeGuild(guildId);
    
    const successEmbed = new EmbedBuilder()
      .setDescription('✅ Todos los canales de YouTube han sido eliminados.')
      .setColor(0x00ff00);
    await interaction.editReply({ embeds: [successEmbed], components: [] });
    
    const activePanel = await getActivePanel(guildId);
    await updateDashboard(client, guildId, activePanel.type, activePanel.mode);
    return;
  }

  if (customId === 'cancel_action') {
    await interaction.deferUpdate();
    const embed = new EmbedBuilder()
      .setDescription('❌ Acción cancelada.')
      .setColor(0xff0000);
    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }
}

module.exports = { handleButton };