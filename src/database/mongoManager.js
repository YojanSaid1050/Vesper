const mongoose = require('mongoose');
const Guild = require('./models/Guild');

let isConnected = false;

async function connectMongo() {
  if (isConnected) return;
  
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI no está configurada en .env');
    throw new Error('MONGODB_URI missing');
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
    console.log('✅ Conectado a MongoDB Atlas');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    throw error;
  }
}

async function getGuildConfig(guildId) {
  await connectMongo();
  
  let guild = await Guild.findOne({ guildId });
  
  if (!guild) {
    guild = await Guild.create({ guildId });
  }
  
  return guild.toObject();
}

async function updateGuildConfig(guildId, updates) {
  await connectMongo();
  
  return await Guild.findOneAndUpdate(
    { guildId },
    { $set: updates },
    { returnDocument: 'after', upsert: true }
  );
}

async function updateGuildSection(guildId, section, values) {
  await connectMongo();
  
  const update = {};
  for (const [key, value] of Object.entries(values)) {
    update[`${section}.${key}`] = value;
  }
  
  return await Guild.findOneAndUpdate(
    { guildId },
    { $set: update },
    { returnDocument: 'after', upsert: true }
  );
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

module.exports = {
  connectMongo,
  getGuildConfig,
  updateGuildConfig,
  updateGuildSection,
  getAllGuilds,
  getAllGuildConfigs,
  getGeneralConfig,
  deleteGuild
};