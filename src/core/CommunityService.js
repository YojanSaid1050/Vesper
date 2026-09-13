const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const CommunityTicket = require('../database/models/CommunityTicket');
const Suggestion = require('../database/models/Suggestion');
const StarboardEntry = require('../database/models/StarboardEntry');
const { getGuildConfig } = require('../database/mongoManager');
const { isApprovedGuild, isModuleEnabledConfig } = require('../config/guildPolicy');

const ticketLocks = new Set();
const ticketCloseLocks = new Set();
const starboardLocks = new Set();
const starboardPending = new Map();
const suggestionCooldowns = new Map();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeChannelName(value) {
  const normalized = String(value || 'usuario').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return normalized.slice(0, 70) || 'usuario';
}

function ticketPanelPayload() {
  return {
    embeds: [new EmbedBuilder()
      .setTitle('🎫 Centro de ayuda')
      .setDescription('Abre un ticket privado para hablar con el equipo. Explica el asunto con claridad y evita compartir contraseñas o datos sensibles.')
      .setColor(0x7C3AED)
      .setFooter({ text: 'Un ticket abierto por persona, salvo que el servidor configure otro límite.' })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('community_ticket_open').setLabel('Abrir ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary)
    )],
    allowedMentions: { parse: [] }
  };
}

async function publishTicketPanel(guild, channel) {
  if (!channel?.isTextBased?.() || channel.isThread?.()) throw new Error('El panel necesita un canal de texto.');
  const permissions = channel.permissionsFor(guild.members.me);
  if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    throw new Error('Vesper no puede publicar el panel en ese canal.');
  }
  return channel.send(ticketPanelPayload());
}

function ticketModal() {
  const modal = new ModalBuilder().setCustomId('community_ticket_open_modal').setTitle('Abrir un ticket');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('subject').setLabel('Asunto').setPlaceholder('Describe brevemente lo que necesitas')
      .setStyle(TextInputStyle.Paragraph).setMinLength(5).setMaxLength(200).setRequired(true)
  ));
  return modal;
}

function closeTicketModal(ticketId) {
  const modal = new ModalBuilder().setCustomId(`community_ticket_close_modal:${ticketId}`).setTitle('Cerrar ticket');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('reason').setLabel('Motivo de cierre').setStyle(TextInputStyle.Paragraph)
      .setMaxLength(500).setRequired(false).setPlaceholder('Resuelto, duplicado, sin respuesta…')
  ));
  return modal;
}

async function createTicket(interaction, subject) {
  const guildId = interaction.guildId;
  const lockKey = `${guildId}:${interaction.user.id}`;
  if (ticketLocks.has(lockKey)) return interaction.reply({ content: 'Ya estoy abriendo tu ticket.', flags: 64 });
  ticketLocks.add(lockKey);
  try {
    const config = await getGuildConfig(guildId);
    if (!isModuleEnabledConfig(config, 'tickets')) {
      return interaction.reply({ content: 'El módulo de tickets está desactivado.', flags: 64 });
    }
    const settings = config.community?.tickets || {};
    const maxOpen = Math.max(1, Math.min(5, Number(settings.maxOpenPerUser) || 1));
    const current = await CommunityTicket.countDocuments({ guildId, userId: interaction.user.id, status: 'open' });
    if (current >= maxOpen) {
      return interaction.reply({ content: `Ya tienes ${current} ticket(s) abierto(s). El límite es ${maxOpen}.`, flags: 64 });
    }
    const me = interaction.guild.members.me;
    if (!me?.permissions?.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles])) {
      return interaction.reply({ content: 'No puedo crear el canal: necesito **Gestionar canales** y **Gestionar roles**.', flags: 64 });
    }
    await interaction.deferReply({ flags: 64 });
    const overwrites = [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
      { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles] }
    ];
    for (const roleId of settings.staffRoles || []) {
      if (interaction.guild.roles.cache.has(roleId)) overwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
    }
    const parent = settings.category && interaction.guild.channels.cache.get(settings.category)?.type === ChannelType.GuildCategory
      ? settings.category : undefined;
    const channel = await interaction.guild.channels.create({
      name: `ticket-${safeChannelName(interaction.user.username)}`,
      type: ChannelType.GuildText,
      parent,
      topic: `Ticket privado de ${interaction.user.tag} (${interaction.user.id})`,
      permissionOverwrites: overwrites,
      reason: `Ticket solicitado por ${interaction.user.tag}`
    });
    let ticket;
    try {
      ticket = await CommunityTicket.create({ guildId, userId: interaction.user.id, channelId: channel.id, subject: String(subject).trim() });
    } catch (error) {
      await channel.delete('No se pudo registrar el ticket').catch(() => null);
      throw error;
    }
    await channel.send({
      content: `<@${interaction.user.id}>`,
      embeds: [new EmbedBuilder().setTitle(`Ticket ${ticket.ticketId}`).setDescription(ticket.subject).setColor(0x7C3AED)
        .addFields({ name: 'Estado', value: 'Abierto', inline: true }, { name: 'Solicitante', value: `<@${interaction.user.id}>`, inline: true })
        .setFooter({ text: 'Usa el botón cuando el asunto esté resuelto.' }).setTimestamp()],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`community_ticket_close:${ticket.ticketId}`).setLabel('Cerrar ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
      )],
      allowedMentions: { users: [interaction.user.id], roles: [] }
    });
    return interaction.editReply({ content: `✅ Ticket creado: ${channel}` });
  } finally {
    ticketLocks.delete(lockKey);
  }
}

