// src/database/mongoManager.js
const mongoose = require('mongoose');
const Guild = require('./models/Guild');
const { isApprovedGuild } = require('../config/guildPolicy');
const { CURRENT_SCHEMA_VERSION, createDefaultGuildConfig, defaultCommunityConfig, defaultProfileConfig } = require('../config/defaultGuild');

let isConnected = false;
let connectionPromise = null;

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

async function getGuildConfig(guildId) {
  if (!guildId) {
    throw new Error('guildId es requerido');
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
      if (!Array.isArray(guild.community?.tickets?.staffRoles)) guild.set('community.tickets.staffRoles', []);
      if (!Array.isArray(guild.community?.selfRoles?.roles)) guild.set('community.selfRoles.roles', []);
      if (!Array.isArray(guild.community?.starboard?.ignoredChannels)) guild.set('community.starboard.ignoredChannels', []);
      guild.set('profile', defaultProfileConfig(guildId));
      await guild.save();
    }
    
    return guild.toObject();
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
    const allowedSections = ['general', 'dashboard', 'tiktok', 'twitch', 'youtube', 'branding', 'profile', 'features', 'permissions', 'moderation', 'music', 'community', 'testPanel'];
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
  return result ? result.toObject() : null;
}

async function updateGuildSection(guildId, section, values) {
  if (!guildId || !section) {
    throw new Error('guildId y section son requeridos');
  }
  
  await connectMongo();
  
  try {
    const allowedSections = new Set(['general', 'dashboard', 'tiktok', 'twitch', 'youtube', 'branding', 'profile', 'features', 'permissions', 'moderation', 'music', 'testPanel']);
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
    return result.toObject();
  } catch (error) {
    console.error(`Error actualizando sección ${section} para guild ${guildId}:`, error.message);
    throw error;
  }
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
  updateCommunitySection,
  addGuildListItem,
  removeGuildListItem,
  getAllGuilds,
  getAllGuildConfigs,
  getGeneralConfig,
  deleteGuild,
  cleanDuplicateUsers,
  getMongoStatus,
  disconnectMongo
};
