const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateGuildSection } = require('../../database/mongoManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');

// Importar checkUser con try-catch para manejar errores
let checkUser;
try {
    const tiktokChecks = require('../../platforms/tiktok/checks');
    checkUser = tiktokChecks.checkUser;
} catch (error) {
    console.error('Error loading TikTok checks:', error.message);
    checkUser = async () => ({ exists: false, error: error.message });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tiktok-add')
        .setDescription('Añade un usuario de TikTok para monitorear')
        .addStringOption(option => option.setName('usuario').setDescription('Usuario de TikTok').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        const input = interaction.options.getString('usuario').replace('@', '').toLowerCase();
        
        try {
            // Llamar a checkUser con timeout manual
            const userPromise = checkUser(input);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 300000)
            );
            
            const user = await Promise.race([userPromise, timeoutPromise]);

            if (!user || !user.exists) {
                return interaction.editReply({ content: `❌ No se encontró el usuario \`${input}\` en TikTok.` });
            }

            const config = await getGuildConfig(interaction.guildId);
            const currentUsers = config.tiktok?.users || [];

            if (currentUsers.includes(user.username)) {
                return interaction.editReply({ content: `⚠️ El usuario **${user.username}** ya está siendo monitoreado.` });
            }

            const newUsers = [...currentUsers, user.username];
            await updateGuildSection(interaction.guildId, 'tiktok', { ...config.tiktok, users: newUsers });

            await interaction.editReply({ content: `✅ Se añadió **${user.username}** a la lista de monitoreo.\n\n📋 Total de usuarios: ${newUsers.length}` });
            
            // Refrescar dashboard automáticamente
            const activePanel = await getActivePanel(interaction.guildId);
            await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
            
        } catch (error) {
            console.error('Error en tiktok-add:', error);
            await interaction.editReply({ content: `❌ Error al verificar el usuario: ${error.message}. Intenta nuevamente.` });
        }
    }
};