const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Borra mensajes del canal')
    .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad de mensajes a borrar').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const cantidad = interaction.options.getInteger('cantidad');
    let mensajes;
    try {
      mensajes = await interaction.channel.bulkDelete(cantidad, true);
    } catch (error) {
      const motivo = /Missing Permissions|50013/.test(String(error?.message))
        ? 'Me falta el permiso «Gestionar mensajes» en este canal.'
        : `Discord no permitió borrar los mensajes: ${String(error?.message || error).slice(0, 150)}`;
      return interaction.editReply({ content: `❌ ${motivo}` });
    }

    // Discord no deja borrar en bloque mensajes de más de 14 días: se dice
    // en vez de dejar a la persona preguntándose por qué faltan.
    const viejos = mensajes.size < cantidad
      ? `\n\nLos ${cantidad - mensajes.size} restantes tienen más de 14 días o no existen; Discord no permite borrarlos en bloque.`
      : '';
    const embed = new EmbedBuilder()
      .setTitle('🧹 Mensajes eliminados')
      .setDescription(`Se ${mensajes.size === 1 ? 'eliminó **1** mensaje' : `eliminaron **${mensajes.size}** mensajes`}.${viejos}\n\n👮 Moderador: ${interaction.user}`)
      .setColor('#ffffff')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // Eliminar el mensaje de confirmación después de 5 segundos
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
  }
};