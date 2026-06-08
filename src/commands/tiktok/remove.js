const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const CacheManager = require('../../core/CacheManager');

const tiktokLiveCache = new CacheManager('./data/tiktok');
const tiktokVideosCache = new CacheManager('./data/tiktok');

function cleanTikTokLive(guildId, username) {
  const data = tiktokLiveCache.load('liveStatus', {});
  if (data[guildId] && data[guildId][username] !== undefined) {
    delete data[guildId][username];
    if (Object.keys(data[guildId]).length === 0) {
      delete data[guildId];
    }
    tiktokLiveCache.save('liveStatus', data);
  }
}

function cleanTikTokVideos(guildId, username) {
  const data = tiktokVideosCache.load('videos', {});
  if (data[guildId] && data[guildId][username] !== undefined) {
    delete data[guildId][username];
    if (Object.keys(data[guildId]).length === 0) {
      delete data[guildId];
    }
    tiktokVideosCache.save('videos', data);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tiktok-remove')
    .setDescription('Elimina un usuario de TikTok del monitoreo')
    .addStringOption(option => option.setName('usuario').setDescription('Usuario de TikTok').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('usuario').replace('@', '').toLowerCase();
    const config = await getGuildConfig(interaction.guildId);
    const currentUsers = config.tiktok?.users || [];

    // Buscar el usuario exacto (case-insensitive)
    const existingUser = currentUsers.find(u => u.toLowerCase() === input);
    
    if (!existingUser) {
      return interaction.editReply({ content: `❌ El usuario \`${input}\` no está en la lista de monitoreo.\n\nUsa \`/tiktok-list\` para ver los usuarios actuales.` });
    }

    const newUsers = currentUsers.filter(u => u.toLowerCase() !== input);
    await updateGuildSection(interaction.guildId, 'tiktok', { ...config.tiktok, users: newUsers });

    // Limpiar caché
    cleanTikTokLive(interaction.guildId, existingUser);
    cleanTikTokVideos(interaction.guildId, existingUser);

    await interaction.editReply({ content: `✅ Se eliminó **${existingUser}** de la lista de monitoreo.\n\n📋 Usuarios restantes: ${newUsers.length}` });
  }
};