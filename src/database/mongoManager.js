const mongoose = require('mongoose');
const Guild = require('./models/Guild');

let isConnected = false;
let connectionPromise = null;

async function connectMongo() {
  if (isConnected) return;
  
  // Si ya hay una conexión en curso, esperar a que termine
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

// Manejar desconexión
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
      guild = await Guild.create({ guildId });
    }
    
    return guild.toObject();
  } catch (error) {
    console.error(`Error obteniendo configuración para guild ${guildId}:`, error.message);
    // Devolver configuración por defecto
    return {
      guildId,
      general: { welcomeChannel: null, goodbyeChannel: null, logChannel: null, botLogChannel: null, botRole: null },
      dashboard: { channel: null, message: null, enabled: false, currentPanel: 'main', currentMode: 'default' },
      tiktok: { liveChannel: null, videoChannel: null, users: [], showUsers: false },
      twitch: { liveChannel: null, users: [], showUsers: false },
      youtube: { liveChannel: null, videoChannel: null, shortChannel: null, users: [], showUsers: false },
      branding: { name: null, avatar: null },
      testPanel: { activeSection: 'general' }
    };
  }
}

async function updateGuildConfig(guildId, updates) {
  if (!guildId) {
    throw new Error('guildId es requerido');
  }
  
  await connectMongo();
  
  try {
    const result = await Guild.findOneAndUpdate(
      { guildId },
      { $set: updates },
      { returnDocument: 'after', upsert: true }
    );
    return result.toObject();
  } catch (error) {
    console.error(`Error actualizando configuración para guild ${guildId}:`, error.message);
    throw error;
  }
}

async function updateGuildSection(guildId, section, values) {
  if (!guildId || !section) {
    throw new Error('guildId y section son requeridos');
  }
  
  await connectMongo();
  
  try {
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

async function getAllGuilds() {
  await connectMongo();
  return await Guild.find({});
}

async function getAllGuildConfigs() {
  await connectMongo();
  const guilds = await Guild.find({});
  const result = {};
  for (const guild of guilds) {
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

// Función para limpiar usuarios duplicados en arrays
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
  getAllGuilds,
  getAllGuildConfigs,
  getGeneralConfig,
  deleteGuild,
  cleanDuplicateUsers
};