async function fetchTranscriptMessages(channel, maximum = 500) {
  const messages = [];
  let before;
  while (messages.length < maximum) {
    const batch = await channel.messages.fetch({ limit: Math.min(100, maximum - messages.length), ...(before ? { before } : {}) });
    if (!batch.size) break;
    messages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  return messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function renderTranscript(ticket, guildName, channelName, messages) {
  const rows = messages.map(message => {
    const attachments = [...message.attachments.values()].map(file =>
      `<a href="${escapeHtml(file.url)}" rel="noreferrer">${escapeHtml(file.name || 'archivo adjunto')}</a>`).join(' · ');
    const content = escapeHtml(message.cleanContent || message.content || '').replaceAll('\n', '<br>') || '<em>Sin texto</em>';
    return `<article><header><strong>${escapeHtml(message.author?.tag || message.author?.username || 'Usuario desconocido')}</strong><time>${escapeHtml(new Date(message.createdTimestamp).toISOString())}</time></header><div>${content}</div>${attachments ? `<footer>${attachments}</footer>` : ''}</article>`;
  }).join('\n');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ticket ${escapeHtml(ticket.ticketId)}</title><style>body{margin:0;background:#111827;color:#e5e7eb;font:15px system-ui}main{max-width:900px;margin:auto;padding:28px}h1{color:#c4b5fd}article{padding:14px 0;border-top:1px solid #374151}header{display:flex;gap:12px;justify-content:space-between}time{color:#9ca3af;font-size:12px}div{margin-top:8px;white-space:normal}a{color:#a78bfa}footer{margin-top:8px}</style></head><body><main><h1>Ticket ${escapeHtml(ticket.ticketId)}</h1><p>${escapeHtml(guildName)} · #${escapeHtml(channelName)} · ${messages.length} mensajes</p>${rows || '<p>No hay mensajes.</p>'}</main></body></html>`;
}

function memberCanClose(interaction, ticket, settings) {
  if (interaction.user.id === ticket.userId) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const allowed = new Set(settings.staffRoles || []);
  return interaction.member?.roles?.cache?.some?.(role => allowed.has(role.id)) === true;
}

async function closeTicket(interaction, ticketId, reason = '') {
  const lockKey = `${interaction.guildId}:${ticketId}`;
  if (ticketCloseLocks.has(lockKey)) return interaction.reply({ content: 'Este ticket ya se está cerrando.', flags: 64 });
  ticketCloseLocks.add(lockKey);
  try {
    const ticket = await CommunityTicket.findOne({ guildId: interaction.guildId, ticketId, status: 'open' });
    if (!ticket) return interaction.reply({ content: 'Este ticket ya está cerrado o no existe.', flags: 64 });
    const config = await getGuildConfig(interaction.guildId);
    const settings = config.community?.tickets || {};
    if (!memberCanClose(interaction, ticket, settings)) return interaction.reply({ content: 'No tienes permiso para cerrar este ticket.', flags: 64 });
    await interaction.deferReply({ flags: 64 });
    const channel = interaction.guild.channels.cache.get(ticket.channelId) || await interaction.guild.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel?.isTextBased?.()) return interaction.editReply({ content: 'No encuentro el canal del ticket.' });
    if (!interaction.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.editReply({ content: 'No puedo bloquear el ticket: necesito el permiso **Gestionar roles**.' });
    }
    const messages = await fetchTranscriptMessages(channel);
    const html = renderTranscript(ticket, interaction.guild.name, channel.name, messages);
    const attachment = new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `ticket-${ticket.ticketId}.html` });
    const transcriptChannel = settings.transcriptChannel
      ? interaction.guild.channels.cache.get(settings.transcriptChannel) || await interaction.guild.channels.fetch(settings.transcriptChannel).catch(() => null)
      : null;
    let transcriptMessage = null;
    const transcriptPayload = {
      embeds: [new EmbedBuilder().setTitle(`Transcripción ${ticket.ticketId}`).setColor(0x6B7280)
        .addFields(
          { name: 'Usuario', value: `<@${ticket.userId}>`, inline: true },
          { name: 'Cerrado por', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Motivo', value: String(reason || 'Sin motivo indicado').slice(0, 500) }
        ).setTimestamp()],
      files: [attachment],
      allowedMentions: { parse: [] }
    };
    if (transcriptChannel?.isTextBased?.()) transcriptMessage = await transcriptChannel.send(transcriptPayload).catch(() => null);
    if (!transcriptMessage) transcriptMessage = await channel.send(transcriptPayload).catch(() => null);
    await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false, AddReactions: false }, { reason: `Ticket ${ticket.ticketId} cerrado` });
    await CommunityTicket.updateOne({ _id: ticket._id, status: 'open' }, {
      $set: { status: 'closed', closedBy: interaction.user.id, closeReason: String(reason || '').slice(0, 500) || null, closedAt: new Date(), transcriptMessageId: transcriptMessage?.id || null }
    });
    await channel.setName(`cerrado-${safeChannelName(ticket.ticketId)}`).catch(() => null);
    await channel.send({ embeds: [new EmbedBuilder().setTitle('🔒 Ticket cerrado').setDescription(String(reason || 'Sin motivo indicado').slice(0, 500)).setColor(0x6B7280).setTimestamp()], allowedMentions: { parse: [] } }).catch(() => null);
    return interaction.editReply({ content: `✅ Ticket **${ticket.ticketId}** cerrado y transcripción generada.` });
  } finally {
    ticketCloseLocks.delete(lockKey);
  }
}

