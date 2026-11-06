const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { requireBotOwner } = require('../../utils/interactionGuards');
const { inventory, erase, describe } = require('../../core/PersonalDataService');
const { friendlyError } = require('../../utils/userMessage');

// Atiende las solicitudes de «consultar o eliminar mis datos» que llegan por
// correo. Solo el propietario del bot, solo en el servidor principal, y
// siempre en privado. Borrar pide confirmar con un botón.
module.exports = {
  scope: 'primary_main',
  data: new SlashCommandBuilder()
    .setName('vesper-datos')
    .setDescription('Consulta o borra los datos que el bot guarda de una persona')
    .addSubcommand(command => command
      .setName('ver')
      .setDescription('Muestra qué datos hay guardados de esa persona')
      .addStringOption(option => option.setName('cuenta').setDescription('Mención o número de cuenta de Discord').setRequired(true)))
    .addSubcommand(command => command
      .setName('borrar')
      .setDescription('Borra los datos de esa persona (pide confirmación)')
      .addStringOption(option => option.setName('cuenta').setDescription('Mención o número de cuenta de Discord').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!await requireBotOwner(interaction)) return;
    const subcommand = interaction.options.getSubcommand();
    const account = interaction.options.getString('cuenta');
    try {
      const found = await inventory(account);
      const erasable = describe(found.erasable);
      const kept = describe(found.kept, { reasons: true });
      const summary = [
        `**Datos de <@${found.userId}>**`,
        erasable ? `\nSe pueden borrar:\n${erasable}` : '\nNo hay nada que borrar.',
        kept ? `\nSe conservan:\n${kept}` : ''
      ].join('\n');

      if (subcommand === 'ver' || !erasable) {
        return interaction.reply({ content: summary, flags: 64, allowedMentions: { parse: [] } });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('personal_data_confirm').setLabel('Borrar ahora').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('personal_data_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
      );
      await interaction.reply({
        content: `${summary}\n\n⚠️ No se puede deshacer.`,
        components: [row], flags: 64, allowedMentions: { parse: [] }
      });
      const reply = await interaction.fetchReply();
      const choice = await reply.awaitMessageComponent({
        filter: click => click.user.id === interaction.user.id,
        time: 60_000
      }).catch(() => null);
      if (!choice) return interaction.editReply({ content: '⏱️ No se borró nada: pasó el tiempo para confirmar.', components: [] });
      if (choice.customId !== 'personal_data_confirm') return choice.update({ content: 'No se borró nada.', components: [] });

      const result = await erase(found.userId);
      const removed = describe(result.removed);
      const stillKept = describe(result.kept, { reasons: true });
      return choice.update({
        content: [
          `✅ Datos de <@${result.userId}> borrados.`,
          removed ? `\n${removed}` : '',
          stillKept ? `\nSe conservan:\n${stillKept}` : '',
          '\n-# Lo publicado en Discord (mensajes, transcripciones) se gestiona en Discord.'
        ].join('\n'),
        components: [],
        allowedMentions: { parse: [] }
      });
    } catch (error) {
      const content = `❌ ${friendlyError(error, interaction)}`;
      if (interaction.replied || interaction.deferred) return interaction.editReply({ content, components: [] }).catch(() => null);
      return interaction.reply({ content, flags: 64 }).catch(() => null);
    }
  }
};
