// src/handlers/buttons.js
const { getGuildConfig, updateGuildSection, updateGuildConfig } = require('../database/mongoManager');
const { mainPanel, generalPanel, botPanel, brandingPanel, tiktokPanel, twitchPanel, youtubePanel, testPanel } = require('../dashboard/panels');
const { updateDashboard, setActivePanel, getActivePanel } = require('../dashboard/updater');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { checkUser } = require('../platforms/tiktok/checks');
const { verifyStreamer } = require('../platforms/twitch/utils');
const { verifyChannel } = require('../platforms/youtube/utils');
const verifyButton = require('./verifyButton');
const { requireAdministrator, requireMainGuild } = require('../utils/interactionGuards');
const { clearGuildCache: clearTikTokGuild } = require('../platforms/tiktok/monitors');
const { clearGuildCache: clearTwitchGuild } = require('../platforms/twitch/monitors');
const { clearGuildCache: clearYouTubeGuild } = require('../platforms/youtube/monitors');
const { buildDiagnosticsEmbed, buildAuditEmbed } = require('../core/DiagnosticsService');
const { controlCenterPayload, modulesPayload, historyPayload } = require('../dashboard/controlCenter');
const { CAPABILITIES, requireCapability } = require('../core/PermissionService');

async function getPanelMode(guildId, platform) {
  const config = await getGuildConfig(guildId);
  if (platform === 'tiktok') return config.tiktok?.showUsers ? 'list' : 'default';
  if (platform === 'youtube') return config.youtube?.showUsers ? 'list' : 'default';
  return 'default';
}

// ==================================================
// FUNCIÓN PARA ACTUALIZAR EL DASHBOARD DIRECTAMENTE
// ==================================================
async function updateDashboardDirectly(client, guildId) {
  try {
    const config = await getGuildConfig(guildId);
    if (!config.dashboard?.channel || !config.dashboard?.message) return false;
    
    const channel = await client.channels.fetch(config.dashboard.channel);
    if (!channel) return false;
    
    const message = await channel.messages.fetch(config.dashboard.message);
    if (!message) return false;
    
    const activePanel = await getActivePanel(guildId);
    const { getPanelForGuild } = require('../dashboard/updater');
    const panel = await getPanelForGuild(guildId, activePanel.type, activePanel.mode);
    
    await message.edit(panel);
    console.log(`[Dashboard] Actualizado directamente para guild ${guildId}, panel: ${activePanel.type}`);
    return true;
  } catch (error) {
    console.error(`[Dashboard] Error actualizando directamente:`, error);
    return false;
  }
}

