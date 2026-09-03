const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildConfig } = require('../database/mongoManager');
const { MODULE_DEFAULTS, isModuleEnabledConfig } = require('../config/guildPolicy');
const { recentNotifications } = require('../core/NotificationService');

async function controlCenterPayload(guild) {
  const config = await getGuildConfig(guild.id);
  const modules = Object.keys(MODULE_DEFAULTS)
    .map(name => `${isModuleEnabledConfig(config, name) ? '🟢' : '⚫'} ${name}`)
    .join(' · ');
  const embed = new EmbedBuilder()
    .setTitle('Centro de control de Vesper')
    .setDescription('Administración exclusiva del servidor principal. Desde aquí puedes auditar el Main y consultar el estado central del bot.')
    .setColor(0x800080)
    .addFields(
      { name: 'Servidor principal', value: `${guild.name}\n${guild.id}` },
      { name: 'Módulos del Main', value: modules }
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
  const lines = Object.keys(MODULE_DEFAULTS).map(name => `${isModuleEnabledConfig(config, name) ? '🟢 Activado' : '⚫ Desactivado'} — ${name}`);
  return { embeds: [new EmbedBuilder().setTitle('Módulos del Main').setDescription(lines.join('\n')).setColor(0x5865F2)] };
}

async function historyPayload(guildId = null) {
  const rows = await recentNotifications(guildId ? { guildId } : {}, 10);
  const description = rows.length
    ? rows.map(row => `${row.status === 'sent' || row.status === 'ended' ? '✅' : row.status === 'failed' ? '❌' : '⏳'} **${row.platform}** · ${row.account}\n${row.eventType} · <t:${Math.floor(new Date(row.createdAt).getTime() / 1000)}:R>${row.error ? `\n${row.error}` : ''}`).join('\n\n')
    : 'Todavía no hay notificaciones registradas.';
  return { embeds: [new EmbedBuilder().setTitle('Historial reciente').setDescription(description.slice(0, 4000)).setColor(0x5865F2)] };
}

module.exports = { controlCenterPayload, modulesPayload, historyPayload };
