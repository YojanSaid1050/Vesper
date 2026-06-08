const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const CacheManager = require('../../core/CacheManager');

const tiktokLiveCache = new CacheManager('./data/tiktok');
const tiktokVideosCache = new CacheManager('./data/tiktok');

function cleanTikTokGuild(guildId) {
  const live = tiktokLiveCache.load('liveStatus', {});
  delete live[guildId];
  tiktokLiveCache.save('liveStatus', live);

  const videos = tiktokVideosCache.load('videos', {});
  delete videos[guildId];
  tiktokVideosCache.save('videos', videos);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tiktok-clear')
    .setDescription('Elimina TODOS los usuarios de TikTok del monitoreo')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = await getGuildConfig(interaction.guildId);
    const currentUsers = config.tiktok?.users || [];
    const currentCount = currentUsers.length;

    if (currentCount === 0) {
      return interaction.reply({ content: '📋 No hay usuarios de TikTok configurados para eliminar.', flags: 64 });
    }

    const confirmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Confirmar eliminación')
      .setDescription(`Estás a punto de eliminar **${currentCount}** usuarios de la lista de monitoreo.\n\n${currentUsers.map(u => `• ${u}`).join('\n')}\n\nEsta acción no se puede deshacer.`)
      .setColor(0x000000);

    await interaction.reply({
      embeds: [confirmEmbed],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tiktok_clear_confirm').setLabel('Sí, eliminar todo').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('tiktok_clear_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
      )],
      flags: 64
    });

    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000, max: 1 });

    collector.on('collect', async i => {
      if (i.customId === 'tiktok_clear_confirm') {
        await updateGuildSection(interaction.guildId, 'tiktok', { ...config.tiktok, users: [] });
        cleanTikTokGuild(interaction.guildId);
        await i.update({ content: `✅ Se eliminaron **${currentCount}** usuarios del monitoreo de TikTok.`, embeds: [], components: [] });
      } else {
        await i.update({ content: '❌ Operación cancelada.', embeds: [], components: [] });
      }
    });
  }
};