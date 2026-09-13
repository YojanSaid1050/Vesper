const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, addGuildListItem } = require('../../database/mongoManager');
const { updateDashboard, getActivePanel } = require('../../dashboard/updater');

const { normalizeUsername } = require('../../platforms/tiktok/utils');

// La verificación de existencia usa el perfil público y no inicia Chromium.
let verifyUserExists;
try {
    const tiktokChecks = require('../../platforms/tiktok/checks');
    verifyUserExists = tiktokChecks.verifyUserExists;
} catch (error) {
    console.error('Error loading TikTok checks:', error.message);
    verifyUserExists = async () => null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tiktok-add')
        .setDescription('Añade un usuario de TikTok para monitorear')
        .addStringOption(option => option.setName('usuario').setDescription('Usuario de TikTok').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        const input = normalizeUsername(interaction.options.getString('usuario'));
        
        try {
            // Llamar a checkUser con timeout manual
            const userPromise = verifyUserExists(input);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('TikTok tardó demasiado en responder')), 45000)
            );
            
            const exists = await Promise.race([userPromise, timeoutPromise]);

            if (exists !== true) {
                return interaction.editReply({ content: `❌ No se encontró el usuario \`${input}\` en TikTok.` });
            }

            const config = await getGuildConfig(interaction.guildId);
            const currentUsers = config.tiktok?.users || [];

            if (currentUsers.includes(input)) {
                return interaction.editReply({ content: `⚠️ El usuario **${input}** ya está siendo monitoreado.` });
            }

            const updated = await addGuildListItem(interaction.guildId, 'tiktok', 'users', input);
            const newUsers = updated.tiktok?.users || [];

            await interaction.editReply({ content: `✅ Se añadió **${input}** a la lista de monitoreo.\n\n📋 Total de usuarios: ${newUsers.length}` });
            
            // Refrescar dashboard automáticamente
            const activePanel = await getActivePanel(interaction.guildId);
            await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);
            
        } catch (error) {
            console.error('Error en tiktok-add:', error);
            await interaction.editReply({ content: `❌ Error al verificar el usuario: ${error.message}. Intenta nuevamente.` });
        }
    }
};
