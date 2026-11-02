const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { deleteGuild, getAllGuilds } = require('../../database/mongoManager');
const { requireBotOwner } = require('../../utils/interactionGuards');
const { friendlyError } = require('../../utils/userMessage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetalldb')
        .setDescription('⚠️ Borra TODOS los datos guardados de todos los servidores (no se puede deshacer)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!await requireBotOwner(interaction)) return;

        const guilds = await getAllGuilds();
        const count = guilds.length;

        const embed = new EmbedBuilder()
            .setTitle('⚠️⚠️⚠️ BORRAR TODOS LOS DATOS ⚠️⚠️⚠️')
            .setDescription(`Estás a punto de borrar **TODOS** los datos guardados del bot.\n\n📊 Servidores afectados: **${count}**\n\n**Esta acción es IRREVERSIBLE.**`)
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
                .setTitle(failure ? '⚠️ No se borró todo' : '✅ Datos borrados')
                .setDescription(failure
                    ? `Se eliminaron **${deleted}** de **${guilds.length}** servidores antes de fallar.\n\nMotivo: ${friendlyError(failure, interaction)}`
                    : `Se eliminaron **${deleted}** servidores.\n\nYa no queda ningún dato guardado.`)
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
