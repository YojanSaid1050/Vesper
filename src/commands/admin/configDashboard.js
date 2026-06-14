// src/commands/admin/configDashboard.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSection, getGuildConfig } = require('../../database/mongoManager');
const { mainPanel } = require('../../dashboard/panels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-dashboard')
    .setDescription('Crea o reinicia el dashboard de configuración.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    try {
      const guildId = interaction.guild.id;
      const config = await getGuildConfig(guildId);

      if (config.dashboard?.channel && config.dashboard?.message) {
        try {
          const oldChannel = await interaction.guild.channels.fetch(config.dashboard.channel);
          if (oldChannel) {
            const oldMessage = await oldChannel.messages.fetch(config.dashboard.message);
            if (oldMessage) await oldMessage.delete();
          }
        } catch (err) {
          console.log('Error eliminando dashboard anterior:', err.message);
        }
      }

      const panel = await mainPanel(guildId);
      const message = await interaction.channel.send(panel);

      await updateGuildSection(guildId, 'dashboard', {
        channel: interaction.channel.id,
        message: message.id,
        enabled: true,
        currentPanel: 'main',
        currentMode: 'default'
      });

      await interaction.editReply({ content: '✅ Dashboard creado correctamente.' });
      
    } catch (error) {
      console.error('Error en config-dashboard:', error);
      await interaction.editReply({ content: `❌ Error: ${error.message}` });
    }
  }
};