// src/database/mongoManager.js
const mongoose = require('mongoose');
const Guild = require('./models/Guild');
const { isApprovedGuild } = require('../config/guildPolicy');
const { CURRENT_SCHEMA_VERSION, createDefaultGuildConfig, defaultCommunityConfig, defaultProfileConfig, defaultEmbedsConfig } = require('../config/defaultGuild');

let isConnected = false;
let connectionPromise = null;

// Caché de configuración por servidor. Sin ella, cada mensaje, cada evento y
// cada interacción provocaban una consulta a MongoDB Atlas: en un servidor
// activo son miles de consultas por minuto. El TTL es corto para que los
// cambios hechos fuera del bot se reflejen pronto, y toda escritura que pase
// por este módulo invalida la entrada al instante.
const CONFIG_CACHE_TTL_MS = Math.max(0, Number(process.env.GUILD_CONFIG_CACHE_MS ?? 30_000));
const CONFIG_CACHE_MAX = 500;
const configCache = new Map();

function cacheGet(guildId) {
  if (CONFIG_CACHE_TTL_MS <= 0) return null;
  const entry = configCache.get(String(guildId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    configCache.delete(String(guildId));
    return null;
  }
  return entry.value;
}

function cacheSet(guildId, value) {
  if (CONFIG_CACHE_TTL_MS <= 0 || !value) return value;
  const key = String(guildId);
  configCache.delete(key);
  configCache.set(key, { value, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS });
  while (configCache.size > CONFIG_CACHE_MAX) {
    const oldest = configCache.keys().next().value;
    if (oldest === undefined) break;
    configCache.delete(oldest);
  }
  return value;
}

function invalidateGuildConfig(guildId) {
  if (guildId === undefined || guildId === null) configCache.clear();
  else configCache.delete(String(guildId));
}

async function connectMongo() {
  if (isConnected) return;
  
  if (connectionPromise) {
    return connectionPromise;
  }
  
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI no está configurada en .env');
    throw new Error('MONGODB_URI missing');
  }
  
  connectionPromise = (async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      isConnected = true;
      console.log('✅ Conectado a MongoDB Atlas');
    } catch (error) {
      console.error('❌ Error conectando a MongoDB:', error.message);
      throw error;
    } finally {
      connectionPromise = null;
    }
  })();
  
  return connectionPromise;
}

function getMongoStatus() {
  return {
    connected: isConnected && mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState
  };
}

async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  isConnected = false;
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('⚠️ MongoDB desconectado');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('✅ MongoDB reconectado');
});

async function getGuildConfig(guildId, { fresh = false } = {}) {
  if (!guildId) {
    throw new Error('guildId es requerido');
  }

  if (!fresh) {
    const cached = cacheGet(guildId);
    if (cached) return cached;
  }

  await connectMongo();

  try {
    let guild = await Guild.findOne({ guildId });

    if (!guild) {
      guild = await Guild.create(createDefaultGuildConfig(guildId));
    } else if (guild.$isDefault?.('schemaVersion') || Number(guild.schemaVersion || 0) < CURRENT_SCHEMA_VERSION) {
      guild.schemaVersion = CURRENT_SCHEMA_VERSION;
      if (!Array.isArray(guild.moderation?.exemptChannels)) guild.set('moderation.exemptChannels', []);
      if (!Array.isArray(guild.moderation?.exemptRoles)) guild.set('moderation.exemptRoles', []);
      if (!guild.community) guild.set('community', defaultCommunityConfig());
      if (!guild.embeds) guild.set('embeds', defaultEmbedsConfig());
      if (!Array.isArray(guild.community?.tickets?.staffRoles)) guild.set('community.tickets.staffRoles', []);
      if (!Array.isArray(guild.community?.selfRoles?.roles)) guild.set('community.selfRoles.roles', []);
      if (!Array.isArray(guild.community?.starboard?.ignoredChannels)) guild.set('community.starboard.ignoredChannels', []);
      // La migración solo rellena lo que falta. Antes reemplazaba el perfil
      // completo y cada subida de schemaVersion borraba el nombre, los colores
      // y los mensajes personalizados de los Main temáticos.
      const defaults = defaultProfileConfig(guildId);
      const currentProfile = guild.profile ? (guild.profile.toObject?.() || guild.profile) : {};
      for (const [key, value] of Object.entries(defaults)) {
        if (currentProfile[key] === undefined || currentProfile[key] === null) {
          guild.set(`profile.${key}`, value);
        }
      }
      await guild.save();
    }

    return cacheSet(guildId, guild.toObject());
  } catch (error) {
    console.error(`Error obteniendo configuración para guild ${guildId}:`, error.message);
    return createDefaultGuildConfig(guildId);
  }
}

