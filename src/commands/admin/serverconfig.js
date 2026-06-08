const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../../database/guildManager');

function formatChannel(id) { return id ? `<#${id}>` : '❌ No configurado'; }
function formatRole(id) { return id ? `<@&${id}>` : '❌ No configurado'; }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverconfig')
    .setDescription('Muestra toda la configuración del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = getGuildConfig(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle(`⚙️ Configuración de ${interaction.guild.name}`)
      .setColor('#ffffff')
      .addFields(
        { name: '👋 General', value: `📥 Welcome: ${formatChannel(config.general?.welcomeChannel)}\n📤 Goodbye: ${formatChannel(config.general?.goodbyeChannel)}\n📜 Logs: ${formatChannel(config.general?.logChannel)}\n🤖 Bot Logs: ${formatChannel(config.general?.botLogChannel)}\n🎭 Bot Role: ${formatRole(config.general?.botRole)}` },
        { name: '🎵 TikTok', value: `🎬 Videos: ${formatChannel(config.tiktok?.videoChannel)}\n🔴 Lives: ${formatChannel(config.tiktok?.liveChannel)}\n👤 Usuarios: ${config.tiktok?.users?.length || 0}` },
        { name: '📺 Twitch', value: `📡 Canal Live: ${formatChannel(config.twitch?.liveChannel)}\n👤 Usuarios: ${config.twitch?.users?.length || 0}` },
        { name: '🎨 Branding', value: `🏷️ Nombre: ${config.branding?.name || '❌ Sin configurar'}\n🖼️ Avatar: ${config.branding?.avatar ? '✅ Configurado' : '❌ Sin configurar'}` }
      )
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};