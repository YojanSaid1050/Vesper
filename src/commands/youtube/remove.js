const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const { verifyChannel } = require('../../platforms/youtube/utils');
const CacheManager = require('../../core/CacheManager');

const youtubeCache = new CacheManager('./data/youtube');

function cleanYouTubeGuild(guildId) {
  const liveStatus = youtubeCache.load('liveStatus', {});
  delete liveStatus[guildId];
  youtubeCache.save('liveStatus', liveStatus);

  const videos = youtubeCache.load('videos', {});
  delete videos[guildId];
  youtubeCache.save('videos', videos);

  const shorts = youtubeCache.load('shorts', {});
  delete shorts[guildId];
  youtubeCache.save('shorts', shorts);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtube-remove')
    .setDescription('Elimina un canal de YouTube del monitoreo')
    .addStringOption(option => option.setName('canal').setDescription('URL, @handle o nombre del canal a eliminar').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const input = interaction.options.getString('canal').toLowerCase();
    const config = await getGuildConfig(interaction.guildId);
    const currentUsers = config.youtube?.users || [];

    let foundChannelId = null;
    let foundChannelName = null;

    for (const channelId of currentUsers) {
      const info = await verifyChannel(channelId);
      if (info.exists && (info.handle === input || info.name.toLowerCase() === input || info.id === input)) {
        foundChannelId = channelId;
        foundChannelName = info.name;
        break;
      }
    }

    if (!foundChannelId) {
      return interaction.editReply({ content: `❌ No se encontró el canal \`${input}\` en la lista de monitoreo.\n\nUsa \`/youtube-list\` para ver los canales actuales.` });
    }

    const newUsers = currentUsers.filter(u => u !== foundChannelId);
    await updateGuildSection(interaction.guildId, 'youtube', { ...config.youtube, users: newUsers });

    // Limpiar caché
    cleanYouTubeGuild(interaction.guildId);

    await interaction.editReply({ content: `✅ Se eliminó **${foundChannelName || foundChannelId}** de la lista de monitoreo.\n\n📋 Canales restantes: ${newUsers.length}` });
  }
};