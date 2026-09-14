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
            
            // Si la base de datos falla a mitad, antes la promesa quedaba
            // rechazada sin capturar y el mensaje se quedaba para siempre en
            // «⏳ Eliminando…», sin decir cuántos se habían borrado.
            let deleted = 0;
            let failure = null;
            for (const guild of guilds) {
                try {
                    await deleteGuild(guild.guildId);
                    deleted++;
                } catch (error) {
                    failure = error;
                    break;
                }
            }

            const resultEmbed = new EmbedBuilder()
                .setTitle(failure ? '⚠️ Limpieza incompleta' : '✅ Base de datos limpiada')
                .setDescription(failure
                    ? `Se eliminaron **${deleted}** de **${guilds.length}** servidores antes de fallar.\n\nMotivo: ${String(failure.message).slice(0, 500)}`
                    : `Se eliminaron **${deleted}** servidores de la base de datos.\n\nLa base de datos está completamente vacía.`)
                .setColor(failure ? 0xFAA61A : 0x00FF00)
                .setTimestamp();

            await interaction.editReply({ content: null, embeds: [resultEmbed], components: [] }).catch(() => null);
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ content: '❌ Operación cancelada (tiempo de espera agotado).', embeds: [], components: [] }).catch(() => null);
            }
        });
    }
};