async function publishSelfRolePanel(guild, channel, roles) {
  if (!channel?.isTextBased?.() || channel.isThread?.()) throw new Error('El panel necesita un canal de texto.');
  if (!roles?.length) throw new Error('Configura al menos un autorrol antes de publicar.');
  const permissions = channel.permissionsFor(guild.members.me);
  if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    throw new Error('Vesper no puede publicar el panel en ese canal.');
  }
  const menu = new StringSelectMenuBuilder().setCustomId('community_selfroles').setPlaceholder('Selecciona tus roles')
    .setMinValues(0).setMaxValues(Math.min(roles.length, 25));
  for (const item of roles.slice(0, 25)) {
    const option = { label: item.label.slice(0, 100), value: item.roleId, ...(item.description ? { description: item.description.slice(0, 100) } : {}) };
    if (item.emoji) option.emoji = item.emoji;
    menu.addOptions(option);
  }
  return channel.send({
    embeds: [new EmbedBuilder().setTitle('🎭 Autorroles').setDescription('Elige uno o varios roles para alternarlos: si ya lo tienes se retira; si no, se añade.').setColor(0x7C3AED)],
    components: [new ActionRowBuilder().addComponents(menu)],
    allowedMentions: { parse: [] }
  });
}

async function handleSelfRoles(interaction) {
  if (!isApprovedGuild(interaction.guildId)) return interaction.reply({ content: 'Esta función no está disponible en este servidor.', flags: 64 });
  const config = await getGuildConfig(interaction.guildId);
  if (!isModuleEnabledConfig(config, 'selfroles')) return interaction.reply({ content: 'Los autorroles están desactivados.', flags: 64 });
  const configured = config.community?.selfRoles?.roles || [];
  const allowedIds = new Set(configured.map(item => String(item.roleId)));
  const selected = new Set(interaction.values.filter(id => allowedIds.has(id)));
  const me = interaction.guild.members.me;
  if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: 'No puedo gestionar roles.', flags: 64 });
  const manageable = [...allowedIds].filter(id => {
    const role = interaction.guild.roles.cache.get(id);
    return role && !role.managed && role.position < me.roles.highest.position;
  });
  const add = manageable.filter(id => selected.has(id) && !interaction.member.roles.cache.has(id));
  const remove = manageable.filter(id => selected.has(id) && interaction.member.roles.cache.has(id));
  await interaction.deferReply({ flags: 64 });
  if (add.length) await interaction.member.roles.add(add, 'Autorroles de Vesper');
  if (remove.length) await interaction.member.roles.remove(remove, 'Autorroles de Vesper');
  const skipped = allowedIds.size - manageable.length;
  return interaction.editReply({ content: `✅ Roles actualizados: ${add.length} añadido(s), ${remove.length} retirado(s).${skipped ? ` ${skipped} rol(es) no eran administrables.` : ''}` });
}