async function updateGuildConfig(guildId, updates) {
  if (!guildId) {
    throw new Error('guildId es requerido');
  }
  
  await connectMongo();
  
  try {
    const allowedSections = ['general', 'dashboard', 'tiktok', 'twitch', 'youtube', 'branding', 'profile', 'embeds', 'features', 'permissions', 'moderation', 'music', 'deals', 'community', 'testPanel'];
    const sanitizedUpdates = {};
    for (const section of allowedSections) {
      if (updates?.[section] === undefined) continue;
      for (const [key, value] of Object.entries(updates[section] || {})) {
        sanitizedUpdates[`${section}.${key}`] = value;
      }
    }

    const result = await Guild.findOneAndUpdate(
      { guildId },
      { $set: sanitizedUpdates, $setOnInsert: { guildId } },
      { returnDocument: 'after', upsert: true }
    );
    invalidateGuildConfig(guildId);
    return result.toObject();
  } catch (error) {
    console.error(`Error actualizando configuración para guild ${guildId}:`, error.message);
    throw error;
  }
}

async function addGuildListItem(guildId, section, key, value) {
  if (!guildId || !section || !key || value === undefined || value === null) {
    throw new Error('guildId, section, key y value son requeridos');
  }
  const allowedLists = new Set([
    'tiktok.users', 'twitch.users', 'youtube.users',
    'permissions.socialManagerRoles', 'permissions.moderatorRoles', 'permissions.musicDjRoles',
    'moderation.allowedDomains', 'moderation.exemptChannels', 'moderation.exemptRoles'
  ]);
  const path = `${section}.${key}`;
  if (!allowedLists.has(path)) throw new Error(`Lista de configuración no permitida: ${path}`);
  await connectMongo();
  const result = await Guild.findOneAndUpdate(
    { guildId },
    { $addToSet: { [path]: value }, $setOnInsert: { guildId } },
    { returnDocument: 'after', upsert: true }
  );
  invalidateGuildConfig(guildId);
  return result.toObject();
}

async function removeGuildListItem(guildId, section, key, value) {
  if (!guildId || !section || !key || value === undefined || value === null) {
    throw new Error('guildId, section, key y value son requeridos');
  }
  const allowedLists = new Set([
    'tiktok.users', 'twitch.users', 'youtube.users',
    'permissions.socialManagerRoles', 'permissions.moderatorRoles', 'permissions.musicDjRoles',
    'moderation.allowedDomains', 'moderation.exemptChannels', 'moderation.exemptRoles'
  ]);
  const path = `${section}.${key}`;
  if (!allowedLists.has(path)) throw new Error(`Lista de configuración no permitida: ${path}`);
  await connectMongo();
  const result = await Guild.findOneAndUpdate(
    { guildId },
    { $pull: { [path]: value } },
    { returnDocument: 'after' }
  );
  invalidateGuildConfig(guildId);
  return result ? result.toObject() : null;
}

async function updateGuildSection(guildId, section, values) {
  if (!guildId || !section) {
    throw new Error('guildId y section son requeridos');
  }
  
  await connectMongo();
  
  try {
    // OJO: 'alerts' tiene que estar aquí. Sin ella, guardar el interruptor de
    // un registro desde el panel lanzaba «Sección de configuración no
    // permitida» y no se guardaba nada.
    const allowedSections = new Set(['general', 'dashboard', 'tiktok', 'twitch', 'youtube', 'branding', 'profile', 'embeds', 'alerts', 'features', 'permissions', 'moderation', 'music', 'deals', 'testPanel']);
    if (!allowedSections.has(section)) throw new Error(`Sección de configuración no permitida: ${section}`);

    const update = {};
    for (const [key, value] of Object.entries(values)) {
      update[`${section}.${key}`] = value;
    }
    
    const result = await Guild.findOneAndUpdate(
      { guildId },
      { $set: update },
      { returnDocument: 'after', upsert: true }
    );
    invalidateGuildConfig(guildId);
    return result.toObject();
  } catch (error) {
    console.error(`Error actualizando sección ${section} para guild ${guildId}:`, error.message);
    throw error;
  }
}

