const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildConfig } = require('../database/mongoManager');
const { MODULE_DEFAULTS, MODULE_LABELS, isModuleEnabledConfig } = require('../config/guildPolicy');
const { friendlyError } = require('../utils/userMessage');

const PLATFORM_NAMES = { tiktok: 'TikTok', twitch: 'Twitch', youtube: 'YouTube', deals: 'Juegos gratis' };
const EVENT_NAMES = { live_started: 'Directo', video_published: 'Video nuevo', short_published: 'Short nuevo' };
const { recentNotifications } = require('../core/NotificationService');

async function controlCenterPayload(guild) {
  const config = await getGuildConfig(guild.id);
  const modules = Object.keys(MODULE_DEFAULTS)
    .map(name => `${isModuleEnabledConfig(config, name) ? '🟢' : '⚫'} ${MODULE_LABELS[name] || name}`)
    .join(' · ');
  const embed = new EmbedBuilder()
    .setTitle('Centro de control de Vesper')
    .setDescription('Solo para el servidor principal. Desde aquí revisas el servidor y el estado del bot.')
    .setColor(0x800080)
    .addFields(
      { name: 'Servidor principal', value: guild.name },
      { name: 'Funciones', value: modules }
    )
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('main_audit').setLabel('Auditoría').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('main_diagnostics').setLabel('Diagnóstico').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('main_modules').setLabel('Módulos').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('main_history').setLabel('Historial').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('main_refresh').setLabel('Actualizar').setStyle(ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row] };
}

async function modulesPayload(guildId) {
  const config = await getGuildConfig(guildId);
  const lines = Object.keys(MODULE_DEFAULTS).map(name => `${isModuleEnabledConfig(config, name) ? '🟢 Activado' : '⚫ Desactivado'} — ${MODULE_LABELS[name] || name}`);
  return { embeds: [new EmbedBuilder().setTitle('Funciones del servidor').setDescription(lines.join('\n')).setColor(0x5865F2)] };
}

// Un aviso del historial contado con palabras: plataforma, cuenta, qué fue y
// cuándo, y si falló, por qué.
function notificationLine(row, viewerGuildId = null) {
  const icon = row.status === 'sent' || row.status === 'ended' ? '✅' : row.status === 'failed' ? '❌' : '⏳';
  const when = `<t:${Math.floor(new Date(row.createdAt).getTime() / 1000)}:R>`;
  const failure = row.error ? `\n${friendlyError(row.error, 'No se pudo publicar.', viewerGuildId)}` : '';
  return `${icon} **${PLATFORM_NAMES[row.platform] || row.platform}** · ${row.account}\n${EVENT_NAMES[row.eventType] || 'Aviso'} · ${when}${failure}`;
}

async function historyPayload(guildId = null, viewerGuildId = null) {
  const rows = await recentNotifications(guildId ? { guildId } : {}, 10);
  const description = rows.length
    ? rows.map(row => notificationLine(row, viewerGuildId)).join('\n\n')
    : 'Todavía no hay notificaciones registradas.';
  return { embeds: [new EmbedBuilder().setTitle('Historial reciente').setDescription(description.slice(0, 4000)).setColor(0x5865F2)] };
}

module.exports = { controlCenterPayload, modulesPayload, historyPayload, notificationLine };
