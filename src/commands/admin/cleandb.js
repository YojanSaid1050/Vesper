const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { cleanDuplicateUsers, getAllGuildConfigs } = require('../../database/mongoManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleandb')
        .setDescription('Limpia usuarios duplicados en la base de datos')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        
        const cleaned = await cleanDuplicateUsers();
        
        const embed = new EmbedBuilder()
            .setTitle('🧹 Limpieza de MongoDB')
            .setDescription(`Se limpiaron **${cleaned}** servidores con usuarios duplicados.`)
            .setColor(0x00FF00)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
};