async function createSuggestion(interaction, text) {
  const cooldownKey = `${interaction.guildId}:${interaction.user.id}`;
  const cooldownUntil = suggestionCooldowns.get(cooldownKey) || 0;
  if (cooldownUntil > Date.now()) {
    return interaction.reply({ content: `Espera ${Math.ceil((cooldownUntil - Date.now()) / 1000)} segundos antes de enviar otra sugerencia.`, flags: 64 });
  }
  const config = await getGuildConfig(interaction.guildId);
  if (!isModuleEnabledConfig(config, 'suggestions')) return interaction.reply({ content: 'Las sugerencias están desactivadas.', flags: 64 });
  const channelId = config.community?.suggestions?.channel;
  const channel = channelId && (interaction.guild.channels.cache.get(channelId) || await interaction.guild.channels.fetch(channelId).catch(() => null));
  if (!channel?.isTextBased?.()) return interaction.reply({ content: 'El canal de sugerencias no está configurado.', flags: 64 });
  await interaction.deferReply({ flags: 64 });
  const message = await channel.send({
    embeds: [new EmbedBuilder().setTitle('💡 Nueva sugerencia').setDescription(String(text).trim().slice(0, 1500)).setColor(0x7C3AED)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .addFields({ name: 'Estado', value: '🟡 Pendiente' }).setTimestamp()],
    allowedMentions: { parse: [] }
  });
  await Promise.all([message.react('👍'), message.react('👎')]).catch(() => null);
  try {
    await Suggestion.create({ guildId: interaction.guildId, channelId: channel.id, messageId: message.id, userId: interaction.user.id, text: String(text).trim() });
  } catch (error) {
    await message.delete().catch(() => null);
    throw error;
  }
  suggestionCooldowns.set(cooldownKey, Date.now() + 60_000);
  setTimeout(() => suggestionCooldowns.delete(cooldownKey), 60_000).unref?.();
  return interaction.editReply({ content: `✅ Sugerencia publicada: https://discord.com/channels/${interaction.guildId}/${channel.id}/${message.id}` });
}

async function reviewSuggestion(guild, messageId, status, reviewerId, note) {
  const suggestion = await Suggestion.findOneAndUpdate(
    { guildId: guild.id, messageId },
    { $set: { status, reviewedBy: reviewerId, reviewNote: String(note || '').slice(0, 500) || null } },
    { returnDocument: 'after' }
  );
  if (!suggestion) {
    const error = new Error('No existe una sugerencia con ese ID de mensaje.');
    error.statusCode = 404;
    throw error;
  }
  const channel = guild.channels.cache.get(suggestion.channelId) || await guild.channels.fetch(suggestion.channelId).catch(() => null);
  const message = channel?.isTextBased?.() ? await channel.messages.fetch(suggestion.messageId).catch(() => null) : null;
  if (message) {
    const label = status === 'approved' ? '🟢 Aprobada' : status === 'rejected' ? '🔴 Rechazada' : '🟡 Pendiente';
    const embed = EmbedBuilder.from(message.embeds[0] || {}).setColor(status === 'approved' ? 0x57F287 : status === 'rejected' ? 0xED4245 : 0xFEE75C);
    const baseFields = (embed.data.fields || []).filter(field => !['Estado', 'Revisión'].includes(field.name));
    embed.setFields(...baseFields, { name: 'Estado', value: label }, ...(note ? [{ name: 'Revisión', value: String(note).slice(0, 500) }] : []));
    await message.edit({ embeds: [embed] });
  }
  return suggestion;
}

function configuredEmojiId(value) {
  const match = String(value || '').match(/\d{17,20}/);
  return match ? match[0] : String(value || '⭐');
}

function reactionMatches(reaction, configured) {
  const expected = configuredEmojiId(configured);
  return reaction.emoji.id ? reaction.emoji.id === expected : reaction.emoji.name === expected;
}

async function qualifyingStarCount(reaction, authorId) {
  const users = await reaction.users.fetch();
  return users.filter(user => !user.bot && user.id !== authorId).size;
}

