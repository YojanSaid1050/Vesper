const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAllGuildConfigs, updateGuildSection, getGuildConfig } = require('../database/mongoManager');
const { 
  mainPanel, 
  generalPanel, 
  botPanel, 
  brandingPanel, 
  tiktokPanel, 
  twitchPanel, 
  youtubePanel,
  testPanel 
} = require('./panels');

// Mapa para almacenar el panel activo de cada guild
const activePanels = new Map();

async function getPanelForGuild(guildId, panelType = 'main', mode = 'default') {
  console.log(`[DEBUG] getPanelForGuild: guild=${guildId}, type=${panelType}, mode=${mode}`);
  
  switch (panelType) {
    case 'main':
      return await mainPanel(guildId);
    case 'general':
      return await generalPanel(guildId);
    case 'bot':
      return await botPanel(guildId);
    case 'branding':
      return await brandingPanel(guildId);
    case 'tiktok':
      return await tiktokPanel(guildId, mode);
    case 'twitch':
      return await twitchPanel(guildId);
    case 'youtube':
      return await youtubePanel(guildId, mode);
    case 'tests':
      return await testPanel(guildId);
    default:
      return await mainPanel(guildId);
  }
}

async function updateDashboard(client, guildId = null, panelType = null, mode = 'default') {
  try {
    console.log(`[DEBUG] updateDashboard llamado: guildId=${guildId}, panelType=${panelType}, mode=${mode}`);
    
    let guildsToUpdate = [];
    
    if (guildId) {
      const config = await getGuildConfig(guildId);
      if (config && config.dashboard?.channel && config.dashboard?.message) {
        const currentPanel = activePanels.get(guildId) || { 
          type: panelType || config.dashboard?.currentPanel || 'main', 
          mode: mode 
        };
        guildsToUpdate.push({
          guildId,
          dashboard: config.dashboard,
          currentPanel: currentPanel
        });
      } else {
        console.log(`[DEBUG] Guild ${guildId} no tiene dashboard configurado`);
      }
    } else {
      const guildsConfig = await getAllGuildConfigs();
      guildsToUpdate = Object.entries(guildsConfig || {})
        .map(([id, config]) => ({
          guildId: id,
          dashboard: config.dashboard || {},
          currentPanel: activePanels.get(id) || { type: config.dashboard?.currentPanel || 'main', mode: 'default' }
        }))
        .filter(g => g.dashboard?.channel && g.dashboard?.message);
    }
    
    console.log(`[DEBUG] Guilds a actualizar: ${guildsToUpdate.length}`);
    
    let updated = 0, failed = 0, cleaned = 0;

    for (const guild of guildsToUpdate) {
      try {
        const channel = await client.channels.fetch(guild.dashboard.channel).catch(() => null);
        if (!channel) {
          console.log(`[DEBUG] Canal ${guild.dashboard.channel} no encontrado, limpiando...`);
          await updateGuildSection(guild.guildId, 'dashboard', { channel: null, message: null });
          cleaned++;
          continue;
        }

        const message = await channel.messages.fetch(guild.dashboard.message).catch(() => null);
        if (!message) {
          console.log(`[DEBUG] Mensaje ${guild.dashboard.message} no encontrado, limpiando...`);
          await updateGuildSection(guild.guildId, 'dashboard', { channel: null, message: null });
          cleaned++;
          continue;
        }

        const panel = await getPanelForGuild(guild.guildId, guild.currentPanel.type, guild.currentPanel.mode);
        await message.edit(panel);
        console.log(`[DEBUG] ✅ Dashboard actualizado para guild ${guild.guildId}`);
        updated++;
      } catch (err) {
        console.error(`[DEBUG] Error actualizando guild ${guild.guildId}:`, err.message);
        failed++;
        if (err.code === 10008 || err.code === 10003) {
          await updateGuildSection(guild.guildId, 'dashboard', { channel: null, message: null });
          cleaned++;
        }
      }
    }

    console.log(`[DEBUG] Resultado: updated=${updated}, failed=${failed}, cleaned=${cleaned}`);
    return { updated, failed, cleaned };
  } catch (error) {
    console.error('❌ Error en updateDashboard:', error);
    return { updated: 0, failed: 1, cleaned: 0 };
  }
}

async function setActivePanel(guildId, panelType, mode = 'default') {
  console.log(`[DEBUG] setActivePanel: guild=${guildId}, type=${panelType}, mode=${mode}`);
  activePanels.set(guildId, { type: panelType, mode });
  await updateGuildSection(guildId, 'dashboard', { currentPanel: panelType, currentMode: mode });
}

async function getActivePanel(guildId) {
  if (activePanels.has(guildId)) {
    return activePanels.get(guildId);
  }
  const config = await getGuildConfig(guildId);
  if (config?.dashboard?.currentPanel) {
    const panelData = { 
      type: config.dashboard.currentPanel, 
      mode: config.dashboard.currentMode || 'default' 
    };
    activePanels.set(guildId, panelData);
    return panelData;
  }
  return { type: 'main', mode: 'default' };
}

async function refreshPanelAfterChange(client, guildId, changedSection) {
  const activePanel = await getActivePanel(guildId);
  console.log(`[DEBUG] refreshPanelAfterChange: guild=${guildId}, changedSection=${changedSection}, activePanel=${activePanel.type}`);
  
  if ((changedSection === 'tiktok' && activePanel.type === 'tiktok') ||
      (changedSection === 'twitch' && activePanel.type === 'twitch') ||
      (changedSection === 'youtube' && activePanel.type === 'youtube') ||
      (changedSection === 'branding' && activePanel.type === 'branding') ||
      (changedSection === 'general' && (activePanel.type === 'general' || activePanel.type === 'bot'))) {
    await updateDashboard(client, guildId, activePanel.type, activePanel.mode);
  } else {
    console.log(`[DEBUG] No se actualiza porque el panel activo (${activePanel.type}) no coincide con ${changedSection}`);
  }
}

module.exports = { updateDashboard, setActivePanel, getActivePanel, refreshPanelAfterChange };