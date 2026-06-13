const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { deleteGuild, getAllGuilds } = require('../../database/mongoManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetalldb')
        .setDescription('⚠️ ELIMINA TODA la base de datos (acción irreversible)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const guilds = await getAllGuilds();
        const count = guilds.length;

        const embed = new EmbedBuilder()
            .setTitle('⚠️⚠️⚠️ ELIMINAR TODA LA BASE DE DATOS ⚠️⚠️⚠️')
            .setDescription(`Estás a punto de eliminar **TODOS** los datos de la base de datos.\n\n📊 Servidores afectados: **${count}**\n\n**Esta acción es IRREVERSIBLE.**`)
            .setColor(0xFF0000)
            .setFooter({ text: 'Escribe "CONFIRMAR" en el mensaje para proceder' });

        await interaction.reply({ embeds: [embed], flags: 64 });

        // Esperar confirmación por texto
        const filter = m => m.author.id === interaction.user.id && m.content === 'CONFIRMAR';
        const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

        collector.on('collect', async () => {
            await interaction.followUp({ content: '⏳ Eliminando todos los servidores...', flags: 64 });
            
            let deleted = 0;
            for (const guild of guilds) {
                await deleteGuild(guild.guildId);
                deleted++;
            }
            
            const resultEmbed = new EmbedBuilder()
                .setTitle('✅ Base de datos limpiada')
                .setDescription(`Se eliminaron **${deleted}** servidores de la base de datos.\n\nLa base de datos está completamente vacía.`)
                .setColor(0x00FF00)
                .setTimestamp();
            
            await interaction.followUp({ embeds: [resultEmbed], flags: 64 });
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.followUp({ content: '❌ Operación cancelada (tiempo de espera agotado).', flags: 64 });
            }
        });
    }
};