async function handleStarReaction(reaction) {
  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (reaction.message?.partial) await reaction.message.fetch().catch(() => null);
  const message = reaction.message;
  if (!message?.guild || !message.author || message.author.bot) return;
  if (!isApprovedGuild(message.guild.id)) return;
  const config = await getGuildConfig(message.guild.id);
  if (!isModuleEnabledConfig(config, 'starboard')) return;
  const settings = config.community?.starboard || {};
  if (!settings.channel || message.channelId === settings.channel || (settings.ignoredChannels || []).includes(message.channelId)) return;
  if (!reactionMatches(reaction, settings.emoji)) return;
  const lockKey = `${message.guild.id}:${message.id}`;
  if (starboardLocks.has(lockKey)) {
    starboardPending.set(lockKey, reaction);
    return;
  }
  starboardLocks.add(lockKey);
  try {
    const channel = message.guild.channels.cache.get(settings.channel) || await message.guild.channels.fetch(settings.channel).catch(() => null);
    if (!channel?.isTextBased?.()) return;
    const count = await qualifyingStarCount(reaction, message.author.id).catch(() => Math.max(0, Number(reaction.count || 0) - 1));
    const threshold = Math.max(2, Math.min(50, Number(settings.threshold) || 3));
    const entry = await StarboardEntry.findOne({ guildId: message.guild.id, sourceMessageId: message.id });
    if (count < threshold) {
      if (entry) {
        const mirror = await channel.messages.fetch(entry.starboardMessageId).catch(() => null);
        if (mirror) await mirror.delete().catch(() => null);
        await entry.deleteOne();
      }
      return;
    }
    const embed = new EmbedBuilder().setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setDescription((message.cleanContent || message.content || '*Mensaje sin texto*').slice(0, 3500))
      .addFields({ name: 'Origen', value: `[Ir al mensaje](${message.url})` }).setColor(0xF59E0B).setTimestamp(message.createdAt);
    const image = [...message.attachments.values()].find(file => file.contentType?.startsWith('image/'));
    if (image) embed.setImage(image.url);
    const payload = { content: `${settings.emoji || '⭐'} **${count}** · <#${message.channelId}>`, embeds: [embed], allowedMentions: { parse: [] } };
    if (entry) {
      const mirror = await channel.messages.fetch(entry.starboardMessageId).catch(() => null);
      if (mirror) {
        await mirror.edit(payload);
        entry.count = count;
        await entry.save();
        return;
      }
      await entry.deleteOne();
    }
    const mirror = await channel.send(payload);
    await StarboardEntry.create({ guildId: message.guild.id, sourceMessageId: message.id, sourceChannelId: message.channelId, starboardMessageId: mirror.id, authorId: message.author.id, count });
  } finally {
    starboardLocks.delete(lockKey);
    const pending = starboardPending.get(lockKey);
    if (pending) {
      starboardPending.delete(lockKey);
      queueMicrotask(() => handleStarReaction(pending).catch(error => console.error('Error actualizando starboard:', error.message)));
    }
  }
}

async function handleCommunityButton(interaction) {
  if (!isApprovedGuild(interaction.guildId)) return false;
  if (interaction.customId === 'community_ticket_open') {
    await interaction.showModal(ticketModal());
    return true;
  }
  if (interaction.customId.startsWith('community_ticket_close:')) {
    const ticketId = interaction.customId.split(':')[1];
    const ticket = await CommunityTicket.findOne({ guildId: interaction.guildId, ticketId, status: 'open' });
    if (!ticket) await interaction.reply({ content: 'Este ticket ya está cerrado o no existe.', flags: 64 });
    else {
      const config = await getGuildConfig(interaction.guildId);
      if (!memberCanClose(interaction, ticket, config.community?.tickets || {})) await interaction.reply({ content: 'No tienes permiso para cerrar este ticket.', flags: 64 });
      else await interaction.showModal(closeTicketModal(ticketId));
    }
    return true;
  }
  return false;
}

async function handleCommunityModal(interaction) {
  if (!isApprovedGuild(interaction.guildId)) return false;
  if (interaction.customId === 'community_ticket_open_modal') {
    await createTicket(interaction, interaction.fields.getTextInputValue('subject'));
    return true;
  }
  if (interaction.customId.startsWith('community_ticket_close_modal:')) {
    await closeTicket(interaction, interaction.customId.split(':')[1], interaction.fields.getTextInputValue('reason'));
    return true;
  }
  return false;
}

module.exports = {
  closeTicket,
  createSuggestion,
  createTicket,
  escapeHtml,
  handleCommunityButton,
  handleCommunityModal,
  handleSelfRoles,
  handleStarReaction,
  publishSelfRolePanel,
  publishTicketPanel,
  qualifyingStarCount,
  renderTranscript,
  reviewSuggestion,
  safeChannelName,
  ticketPanelPayload
};
