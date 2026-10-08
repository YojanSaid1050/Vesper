const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const TemporaryVoiceChannel = require('../database/models/TemporaryVoiceChannel');
const { getGuildConfig } = require('../database/mongoManager');
const { isModuleEnabledConfig } = require('../config/guildPolicy');

const createLocks = new Set();
const deleteTimers = new Map();

function cleanChannelName(value) {
  return String(value || 'Sala temporal').replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sala temporal';
}

function roomName(template, member) {
  return cleanChannelName(String(template || 'Sala de {username}')
    .replaceAll('{username}', member.user.username)
    .replaceAll('{displayName}', member.displayName || member.user.username));
}

function controlPayload(ownerId, state = {}) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Control de sala temporal')
    .setDescription(`Propietario: <@${ownerId}>\nUsa estos controles para personalizar la sala. Se eliminará cuando quede vacía.`)
    .setFooter({ text: 'Los permisos peligrosos nunca se entregan al propietario.' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tempvoice:rename').setLabel('Renombrar').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tempvoice:limit').setLabel('Límite').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(state.locked ? 'tempvoice:unlock' : 'tempvoice:lock').setLabel(state.locked ? 'Desbloquear' : 'Bloquear').setEmoji(state.locked ? '🔓' : '🔒').setStyle(state.locked ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(state.hidden ? 'tempvoice:show' : 'tempvoice:hide').setLabel(state.hidden ? 'Mostrar' : 'Ocultar').setEmoji(state.hidden ? '👁️' : '🙈').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tempvoice:delete').setLabel('Cerrar').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}

async function findRoom(channelId) {
  return channelId ? TemporaryVoiceChannel.findOne({ channelId: String(channelId) }) : null;
}

async function roomContext(interaction) {
  const room = await findRoom(interaction.channelId);
  if (!room) throw new Error('Esta sala temporal ya no está registrada.');
  const channel = interaction.guild?.channels?.cache?.get(room.channelId)
    || await interaction.guild?.channels?.fetch(room.channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildVoice) throw new Error('La sala ya no existe.');
  if (interaction.user.id !== room.ownerId && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('Solo el propietario de la sala puede usar este control.');
  }
  return { room, channel };
}

async function ephemeral(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

async function createRoom(newState, config) {
  const member = newState.member;
  const guild = newState.guild;
  const key = `${guild.id}:${member.id}`;
  if (createLocks.has(key)) return;
  createLocks.add(key);
  try {
    const existing = await TemporaryVoiceChannel.findOne({ guildId: guild.id, ownerId: member.id });
    if (existing) {
      const channel = guild.channels.cache.get(existing.channelId) || await guild.channels.fetch(existing.channelId).catch(() => null);
      if (channel) {
        await member.voice.setChannel(channel, 'Regreso a su sala temporal');
        return;
      }
      await existing.deleteOne();
    }

    const settings = config.tempVoice || {};
    const channel = await guild.channels.create({
      name: roomName(settings.nameTemplate, member),
      type: ChannelType.GuildVoice,
      parent: settings.category || newState.channel?.parentId || null,
      userLimit: Number(settings.userLimit || 0),
      bitrate: Math.min(Number(settings.bitrate || 64000), Number(guild.maximumBitrate || 96000)),
      reason: `Sala temporal creada para ${member.user.tag}`
    });
    let record;
    try {
      record = await TemporaryVoiceChannel.create({
        guildId: guild.id, channelId: channel.id, ownerId: member.id,
        locked: Boolean(settings.lockedByDefault), hidden: Boolean(settings.hiddenByDefault)
      });
      await channel.permissionOverwrites.edit(member.id, { ViewChannel: true, Connect: true, Speak: true }, { reason: 'Propietario de sala temporal' });
      if (settings.lockedByDefault || settings.hiddenByDefault) {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          Connect: settings.lockedByDefault ? false : null,
          ViewChannel: settings.hiddenByDefault ? false : null
        }, { reason: 'Estado inicial de sala temporal' });
      }
      await member.voice.setChannel(channel, 'Entró al canal generador de salas temporales');
      if (channel.isTextBased?.()) {
        const permissions = channel.permissionsFor(guild.members.me);
        if (permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
          const message = await channel.send(controlPayload(member.id, record)).catch(() => null);
          if (message) {
            record.controlMessageId = message.id;
            await record.save();
          }
        }
      }
    } catch (error) {
      if (record) await record.deleteOne().catch(() => null);
      await channel.delete('No se pudo registrar la sala temporal').catch(() => null);
      throw error;
    }
  } finally {
    createLocks.delete(key);
  }
}

async function cleanupRoom(oldState) {
  if (!oldState.channelId) return;
  const record = await findRoom(oldState.channelId);
  if (!record) return;
  clearTimeout(deleteTimers.get(record.channelId));
  const timer = setTimeout(async () => {
    deleteTimers.delete(record.channelId);
    const channel = oldState.guild.channels.cache.get(record.channelId)
      || await oldState.guild.channels.fetch(record.channelId).catch(() => null);
    if (!channel) return TemporaryVoiceChannel.deleteOne({ channelId: record.channelId });
    const humans = channel.members.filter(member => !member.user.bot);
    if (!humans.size) {
      await TemporaryVoiceChannel.deleteOne({ channelId: record.channelId });
      await channel.delete('Sala temporal vacía').catch(() => null);
      return;
    }
    if (record.ownerId === oldState.id && !humans.has(record.ownerId)) {
      const next = humans.first();
      const previousOwnerId = record.ownerId;
      record.ownerId = next.id;
      await record.save();
      await channel.permissionOverwrites.delete(previousOwnerId, 'Transferencia de sala temporal').catch(() => null);
      await channel.permissionOverwrites.edit(next.id, { ViewChannel: true, Connect: true, Speak: true }, { reason: 'Nuevo propietario de sala temporal' }).catch(() => null);
      const control = record.controlMessageId && await channel.messages?.fetch(record.controlMessageId).catch(() => null);
      if (control) await control.edit(controlPayload(next.id, record)).catch(() => null);
    }
  }, 2500);
  deleteTimers.set(record.channelId, timer);
}

async function handleVoiceStateUpdate(oldState, newState, config = null) {
  if (oldState.channelId === newState.channelId) return;
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;
  const guildConfig = config || await getGuildConfig(newState.guild.id);
  if (isModuleEnabledConfig(guildConfig, 'tempvoice', newState.guild.id)
    && guildConfig.tempVoice?.generatorChannel
    && newState.channelId === guildConfig.tempVoice.generatorChannel) {
    await createRoom(newState, guildConfig);
  }
  await cleanupRoom(oldState);
}

async function handleTempVoiceButton(interaction) {
  if (!String(interaction.customId || '').startsWith('tempvoice:')) return false;
  try {
    const action = interaction.customId.split(':')[1];
    const { room, channel } = await roomContext(interaction);
    if (action === 'rename' || action === 'limit') {
      const input = new TextInputBuilder()
        .setCustomId(action === 'rename' ? 'name' : 'limit')
        .setLabel(action === 'rename' ? 'Nuevo nombre' : 'Límite de usuarios (0 a 99)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(action === 'rename' ? 80 : 2)
        .setValue(action === 'rename' ? channel.name : String(channel.userLimit || 0));
      const modal = new ModalBuilder().setCustomId(`tempvoice:${action}:submit`).setTitle(action === 'rename' ? 'Renombrar sala' : 'Cambiar límite')
        .addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return true;
    }
    if (action === 'lock' || action === 'unlock') {
      const locked = action === 'lock';
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: locked ? false : null }, { reason: 'Control de sala temporal' });
      room.locked = locked;
      await room.save();
      await interaction.update(controlPayload(room.ownerId, room));
      await ephemeral(interaction, locked ? 'Sala bloqueada. Los miembros actuales pueden permanecer.' : 'Sala desbloqueada.').catch(() => null);
      return true;
    }
    if (action === 'hide' || action === 'show') {
      const hidden = action === 'hide';
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: hidden ? false : null }, { reason: 'Control de sala temporal' });
      room.hidden = hidden;
      await room.save();
      await interaction.update(controlPayload(room.ownerId, room));
      await ephemeral(interaction, hidden ? 'Sala oculta para el resto del servidor.' : 'Sala visible nuevamente.').catch(() => null);
      return true;
    }
    if (action === 'delete') {
      await interaction.reply({ content: 'Cerrando la sala…', flags: MessageFlags.Ephemeral });
      await TemporaryVoiceChannel.deleteOne({ channelId: channel.id });
      await channel.delete(`Sala temporal cerrada por ${interaction.user.tag}`);
      return true;
    }
  } catch (error) {
    await ephemeral(interaction, `No pude actualizar la sala: ${String(error.message || error).slice(0, 250)}`).catch(() => null);
  }
  return true;
}

