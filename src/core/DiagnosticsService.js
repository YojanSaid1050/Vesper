const mongoose = require('mongoose');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getMongoStatus, getGuildConfig } = require('../database/mongoManager');
const { getMonitorStats } = require('../platforms');
const { getCacheStats: getTikTokStats } = require('../platforms/tiktok/checks');
const { MODULE_DEFAULTS, isModuleEnabledConfig } = require('../config/guildPolicy');
const mainGuild = require('../config/mainGuild');
const { getAllProviderMetrics } = require('./ProviderMetrics');

function mark(value) {
  return value ? '✅' : '❌';
}

async function databaseLatency() {
  if (mongoose.connection.readyState !== 1) return null;
  const started = Date.now();
  await mongoose.connection.db.admin().ping();
  return Date.now() - started;
}

async function diagnosticSnapshot(client) {
  const mongo = getMongoStatus();
  const [latency, tiktok] = await Promise.all([
    databaseLatency().catch(() => null),
    getTikTokStats().catch(error => ({ provider: { lastError: { message: error.message } } }))
  ]);
  const monitors = getMonitorStats();
  const music = client.music?.status?.() || { configured: false, connected: false, players: 0 };
  const providerMetrics = getAllProviderMetrics();
  return {
    discord: { ready: client.isReady(), ping: client.ws.ping, guilds: client.guilds.cache.size },
    mongo: { ...mongo, latency },
    twitch: { configured: Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) },
    youtube: { configured: Boolean(process.env.YOUTUBE_API_KEY) },
    tiktok: tiktok.provider || {},
    music,
    providerMetrics,
    monitors
  };
}

async function buildDiagnosticsEmbed(client) {
  const data = await diagnosticSnapshot(client);
  const monitorLines = data.monitors.length
    ? data.monitors.map(item => `${item.disabledUntil ? '🔴' : item.isActive ? '🟢' : '🟡'} ${item.name}: ${item.lastRunTime ? `<t:${Math.floor(new Date(item.lastRunTime).getTime() / 1000)}:R>` : 'sin ejecución'}${item.disabledUntil ? ` · reintento <t:${Math.floor(new Date(item.disabledUntil).getTime() / 1000)}:R>` : ''}`).join('\n')
    : 'No hay monitores activos.';
  return new EmbedBuilder()
    .setTitle('Diagnóstico de Vesper')
    .setColor(data.discord.ready && data.mongo.connected ? 0x57F287 : 0xFEE75C)
    .addFields(
      { name: 'Discord', value: `${mark(data.discord.ready)} Conexión\nLatencia: ${data.discord.ping} ms\nServidores: ${data.discord.guilds}`, inline: true },
      { name: 'MongoDB', value: `${mark(data.mongo.connected)} Conexión\nLatencia: ${data.mongo.latency ?? 'N/D'} ms`, inline: true },
      { name: 'APIs y cuota desde el arranque', value: `${mark(data.twitch.configured)} Twitch · ${data.providerMetrics.twitch.calls} llamadas${data.providerMetrics.twitch.remaining !== null ? ` · ${data.providerMetrics.twitch.remaining}/${data.providerMetrics.twitch.limit} restantes` : ''}\n${mark(data.youtube.configured)} YouTube · ${data.providerMetrics.youtube.units}/10000 unidades estimadas\n${mark(data.tiktok.provider === 'self_hosted' || data.tiktok.mode === 'integrated')} TikTok · US$0.00`, inline: true },
      { name: 'TikTok gratuito', value: `Navegador: ${data.tiktok.browser?.ready ? 'listo' : data.tiktok.browser?.installed ? 'instalado/en espera' : 'no detectado'}\nÚltimo éxito: ${data.tiktok.lastSuccess || 'sin datos'}\nÚltimo error: ${data.tiktok.lastError?.message || 'ninguno'}`.slice(0, 1024) },
      { name: 'Música', value: `${mark(data.music.configured)} Configuración\n${mark(data.music.connected)} Lavalink\nReproductores: ${data.music.players || 0}`, inline: true },
      { name: 'Monitores', value: monitorLines.slice(0, 1024) }
    )
    .setFooter({ text: 'No se muestran credenciales ni secretos' })
    .setTimestamp();
}

async function auditGuild(guild) {
  const config = await getGuildConfig(guild.id);
  const issues = [];
  const checks = [];
  const botMember = guild.members.me;

  for (const [label, channelId] of Object.entries({
    bienvenida: config.general?.welcomeChannel,
    despedida: config.general?.goodbyeChannel,
    logs: config.general?.logChannel,
    'TikTok live': config.tiktok?.liveChannel,
    'TikTok videos': config.tiktok?.videoChannel,
    Twitch: config.twitch?.liveChannel,
    'YouTube live': config.youtube?.liveChannel,
    'YouTube videos': config.youtube?.videoChannel,
    'YouTube shorts': config.youtube?.shortChannel
  })) {
    if (!channelId) continue;
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      issues.push(`${label}: canal inexistente (${channelId})`);
      continue;
    }
    const permissions = channel.permissionsFor(botMember);
    const ok = permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]);
    checks.push(`${ok ? '✅' : '❌'} ${label}`);
    if (!ok) issues.push(`${label}: faltan permisos para ver, enviar o insertar enlaces`);
  }

  const exclusiveRoleIds = [
    ...Object.values(mainGuild.colorRoles),
    ...Object.values(mainGuild.countryRoles),
    ...Object.values(mainGuild.gameRoles),
    ...Object.values(mainGuild.platformRoles),
    mainGuild.verificationRole
  ];
  const missingRoles = exclusiveRoleIds.filter(roleId => !guild.roles.cache.has(roleId));
  if (missingRoles.length) issues.push(`${missingRoles.length} roles exclusivos ya no existen`);

  if (!process.env.MONGODB_URI) issues.push('MONGODB_URI no configurada');
  if (!process.env.MAIN_GUILD_ID && !process.env.GUILD_ID) issues.push('MAIN_GUILD_ID no configurado');
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) issues.push('Twitch no configurado');
  if (!process.env.YOUTUBE_API_KEY) issues.push('YouTube no configurado');

  return { config, checks, issues, missingRoles };
}

async function buildAuditEmbed(guild) {
  const audit = await auditGuild(guild);
  return new EmbedBuilder()
    .setTitle('Auditoría de configuración')
    .setColor(audit.issues.length ? 0xFEE75C : 0x57F287)
    .setDescription(audit.issues.length ? `Se encontraron **${audit.issues.length}** puntos por revisar.` : 'La configuración principal no presenta incidencias evidentes.')
    .addFields(
      { name: 'Canales comprobados', value: audit.checks.join('\n').slice(0, 1024) || 'No hay canales configurados.' },
      { name: 'Pendientes', value: audit.issues.map(item => `• ${item}`).join('\n').slice(0, 1024) || 'Ninguno.' },
      { name: 'Módulos', value: Object.keys(MODULE_DEFAULTS).map(name => `${isModuleEnabledConfig(audit.config, name) ? '🟢' : '⚫'} ${name}`).join('\n'), inline: true }
    )
    .setFooter({ text: 'La auditoría nunca cambia la configuración automáticamente' })
    .setTimestamp();
}

module.exports = { diagnosticSnapshot, buildDiagnosticsEmbed, auditGuild, buildAuditEmbed };
