const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { setupChecks, moduleSummary, mentionList } = require('../../core/SetupService');

function formatChannel(id) { return id ? `<#${id}>` : '❌ No configurado'; }
function formatRole(id) { return id ? `<@&${id}>` : '❌ No configurado'; }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverconfig')
    .setDescription('Muestra toda la configuración del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = await getGuildConfig(interaction.guild.id); // Añadir await
    const status = setupChecks(config);

    const embed = new EmbedBuilder()
      .setTitle(`⚙️ Configuración de ${interaction.guild.name}`)
      .setDescription(`Configuración orientativa: **${status.percentage}%**`)
      .setColor('#ffffff')
      .addFields(
        { name: '👋 General', value: `📥 Welcome: ${formatChannel(config.general?.welcomeChannel)}\n📤 Goodbye: ${formatChannel(config.general?.goodbyeChannel)}\n📜 Logs: ${formatChannel(config.general?.logChannel)}\n🤖 Bot Logs: ${formatChannel(config.general?.botLogChannel)}\n🎭 Bot Role: ${formatRole(config.general?.botRole)}` },
        { name: '🎵 TikTok', value: `🎬 Videos: ${formatChannel(config.tiktok?.videoChannel)}\n🔴 Lives: ${formatChannel(config.tiktok?.liveChannel)}\n👤 Usuarios: ${config.tiktok?.users?.length || 0}` },
        { name: '📺 Twitch', value: `📡 Canal Live: ${formatChannel(config.twitch?.liveChannel)}\n👤 Usuarios: ${config.twitch?.users?.length || 0}` },
        { name: '▶️ YouTube', value: `🔴 Live: ${formatChannel(config.youtube?.liveChannel)}\n🎬 Videos: ${formatChannel(config.youtube?.videoChannel)}\n📱 Shorts: ${formatChannel(config.youtube?.shortChannel)}\n👤 Canales: ${config.youtube?.users?.length || 0}` },
        { name: '🎨 Branding', value: `🏷️ Nombre: ${config.branding?.name || '❌ Sin configurar'}\n🖼️ Avatar: ${config.branding?.avatar ? '✅ Configurado' : '❌ Sin configurar'}` },
        { name: '🧩 Módulos', value: moduleSummary(config), inline: true },
        { name: '🔐 Roles de capacidad', value: `Redes: ${mentionList(config.permissions?.socialManagerRoles)}\nModeración: ${mentionList(config.permissions?.moderatorRoles)}\nDJ: ${mentionList(config.permissions?.musicDjRoles)}`, inline: true },
        { name: '🛡️ Exclusiones de moderación', value: `Canales: ${mentionList(config.moderation?.exemptChannels, 'channel')}\nRoles: ${mentionList(config.moderation?.exemptRoles)}` }
      )
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};
