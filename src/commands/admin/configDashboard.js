// src/commands/admin/configDashboard.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
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

      // Eliminar dashboard anterior si existe
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

      // Obtener el panel con formato type 17
      const panelData = await mainPanel(guildId);
      
      // Método FORZADO para enviar mensaje con type 17
      // Usamos la API REST directamente para evitar validaciones de discord.js
      const message = await sendRawComponentMessage(interaction.channel, panelData);

      // Guardar en base de datos
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
      
      // Mensaje de error más descriptivo
      let errorMessage = `❌ Error: ${error.message}`;
      if (error.message.includes('type must be one of')) {
        errorMessage += '\n\n⚠️ **Nota:** El formato de mensaje que estás usando (type 17) ya no es compatible con la versión actual de Discord.\n';
        errorMessage += 'Se recomienda actualizar los paneles al formato estándar usando EmbedBuilder.';
      }
      
      await interaction.editReply({ content: errorMessage });
    }
  }
};

/**
 * Función para enviar un mensaje con formato raw (type 17)
 * Usa la API REST directamente para evitar las validaciones de discord.js
 */
async function sendRawComponentMessage(channel, panelData) {
  const { token } = channel.client;
  
  // Construir el payload exactamente como lo espera la API de Discord
  const payload = {
    ...panelData,
    // Asegurar que el mensaje no sea efímero si no se especifica
    flags: panelData.flags || 0
  };
  
  // Si panelData ya tiene la estructura completa, la usamos directamente
  // La API de Discord AÚN acepta type 17 en algunos endpoints (por ahora)
  try {
    // Intentar método normal primero
    return await channel.send(panelData);
  } catch (error) {
    if (error.code === 50035) { // Invalid Form Body
      console.warn('⚠️ El formato type 17 falló en el método normal, intentando vía REST...');
      
      // Método alternativo: Enviar como mensaje normal pero con raw payload
      const response = await channel.client.rest.post(
        `/channels/${channel.id}/messages`,
        {
          body: payload,
          auth: false
        }
      );
      
      // Devolver un objeto similar a Message
      return {
        id: response.id,
        delete: async () => {
          await channel.client.rest.delete(`/channels/${channel.id}/messages/${response.id}`);
        }
      };
    }
    throw error;
  }
}