async function handleButton(interaction, client) {
  // Discord puede entregar componentes sin customId (o con uno no textual).
  // Antes, `customId.startsWith` lanzaba un TypeError y tumbaba el manejador
  // entero, dejando la interacción colgada para el usuario.
  const customId = String(interaction.customId ?? '');
  if (!customId) return;

  if (customId.startsWith('community_')) {
    const { handleCommunityButton } = require('../core/CommunityService');
    if (await handleCommunityButton(interaction, client)) return;
  }

  const safeUpdate = async (data) => {
    try {
      if (!interaction.deferred && !interaction.replied) {
        return await interaction.update(data);
      }
    } catch (err) {
      if (err.code !== 10062) console.error('Update error:', err);
    }
  };

  if (customId === 'verify_void') {
    if (!await requireMainGuild(interaction)) return;
    return verifyButton(interaction);
  }

  // Todos los demás botones de este archivo administran la configuración
  // persistente del servidor. Los permisos se validan en cada interacción y no
  // solamente al crear el comando que publicó el dashboard.
  if (!await requireMainGuild(interaction)) return;

  // ==================================================
  // CENTRO DE CONTROL EXCLUSIVO DEL MAIN
  // ==================================================
  if (customId.startsWith('main_')) {
    if (!await requireCapability(interaction, CAPABILITIES.MAIN_ADMIN)) return;
    if (customId === 'main_refresh') return safeUpdate(await controlCenterPayload(interaction.guild));
    if (customId === 'main_diagnostics') return interaction.reply({ embeds: [await buildDiagnosticsEmbed(client)], flags: 64 });
    if (customId === 'main_audit') return interaction.reply({ embeds: [await buildAuditEmbed(interaction.guild)], flags: 64 });
    if (customId === 'main_modules') return interaction.reply({ ...(await modulesPayload(interaction.guild.id)), flags: 64 });
    if (customId === 'main_history') return interaction.reply({ ...(await historyPayload()), flags: 64 });
  }

  if (!await requireAdministrator(interaction)) return;

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
    await safeUpdate(await brandingPanel(interaction.guild.id));
    
    // Actualizar dashboard directamente
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }

  // ==================================================
  // BOTONES DE LIMPIEZA - GENERAL PANEL
  // ==================================================
  if (customId === 'general_clear_welcome') {
    await updateGuildSection(interaction.guild.id, 'general', { welcomeChannel: null });
    await safeUpdate(await generalPanel(interaction.guild.id));
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }
  if (customId === 'general_clear_goodbye') {
    await updateGuildSection(interaction.guild.id, 'general', { goodbyeChannel: null });
    await safeUpdate(await generalPanel(interaction.guild.id));
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }
  if (customId === 'general_clear_log') {
    await updateGuildSection(interaction.guild.id, 'general', { logChannel: null });
    await safeUpdate(await generalPanel(interaction.guild.id));
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }

  // ==================================================
  // BOTONES DE LIMPIEZA - BOT PANEL
  // ==================================================
  if (customId === 'bot_clear_role') {
    await updateGuildSection(interaction.guild.id, 'general', { botRole: null });
    await safeUpdate(await botPanel(interaction.guild.id));
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }
  if (customId === 'bot_clear_log_channel') {
    await updateGuildSection(interaction.guild.id, 'general', { botLogChannel: null });
    await safeUpdate(await botPanel(interaction.guild.id));
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }

  // ==================================================
  // BOTONES DE LIMPIEZA - TIKTOK PANEL
  // ==================================================
  if (customId === 'tiktok_clear_live_channel') {
    await updateGuildSection(interaction.guild.id, 'tiktok', { liveChannel: null });
    const mode = await getPanelMode(interaction.guild.id, 'tiktok');
    await safeUpdate(await tiktokPanel(interaction.guild.id, mode));
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }
  if (customId === 'tiktok_clear_video_channel') {
    await updateGuildSection(interaction.guild.id, 'tiktok', { videoChannel: null });
    const mode = await getPanelMode(interaction.guild.id, 'tiktok');
    await safeUpdate(await tiktokPanel(interaction.guild.id, mode));
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }
  if (customId === 'tiktok_clear_ping_role') {
    await updateGuildSection(interaction.guild.id, 'tiktok', { pingRole: null });
    const mode = await getPanelMode(interaction.guild.id, 'tiktok');
    await safeUpdate(await tiktokPanel(interaction.guild.id, mode));
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }

  // ==================================================
  // BOTONES DE LIMPIEZA - TWITCH PANEL
  // ==================================================
  if (customId === 'twitch_clear_live_channel') {
    await updateGuildSection(interaction.guild.id, 'twitch', { liveChannel: null });
    await safeUpdate(await twitchPanel(interaction.guild.id));
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }
  if (customId === 'twitch_clear_ping_role') {
    await updateGuildSection(interaction.guild.id, 'twitch', { pingRole: null });
    await safeUpdate(await twitchPanel(interaction.guild.id));
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }

  // ==================================================
  // BOTONES DE LIMPIEZA - YOUTUBE PANEL
  // ==================================================
  if (customId === 'youtube_clear_live_channel') {
    await updateGuildSection(interaction.guild.id, 'youtube', { liveChannel: null });
    const mode = await getPanelMode(interaction.guild.id, 'youtube');
    await safeUpdate(await youtubePanel(interaction.guild.id, mode));
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }
  if (customId === 'youtube_clear_video_channel') {
    await updateGuildSection(interaction.guild.id, 'youtube', { videoChannel: null });
    const mode = await getPanelMode(interaction.guild.id, 'youtube');
    await safeUpdate(await youtubePanel(interaction.guild.id, mode));
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }
  if (customId === 'youtube_clear_short_channel') {
    await updateGuildSection(interaction.guild.id, 'youtube', { shortChannel: null });
    const mode = await getPanelMode(interaction.guild.id, 'youtube');
    await safeUpdate(await youtubePanel(interaction.guild.id, mode));
    await updateDashboardDirectly(client, interaction.guild.id);
    return;
  }
  if (customId === 'youtube_clear_ping_role') {
    await updateGuildSection(interaction.guild.id, 'youtube', { pingRole: null });
    const mode = await getPanelMode(interaction.guild.id, 'youtube');
    await safeUpdate(await youtubePanel(interaction.guild.id, mode));
    await updateDashboardDirectly(client, interaction.guild.id);
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
    await safeUpdate(await tiktokPanel(interaction.guild.id, mode));
    await updateDashboardDirectly(client, interaction.guild.id);
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
    await safeUpdate(await twitchPanel(interaction.guild.id));
    await updateDashboardDirectly(client, interaction.guild.id);
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
    await safeUpdate(await youtubePanel(interaction.guild.id, mode));
    await updateDashboardDirectly(client, interaction.guild.id);
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
    await updateGuildSection(guildId, 'tiktok', { users: [] });
    await clearTikTokGuild(guildId);
    
    const successEmbed = new EmbedBuilder()
      .setDescription('✅ Todos los usuarios de TikTok han sido eliminados.')
      .setColor(0x00ff00);
    await interaction.editReply({ embeds: [successEmbed], components: [] });
    
    await updateDashboardDirectly(client, guildId);
    return;
  }

  if (customId === 'confirm_twitch_delete_all') {
    await interaction.deferUpdate();
    const guildId = interaction.guild.id;
    await updateGuildSection(guildId, 'twitch', { users: [] });
    await clearTwitchGuild(guildId);
    
    const successEmbed = new EmbedBuilder()
      .setDescription('✅ Todos los streamers de Twitch han sido eliminados.')
      .setColor(0x00ff00);
    await interaction.editReply({ embeds: [successEmbed], components: [] });
    
    await updateDashboardDirectly(client, guildId);
    return;
  }

  if (customId === 'confirm_youtube_delete_all') {
    await interaction.deferUpdate();
    const guildId = interaction.guild.id;
    await updateGuildSection(guildId, 'youtube', { users: [] });
    await clearYouTubeGuild(guildId);
    
    const successEmbed = new EmbedBuilder()
      .setDescription('✅ Todos los canales de YouTube han sido eliminados.')
      .setColor(0x00ff00);
    await interaction.editReply({ embeds: [successEmbed], components: [] });
    
    await updateDashboardDirectly(client, guildId);
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