// El plan es un campo suelto, no una sección: `updateGuildSection` prefija con
// el nombre de la sección y aquí no hay ninguna.
async function setGuildPlan(guildId, plan) {
  if (!guildId) throw new Error('guildId es requerido');
  if (!['free', 'premium'].includes(plan)) throw new Error(`Plan no permitido: ${plan}`);
  await connectMongo();
  const result = await Guild.findOneAndUpdate(
    { guildId },
    { $set: { plan }, $setOnInsert: { guildId } },
    { returnDocument: 'after', upsert: true }
  );
  invalidateGuildConfig(guildId);
  return result.toObject();
}

async function updateCommunitySection(guildId, subsection, values) {
  const allowedFields = {
    tickets: new Set(['panelChannel', 'category', 'transcriptChannel', 'staffRoles', 'maxOpenPerUser', 'panelMessage']),
    suggestions: new Set(['channel']),
    selfRoles: new Set(['panelChannel', 'panelMessage', 'roles']),
    starboard: new Set(['channel', 'threshold', 'emoji', 'ignoredChannels'])
  };
  if (!guildId || !allowedFields[subsection]) {
    throw new Error('Subsección de comunidad no permitida');
  }
  await connectMongo();
  const update = {};
  for (const [key, value] of Object.entries(values || {})) {
    if (!allowedFields[subsection].has(key)) throw new Error(`Campo de comunidad no permitido: ${subsection}.${key}`);
    update[`community.${subsection}.${key}`] = value;
  }
  if (!Object.keys(update).length) throw new Error('No hay valores de comunidad para actualizar');
  const result = await Guild.findOneAndUpdate(
    { guildId },
    { $set: update, $setOnInsert: { guildId } },
    { returnDocument: 'after', upsert: true }
  );
  invalidateGuildConfig(guildId);
  return result.toObject();
}

async function getAllGuilds() {
  await connectMongo();
  return await Guild.find({});
}

async function getAllGuildConfigs({ approvedOnly = false } = {}) {
  await connectMongo();
  const guilds = await Guild.find({});
  const result = {};
  for (const guild of guilds) {
    if (approvedOnly && !isApprovedGuild(guild.guildId)) continue;
    result[guild.guildId] = guild.toObject();
  }
  return result;
}

async function getGeneralConfig(guildId) {
  const config = await getGuildConfig(guildId);
  return config.general;
}

async function deleteGuild(guildId) {
  await connectMongo();
  invalidateGuildConfig(guildId);
  return await Guild.deleteOne({ guildId });
}

async function cleanDuplicateUsers() {
  await connectMongo();
  
  const guilds = await Guild.find({});
  let cleaned = 0;
  
  for (const guild of guilds) {
    let modified = false;
    
    if (guild.tiktok?.users?.length > 0) {
      const unique = [...new Set(guild.tiktok.users)];
      if (unique.length !== guild.tiktok.users.length) {
        guild.tiktok.users = unique;
        modified = true;
      }
    }
    
    if (guild.twitch?.users?.length > 0) {
      const unique = [...new Set(guild.twitch.users)];
      if (unique.length !== guild.twitch.users.length) {
        guild.twitch.users = unique;
        modified = true;
      }
    }
    
    if (guild.youtube?.users?.length > 0) {
      const unique = [...new Set(guild.youtube.users)];
      if (unique.length !== guild.youtube.users.length) {
        guild.youtube.users = unique;
        modified = true;
      }
    }
    
    if (modified) {
      await guild.save();
      invalidateGuildConfig(guild.guildId);
      cleaned++;
    }
  }
  
  console.log(`🧹 Limpiados ${cleaned} guilds con usuarios duplicados`);
  return cleaned;
}

module.exports = {
  connectMongo,
  getGuildConfig,
  updateGuildConfig,
  updateGuildSection,
  setGuildPlan,
  updateCommunitySection,
  addGuildListItem,
  removeGuildListItem,
  getAllGuilds,
  getAllGuildConfigs,
  getGeneralConfig,
  deleteGuild,
  cleanDuplicateUsers,
  getMongoStatus,
  disconnectMongo,
  invalidateGuildConfig
};
