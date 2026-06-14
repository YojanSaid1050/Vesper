// src/handlers/selects.js
const { updateGuildSection, getGuildConfig } = require('../database/mongoManager');
const { generalPanel, botPanel, tiktokPanel, twitchPanel, youtubePanel } = require('../dashboard/panels');
const { updateDashboard, getActivePanel } = require('../dashboard/updater');

// Función para actualizar el dashboard usando webhook
async function updateDashboardWithWebhook(client, guildId, channel, messageId, panel) {
  try {
    const hooks = await channel.fetchWebhooks().catch(() => []);
    let webhook = hooks.find(hook => hook.owner?.id === client.user.id);
    
    if (!webhook) {
      webhook = await channel.createWebhook({
        name: 'Vesper Dashboard',
        reason: 'Dashboard update webhook'
      }).catch(() => null);
    }
    
    if (webhook) {
      const config = await getGuildConfig(guildId);
      const branding = config.branding || {};
      
      await webhook.editMessage(messageId, {
        ...panel,
        username: branding.name || client.user.username,
        avatarURL: branding.avatar || client.user.displayAvatarURL()
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating dashboard with webhook:', error);
    return false;
  }
}

async function getPanelMode(guildId, platform) {
  const config = await getGuildConfig(guildId);
  if (platform === 'tiktok') return config.tiktok?.showUsers ? 'list' : 'default';
  if (platform === 'youtube') return config.youtube?.showUsers ? 'list' : 'default';
  return 'default';
}

async function handleSelect(interaction, client) {
  if (!interaction.guild) return;

  await interaction.deferUpdate();
  const guildId = interaction.guild.id;
  const selectedValue = interaction.values[0];
  const customId = interaction.customId;

  const updateAndRefresh = async (section, data, panelType, mode = 'default') => {
    await updateGuildSection(guildId, section, data);
    
    let updatedPanel;
    switch (panelType) {
      case 'general':
        updatedPanel = await generalPanel(guildId);
        break;
      case 'bot':
        updatedPanel = await botPanel(guildId);
        break;
      case 'tiktok':
        const tiktokMode = mode === 'auto' ? await getPanelMode(guildId, 'tiktok') : mode;
        updatedPanel = await tiktokPanel(guildId, tiktokMode);
        break;
      case 'twitch':
        updatedPanel = await twitchPanel(guildId);
        break;
      case 'youtube':
        const youtubeMode = mode === 'auto' ? await getPanelMode(guildId, 'youtube') : mode;
        updatedPanel = await youtubePanel(guildId, youtubeMode);
        break;
    }
    
    // Obtener configuración del dashboard
    const config = await getGuildConfig(guildId);
    
    if (config.dashboard?.channel && config.dashboard?.message) {
      const channel = await client.channels.fetch(config.dashboard.channel).catch(() => null);
      if (channel) {
        // Actualizar usando webhook
        await updateDashboardWithWebhook(client, guildId, channel, config.dashboard.message, updatedPanel);
      } else {
        // Fallback a editReply
        await interaction.editReply(updatedPanel);
      }
    } else {
      await interaction.editReply(updatedPanel);
    }
    
    const currentPanel = await getActivePanel(guildId);
    await updateDashboard(client, guildId, currentPanel.type, currentPanel.mode);
  };

  const configMap = {
    general_welcome: { section: 'general', data: { welcomeChannel: selectedValue }, panel: 'general' },
    general_goodbye: { section: 'general', data: { goodbyeChannel: selectedValue }, panel: 'general' },
    general_log: { section: 'general', data: { logChannel: selectedValue }, panel: 'general' },
    bot_role: { section: 'general', data: { botRole: selectedValue }, panel: 'bot' },
    bot_log_channel: { section: 'general', data: { botLogChannel: selectedValue }, panel: 'bot' },
    tiktok_live_channel: { section: 'tiktok', data: { liveChannel: selectedValue }, panel: 'tiktok', mode: 'auto' },
    tiktok_video_channel: { section: 'tiktok', data: { videoChannel: selectedValue }, panel: 'tiktok', mode: 'auto' },
    twitch_live_channel: { section: 'twitch', data: { liveChannel: selectedValue }, panel: 'twitch' },
    youtube_live_channel: { section: 'youtube', data: { liveChannel: selectedValue }, panel: 'youtube', mode: 'auto' },
    youtube_video_channel: { section: 'youtube', data: { videoChannel: selectedValue }, panel: 'youtube', mode: 'auto' },
    youtube_short_channel: { section: 'youtube', data: { shortChannel: selectedValue }, panel: 'youtube', mode: 'auto' }
  };

  const config = configMap[customId];
  if (config) {
    await updateAndRefresh(config.section, config.data, config.panel, config.mode || 'default');
  }
}

module.exports = { handleSelect };