const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { clampEmbed } = require('../../utils/discordLimits');
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
        { name: '👋 General', value: `📥 Bienvenida: ${formatChannel(config.general?.welcomeChannel)}\n📤 Despedida: ${formatChannel(config.general?.goodbyeChannel)}\n📜 Registros: ${formatChannel(config.general?.logChannel)}\n🤖 Registros de bots: ${formatChannel(config.general?.botLogChannel)}\n🎭 Rol para bots: ${formatRole(config.general?.botRole)}` },
        { name: '🎵 TikTok', value: `🎬 Videos: ${formatChannel(config.tiktok?.videoChannel)}\n🔴 Directos: ${formatChannel(config.tiktok?.liveChannel)}\n👤 Cuentas: ${config.tiktok?.users?.length || 0}` },
        { name: '📺 Twitch', value: `📡 Directos: ${formatChannel(config.twitch?.liveChannel)}\n👤 Canales: ${config.twitch?.users?.length || 0}` },
        { name: '▶️ YouTube', value: `🔴 Directos: ${formatChannel(config.youtube?.liveChannel)}\n🎬 Videos: ${formatChannel(config.youtube?.videoChannel)}\n📱 Shorts: ${formatChannel(config.youtube?.shortChannel)}\n👤 Canales: ${config.youtube?.users?.length || 0}` },
        { name: '🎨 Nombre y logo', value: `🏷️ Nombre: ${config.branding?.name || 'el de la cuenta del bot'}\n🖼️ Logo: ${config.branding?.avatar ? '✅ Imagen propia' : 'el de la cuenta del bot'}` },
        { name: '🧩 Funciones', value: moduleSummary(config), inline: true },
        { name: '🔐 Roles con permisos', value: `Redes: ${mentionList(config.permissions?.socialManagerRoles)}\nModeración: ${mentionList(config.permissions?.moderatorRoles)}\nDJ: ${mentionList(config.permissions?.musicDjRoles)}`, inline: true },
        { name: '🛡️ Exclusiones de moderación', value: `Canales: ${mentionList(config.moderation?.exemptChannels, 'channel')}\nRoles: ${mentionList(config.moderation?.exemptRoles)}` }
      )
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setTimestamp();

    await interaction.reply({ embeds: [clampEmbed(embed)], flags: 64 });
  }
};
