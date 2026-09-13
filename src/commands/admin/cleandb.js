const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { deleteGuild, getAllGuilds } = require('../../database/mongoManager');
const { requireBotOwner } = require('../../utils/interactionGuards');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetalldb')
        .setDescription('⚠️ ELIMINA TODA la base de datos (acción irreversible)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!await requireBotOwner(interaction)) return;

        const guilds = await getAllGuilds();
        const count = guilds.length;

        const embed = new EmbedBuilder()
            .setTitle('⚠️⚠️⚠️ ELIMINAR TODA LA BASE DE DATOS ⚠️⚠️⚠️')
            .setDescription(`Estás a punto de eliminar **TODOS** los datos de la base de datos.\n\n📊 Servidores afectados: **${count}**\n\n**Esta acción es IRREVERSIBLE.**`)
            .setColor(0xFF0000)
            .setFooter({ text: 'Operación exclusiva del propietario global de Vesper' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('resetalldb_confirm').setLabel('Eliminar toda la base').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('resetalldb_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row], flags: 64 });

        const response = await interaction.fetchReply();
        const filter = i => i.user.id === interaction.user.id
            && ['resetalldb_confirm', 'resetalldb_cancel'].includes(i.customId);
        const collector = response.createMessageComponentCollector({ filter, time: 30000, max: 1 });

        collector.on('collect', async i => {
            if (!await requireBotOwner(i)) return;
            if (i.customId === 'resetalldb_cancel') {
                await i.update({ content: '❌ Operación cancelada.', embeds: [], components: [] });
                return;
            }

            await i.deferUpdate();
            await interaction.editReply({ content: '⏳ Eliminando todos los servidores...', embeds: [], components: [] });
            
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
            
            await interaction.editReply({ content: null, embeds: [resultEmbed], components: [] });
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ content: '❌ Operación cancelada (tiempo de espera agotado).', embeds: [], components: [] }).catch(() => null);
            }
        });
    }
};