async function handleTempVoiceModal(interaction) {
  if (!String(interaction.customId || '').startsWith('tempvoice:')) return false;
  try {
    const action = interaction.customId.split(':')[1];
    const { channel } = await roomContext(interaction);
    if (action === 'rename') {
      const name = cleanChannelName(interaction.fields.getTextInputValue('name'));
      await channel.setName(name, `Sala temporal renombrada por ${interaction.user.tag}`);
      await ephemeral(interaction, `Sala renombrada a **${name}**.`);
    } else if (action === 'limit') {
      const raw = interaction.fields.getTextInputValue('limit').trim();
      const limit = Number(raw);
      if (!Number.isInteger(limit) || limit < 0 || limit > 99) throw new Error('El límite debe ser un número entero entre 0 y 99.');
      await channel.setUserLimit(limit, `Límite temporal cambiado por ${interaction.user.tag}`);
      await ephemeral(interaction, limit ? `Límite ajustado a ${limit} personas.` : 'La sala quedó sin límite de usuarios.');
    }
  } catch (error) {
    await ephemeral(interaction, `No pude actualizar la sala: ${String(error.message || error).slice(0, 250)}`).catch(() => null);
  }
  return true;
}

async function reconcileTemporaryVoiceChannels(client) {
  const records = await TemporaryVoiceChannel.find({});
  let removed = 0;
  for (const record of records) {
    const guild = client.guilds.cache.get(record.guildId);
    const channel = guild
      ? guild.channels.cache.get(record.channelId) || await guild.channels.fetch(record.channelId).catch(() => null)
      : null;
    if (!guild || !channel || channel.type !== ChannelType.GuildVoice) {
      await record.deleteOne();
      removed++;
      continue;
    }
    if (!channel.members.filter(member => !member.user.bot).size) {
      await record.deleteOne();
      await channel.delete('Limpieza de sala temporal vacía tras reinicio').catch(() => null);
      removed++;
    }
  }
  return { checked: records.length, removed };
}

module.exports = {
  handleVoiceStateUpdate,
  handleTempVoiceButton,
  handleTempVoiceModal,
  reconcileTemporaryVoiceChannels,
  roomName,
  cleanChannelName,
  controlPayload
};
