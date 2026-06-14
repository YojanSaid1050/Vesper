// src/commands/admin/configDashboard.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSection, getGuildConfig } = require('../../database/mongoManager');
const { mainPanel } = require('../../dashboard/panels');
const { getOrCreateWebhook, clearWebhookCache } = require('../../dashboard/updater');

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

      // Eliminar dashboard anterior
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

      // Limpiar caché de webhook para este canal
      clearWebhookCache(guildId);

      // Obtener el panel (con formato type 17)
      const panelData = await mainPanel(guildId);
      
      // Obtener o crear webhook
      const webhook = await getOrCreateWebhook(interaction.channel);
      
      if (!webhook) {
        throw new Error('No se pudo crear/obtener el webhook');
      }

      // Obtener branding
      const branding = config.branding || {};
      
      // Enviar el mensaje usando el webhook (esto permite type 17)
      const webhookOptions = {
        ...panelData,
        username: branding.name || interaction.client.user.username,
        avatarURL: branding.avatar || interaction.client.user.displayAvatarURL()
      };
      
      const message = await webhook.send(webhookOptions);

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