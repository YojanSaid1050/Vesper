// src/core/TempVoiceService.js
//
// Salas de voz temporales: quien entra al canal generador recibe su propia
// sala, que se borra sola al quedar vacía.
//
// Se gestionan con una interfaz de 15 botones metidos dentro del bloque
// (Components V2): la interfaz fija que el servidor publica en un canal de
// texto y la copia que se deja en el chat de cada sala nueva. Desde la
// interfaz fija los botones actúan sobre la sala en la que estés.

const {
  ActionRowBuilder,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder
} = require('discord.js');
const TemporaryVoiceChannel = require('../database/models/TemporaryVoiceChannel');
const { getGuildConfig, updateGuildSection } = require('../database/mongoManager');
const { isModuleEnabledConfig, guildTier } = require('../config/guildPolicy');
const { buildMessage } = require('./EmbedCatalog');
const { sendBrandedMessage, editBrandedMessage, deleteBrandedMessage } = require('../utils/webhookSender');

const createLocks = new Set();
const deleteTimers = new Map();

const ROW = 1;
const BUTTON = 2;
const TEXT = 10;
const SEPARATOR = 14;
const SECONDARY = 2;
const DANGER = 4;

// Las regiones de voz que Discord acepta hoy. «Automática» deja que Discord
// elija la más cercana a quien habla.
const REGIONS = Object.freeze([
  ['auto', 'Automática', '🌐'],
  ['brazil', 'Brasil', '🇧🇷'],
  ['us-east', 'EE. UU. este', '🇺🇸'],
  ['us-central', 'EE. UU. centro', '🇺🇸'],
  ['us-south', 'EE. UU. sur', '🇺🇸'],
  ['us-west', 'EE. UU. oeste', '🇺🇸'],
  ['rotterdam', 'Europa (Róterdam)', '🇪🇺'],
  ['singapore', 'Singapur', '🇸🇬'],
  ['japan', 'Japón', '🇯🇵'],
  ['hongkong', 'Hong Kong', '🇭🇰'],
  ['south-korea', 'Corea del Sur', '🇰🇷'],
  ['india', 'India', '🇮🇳'],
  ['sydney', 'Sídney', '🇦🇺'],
  ['southafrica', 'Sudáfrica', '🇿🇦']
]);

// Lo que hace cada botón de la interfaz, en el orden en que salen.
const BUTTONS = Object.freeze([
  [['rename', 'Nombre', '✏️'], ['limit', 'Límite', '👥'], ['privacy', 'Privacidad', '🛡️'], ['chat', 'Chat', '💬'], ['region', 'Región', '🌐']],
  [['trust', 'Permitir', '✅'], ['untrust', 'Quitar', '➖'], ['invite', 'Invitar', '📨'], ['kick', 'Expulsar', '👢'], ['info', 'Info', 'ℹ️']],
  [['block', 'Bloquear', '⛔'], ['unblock', 'Desbloquear', '♻️'], ['claim', 'Reclamar', '👑'], ['transfer', 'Transferir', '🔁'], ['delete', 'Eliminar', '🗑️']]
]);

// Acciones que se eligen sobre personas con un menú.
const PICKS = Object.freeze({
  trust: { placeholder: 'Quién puede entrar aunque la sala esté cerrada', max: 10 },
  untrust: { placeholder: 'A quién le quitas el permiso', max: 10 },
  invite: { placeholder: 'A quién invitas (le llega un mensaje privado)', max: 5 },
  kick: { placeholder: 'A quién sacas de la sala', max: 10 },
  block: { placeholder: 'Quién no podrá ver ni entrar a la sala', max: 10 },
  unblock: { placeholder: 'A quién le levantas el bloqueo', max: 10 },
  transfer: { placeholder: 'El nuevo dueño (tiene que estar en la sala)', max: 1 }
});

// Nombre de fábrica de las salas en cada servidor. En Ankerie Dimension las
// salas son «equipos». «Sala de {username}» era el valor de fábrica para todos,
// así que guardado tal cual se toma como «sin personalizar».
const LEGACY_ROOM_TEMPLATE = 'Sala de {username}';
function defaultRoomTemplate(guildId) {
  return guildTier(guildId) === 'themed_main' ? 'Equipo de {username}' : LEGACY_ROOM_TEMPLATE;
}

function roomTemplate(settings, guildId) {
  const saved = String(settings?.nameTemplate || '').trim();
  return !saved || saved === LEGACY_ROOM_TEMPLATE ? defaultRoomTemplate(guildId) : saved;
}

function cleanChannelName(value) {
  return String(value || 'Sala temporal').replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sala temporal';
}

// {username} es el nombre que se ve en el perfil (el nombre visible de la
// cuenta; si no tiene, su @usuario). {displayName} respeta además el apodo
// del servidor, y {handle} es siempre el @usuario.
function roomName(template, member) {
  const user = member.user || {};
  const visible = user.globalName || user.username || 'Sala';
  return cleanChannelName(String(template || 'Sala de {username}')
    .replaceAll('{username}', visible)
    .replaceAll('{displayName}', member.displayName || visible)
    .replaceAll('{handle}', user.username || visible));
}

function buttonRows() {
  return BUTTONS.map(row => ({
    type: ROW,
    components: row.map(([action, label, emoji]) => ({
      type: BUTTON,
      custom_id: `tempvoice:${action}`,
      label,
      emoji: { name: emoji },
      style: action === 'delete' ? DANGER : SECONDARY
    }))
  }));
}

// La interfaz (fija o de una sala) con los textos del catálogo y los botones
// dentro del bloque.
function interfacePayload({ guild, config, room = null, ownerName = null }) {
  const kind = room ? 'tempvoice_room' : 'tempvoice_interface';
  const generator = config?.tempVoice?.generatorChannel;
  const vars = room
    ? { owner: `<@${room.ownerId}>`, ownerName: ownerName || 'su dueño', channel: `<#${room.channelId}>`, server: guild?.name || '' }
    : { server: guild?.name || '', generator: generator ? `<#${generator}>` : 'el canal para crear salas' };
  const payload = buildMessage(kind, { config, vars });
  const container = payload.components[0];
  if (room) {
    const state = [room.locked ? '🔒 Cerrada' : '🔓 Abierta', room.hidden ? '🙈 Oculta' : '👁️ Visible', room.chatLocked ? '💬 Chat cerrado' : '💬 Chat abierto'];
    container.components.push({ type: TEXT, content: `-# ${state.join(' · ')}` });
  }
  container.components.push({ type: SEPARATOR, spacing: 1, divider: true }, ...buttonRows());
  return { flags: payload.flags, components: payload.components, allowedMentions: { parse: [] } };
}

// Compatibilidad: antes cada sala recibía este panel sin configuración.
function controlPayload(ownerId, state = {}) {
  return interfacePayload({ guild: null, config: null, room: { ownerId, channelId: state.channelId || '0', ...state } });
}

async function findRoom(channelId) {
  return channelId ? TemporaryVoiceChannel.findOne({ channelId: String(channelId) }) : null;
}

async function fetchChannel(guild, channelId) {
  return guild?.channels?.cache?.get(channelId) || await guild?.channels?.fetch(channelId).catch(() => null);
}

// Un aviso para quien pulsa (no está en su sala, no es el dueño…), que no es
// un fallo del bot y se muestra tal cual.
function notice(message) {
  return Object.assign(new Error(message), { notice: true });
}

function failureText(error) {
  const detail = String(error?.message || error).slice(0, 250);
  return error?.notice ? detail : `No pude cambiar la sala: ${detail}`;
}

// La sala sobre la que actúa un botón: la del chat donde se pulsó o, desde la
// interfaz fija, aquella en la que está quien lo pulsa.
async function roomContext(interaction, { ownerOnly = true } = {}) {
  const room = await findRoom(interaction.channelId) || await findRoom(interaction.member?.voice?.channelId);
  if (!room) throw notice('Entra a tu sala temporal para usar estos botones. Si aún no tienes una, entra al canal para crear salas.');
  const channel = await fetchChannel(interaction.guild, room.channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) throw notice('Esa sala ya no existe.');
  if (ownerOnly && interaction.user.id !== room.ownerId && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
    throw notice(`Solo el dueño de la sala (<@${room.ownerId}>) puede usar este botón. Si se fue, usa «Reclamar».`);
  }
  return { room, channel };
}

async function ephemeral(interaction, content, extra = {}) {
  const payload = { content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] }, ...extra };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

// Respuesta a un menú efímero: se cambia el propio mensaje por el resultado.
async function settleMenu(interaction, content) {
  const payload = { content, components: [], allowedMentions: { parse: [] } };
  if (interaction.isMessageComponent?.() && !interaction.deferred && !interaction.replied) return interaction.update(payload);
  return ephemeral(interaction, content);
}

// Ocultar o bloquear la sala niega Ver canal y Conectar a @everyone, y eso
// también alcanza al bot si no es administrador: dejaba de ver la sala, no
// podía borrarla al quedar vacía y la música no podía entrar. El bot conserva
// su acceso con un permiso propio sobre el canal.
async function ensureBotAccess(channel) {
  const me = channel.guild.members.me;
  if (!me) return;
  await channel.permissionOverwrites.edit(me.id, { ViewChannel: true, Connect: true }, { reason: 'Acceso del bot a la sala temporal' });
}

async function refreshRoomControl(guild, channel, room) {
  if (!room.controlMessageId || !channel?.messages) return;
  const message = await channel.messages.fetch(room.controlMessageId).catch(() => null);
  if (!message) return;
  const config = await getGuildConfig(guild.id).catch(() => null);
  const owner = guild.members?.cache?.get(room.ownerId);
  await editBrandedMessage(channel, message.id, interfacePayload({ guild, config, room, ownerName: owner ? roomName('{username}', owner) : null })).catch(() => null);
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
      const channel = await fetchChannel(guild, existing.channelId);
      if (channel) {
        await member.voice.setChannel(channel, 'Regreso a su sala temporal');
        return;
      }
      await existing.deleteOne();
    }

    // El nombre visible puede haber cambiado y la caché no enterarse: se
    // pide la cuenta fresca antes de nombrar la sala.
    await member.user.fetch?.(true).catch(() => null);
    const settings = config.tempVoice || {};
    const channel = await guild.channels.create({
      name: roomName(roomTemplate(settings, guild.id), member),
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
        await ensureBotAccess(channel);
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          Connect: settings.lockedByDefault ? false : null,
          ViewChannel: settings.hiddenByDefault ? false : null
        }, { reason: 'Estado inicial de sala temporal' });
      }
      await member.voice.setChannel(channel, 'Entró al canal generador de salas temporales');
      if (channel.isTextBased?.()) {
        const permissions = channel.permissionsFor(guild.members.me);
        if (permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
          // Con el webhook del servidor, para que salga con su nombre y su foto.
          const message = await sendBrandedMessage(channel, interfacePayload({ guild, config, room: record, ownerName: roomName('{username}', member) }), { interactive: true }).catch(() => null);
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
  const channelId = record.channelId;
  clearTimeout(deleteTimers.get(channelId));
  const timer = setTimeout(() => {
    deleteTimers.delete(channelId);
    settleRoom(oldState.guild, channelId).catch(error => {
      console.error(`[TempVoice] No pude revisar la sala ${channelId}:`, error.message || error);
    });
  }, 2500);
  deleteTimers.set(channelId, timer);
}

async function transferOwnership(guild, channel, room, nextMember, reason) {
  const previousOwnerId = room.ownerId;
  room.ownerId = nextMember.id;
  await room.save();
  if (previousOwnerId !== nextMember.id) {
    await channel.permissionOverwrites.delete(previousOwnerId, reason).catch(() => null);
  }
  await channel.permissionOverwrites.edit(nextMember.id, { ViewChannel: true, Connect: true, Speak: true }, { reason }).catch(() => null);
  await refreshRoomControl(guild, channel, room);
}

// Se vuelve a leer el registro al vencer la espera: en esos 2,5 s la sala pudo
// cerrarse desde el botón, o pudo salir otra persona y reprogramar el
// temporizador. Antes se usaba el registro de cuando salió la primera persona
// y solo se transfería si el último en salir era el propietario, así que si
// salía el dueño y después otro miembro, la sala se quedaba sin dueño.
async function settleRoom(guild, channelId) {
  const record = await findRoom(channelId);
  if (!record) return;
  const channel = await fetchChannel(guild, channelId);
  if (!channel) {
    await TemporaryVoiceChannel.deleteOne({ channelId });
    return;
  }
  const humans = channel.members.filter(member => !member.user.bot);
  if (!humans.size) {
    await TemporaryVoiceChannel.deleteOne({ channelId });
    await channel.delete('Sala temporal vacía').catch(() => null);
    return;
  }
  if (humans.has(record.ownerId)) return;
  await transferOwnership(guild, channel, record, humans.first(), 'Transferencia de sala temporal');
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

/* ------------------------------------------------------------------ */
/* Acciones                                                            */
/* ------------------------------------------------------------------ */

async function setPrivacy(interaction, channel, room, mode) {
  await ensureBotAccess(channel);
  const everyone = interaction.guild.roles.everyone;
  if (mode === 'lock' || mode === 'unlock') {
    await channel.permissionOverwrites.edit(everyone, { Connect: mode === 'lock' ? false : null }, { reason: 'Control de sala temporal' });
    room.locked = mode === 'lock';
  } else {
    await channel.permissionOverwrites.edit(everyone, { ViewChannel: mode === 'hide' ? false : null }, { reason: 'Control de sala temporal' });
    room.hidden = mode === 'hide';
  }
  await room.save();
  await refreshRoomControl(interaction.guild, channel, room);
  return {
    lock: '🔒 Sala cerrada: solo entran quienes tengan permiso. Los que ya están pueden quedarse.',
    unlock: '🔓 Sala abierta para todos.',
    hide: '🙈 Sala oculta para el resto del servidor.',
    show: '👁️ Sala visible de nuevo.'
  }[mode];
}

function infoText(channel, room) {
  const region = REGIONS.find(([id]) => id === (channel.rtcRegion || 'auto'))?.[1] || channel.rtcRegion;
  const humans = channel.members?.filter?.(member => !member.user.bot)?.size ?? 0;
  return [
    `**${channel.name}**`,
    `Dueño: <@${room.ownerId}>`,
    `Personas: ${humans}${channel.userLimit ? ` de ${channel.userLimit}` : ' (sin límite)'}`,
    `Estado: ${room.locked ? 'cerrada' : 'abierta'} · ${room.hidden ? 'oculta' : 'visible'} · chat ${room.chatLocked ? 'cerrado' : 'abierto'}`,
    `Región: ${region}`,
    `Calidad: ${Math.round((channel.bitrate || 64000) / 1000)} kbps`
  ].join('\n');
}

async function applyPick(interaction, action, channel, room) {
  const guild = interaction.guild;
  const meId = guild.members.me?.id;
  const targets = [];
  for (const id of interaction.values || []) {
    const member = guild.members.cache.get(id) || await guild.members.fetch(id).catch(() => null);
    if (member) targets.push(member);
  }
  const done = [];
  const skipped = [];
  for (const member of targets) {
    const id = member.id;
    const name = `<@${id}>`;
    if (id === meId || (id === room.ownerId && action !== 'invite')) { skipped.push(name); continue; }
    if (action === 'trust') {
      await channel.permissionOverwrites.edit(id, { ViewChannel: true, Connect: true }, { reason: 'Permitido en la sala temporal' });
      done.push(name);
    } else if (action === 'untrust' || action === 'unblock') {
      await channel.permissionOverwrites.delete(id, 'Permiso retirado en la sala temporal').catch(() => null);
      done.push(name);
    } else if (action === 'invite') {
      await channel.permissionOverwrites.edit(id, { ViewChannel: true, Connect: true }, { reason: 'Invitado a la sala temporal' });
      const sent = await member.send?.({ content: `📨 ${interaction.user} te invita a su sala de voz **${channel.name}** en **${guild.name}**: ${channel.url}`, allowedMentions: { parse: [] } }).catch(() => null);
      done.push(sent ? name : `${name} (tiene los mensajes privados cerrados, pero ya puede entrar)`);
    } else if (action === 'kick') {
      if (member.voice?.channelId === channel.id) {
        await member.voice.disconnect('Expulsado de la sala temporal');
        done.push(name);
      } else skipped.push(name);
    } else if (action === 'block') {
      await channel.permissionOverwrites.edit(id, { ViewChannel: false, Connect: false }, { reason: 'Bloqueado en la sala temporal' });
      if (member.voice?.channelId === channel.id) await member.voice.disconnect('Bloqueado en la sala temporal').catch(() => null);
      done.push(name);
    } else if (action === 'transfer') {
      if (member.user?.bot || member.voice?.channelId !== channel.id) { skipped.push(name); continue; }
      await transferOwnership(guild, channel, room, member, `Sala transferida por ${interaction.user.tag}`);
      done.push(name);
    }
  }
  const verbs = {
    trust: 'Ahora pueden entrar', untrust: 'Ya no tienen permiso especial', invite: 'Invitaste a',
    kick: 'Saqué de la sala a', block: 'Bloqueaste a', unblock: 'Desbloqueaste a', transfer: 'La sala ahora es de'
  };
  const lines = [];
  if (done.length) lines.push(`✅ ${verbs[action]}: ${done.join(', ')}.`);
  if (skipped.length) {
    lines.push(action === 'kick'
      ? `No estaban en la sala: ${skipped.join(', ')}.`
      : action === 'transfer'
        ? `${skipped.join(', ')} tiene que estar dentro de la sala (y no ser un bot).`
        : `Sin cambios para: ${skipped.join(', ')}.`);
  }
  return lines.join('\n') || 'No elegiste a nadie.';
}

function pickMenu(action) {
  const pick = PICKS[action];
  return new ActionRowBuilder().addComponents(new UserSelectMenuBuilder()
    .setCustomId(`tempvoice:pick:${action}`)
    .setPlaceholder(pick.placeholder)
    .setMinValues(1)
    .setMaxValues(pick.max));
}

function privacyMenu() {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId('tempvoice:privacy')
    .setPlaceholder('Elige cómo quieres la sala')
    .addOptions(
      { label: 'Cerrar', description: 'Nadie más entra, salvo a quien permitas', value: 'lock', emoji: '🔒' },
      { label: 'Abrir', description: 'Cualquiera puede entrar', value: 'unlock', emoji: '🔓' },
      { label: 'Ocultar', description: 'El resto del servidor no la ve', value: 'hide', emoji: '🙈' },
      { label: 'Mostrar', description: 'Se ve en la lista de canales', value: 'show', emoji: '👁️' }
    ));
}

function regionMenu(channel) {
  const current = channel.rtcRegion || 'auto';
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId('tempvoice:region')
    .setPlaceholder('Región del servidor de voz')
    .addOptions(REGIONS.map(([value, label, emoji]) => ({ value, label, emoji, default: value === current }))));
}

function textModal(action, channel) {
  const rename = action === 'rename';
  const input = new TextInputBuilder()
    .setCustomId(rename ? 'name' : 'limit')
    .setLabel(rename ? 'Nuevo nombre' : 'Límite de personas (0 = sin límite)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(rename ? 80 : 2)
    .setValue(rename ? channel.name : String(channel.userLimit || 0));
  return new ModalBuilder().setCustomId(`tempvoice:${action}:submit`).setTitle(rename ? 'Cambiar nombre de la sala' : 'Cambiar límite')
    .addComponents(new ActionRowBuilder().addComponents(input));
}

async function handleTempVoiceButton(interaction) {
  if (!String(interaction.customId || '').startsWith('tempvoice:')) return false;
  const action = interaction.customId.split(':')[1];
  try {
    if (action === 'claim') {
      const { room, channel } = await roomContext(interaction, { ownerOnly: false });
      if (room.ownerId === interaction.user.id) return ephemeral(interaction, 'Ya eres el dueño de esta sala.').then(() => true);
      if (channel.members.has(room.ownerId)) return ephemeral(interaction, `<@${room.ownerId}> sigue en la sala; solo se puede reclamar cuando el dueño se va.`).then(() => true);
      if (interaction.member?.voice?.channelId !== channel.id) return ephemeral(interaction, 'Entra a la sala para reclamarla.').then(() => true);
      await transferOwnership(interaction.guild, channel, room, interaction.member, `Sala reclamada por ${interaction.user.tag}`);
      await ephemeral(interaction, '👑 Ahora la sala es tuya.');
      return true;
    }
    if (action === 'info') {
      const { room, channel } = await roomContext(interaction, { ownerOnly: false });
      await ephemeral(interaction, infoText(channel, room));
      return true;
    }

    const { room, channel } = await roomContext(interaction);
    if (action === 'rename' || action === 'limit') {
      await interaction.showModal(textModal(action, channel));
      return true;
    }
    if (action === 'privacy') {
      await ephemeral(interaction, '🛡️ ¿Cómo quieres la sala?', { components: [privacyMenu()] });
      return true;
    }
    if (action === 'region') {
      await ephemeral(interaction, '🌐 Elige la región. Cambiarla puede cortar la voz un segundo.', { components: [regionMenu(channel)] });
      return true;
    }
    if (PICKS[action]) {
      await ephemeral(interaction, 'Elige a las personas:', { components: [pickMenu(action)] });
      return true;
    }
    if (action === 'chat') {
      const closed = !room.chatLocked;
      await ensureBotAccess(channel);
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: closed ? false : null }, { reason: 'Chat de la sala temporal' });
      await channel.permissionOverwrites.edit(room.ownerId, { SendMessages: true }, { reason: 'Chat de la sala temporal' }).catch(() => null);
      room.chatLocked = closed;
      await room.save();
      await refreshRoomControl(interaction.guild, channel, room);
      await ephemeral(interaction, closed ? '💬 Chat cerrado: solo tú puedes escribir en la sala.' : '💬 Chat abierto para todos los de la sala.');
      return true;
    }
    // Botones de las salas creadas antes de la interfaz nueva.
    if (['lock', 'unlock', 'hide', 'show'].includes(action)) {
      await ephemeral(interaction, await setPrivacy(interaction, channel, room, action));
      return true;
    }
    if (action === 'delete') {
      await interaction.reply({ content: '🗑️ Cerrando la sala…', flags: MessageFlags.Ephemeral });
      await TemporaryVoiceChannel.deleteOne({ channelId: channel.id });
      await channel.delete(`Sala temporal cerrada por ${interaction.user.tag}`);
      return true;
    }
  } catch (error) {
    await ephemeral(interaction, failureText(error)).catch(() => null);
  }
  return true;
}

// Los menús efímeros de Privacidad, Región y de elegir personas.
async function handleTempVoiceSelect(interaction) {
  const customId = String(interaction.customId || '');
  if (!customId.startsWith('tempvoice:')) return false;
  try {
    const { room, channel } = await roomContext(interaction);
    const [, kind, action] = customId.split(':');
    if (kind === 'privacy') {
      await settleMenu(interaction, await setPrivacy(interaction, channel, room, interaction.values[0]));
    } else if (kind === 'region') {
      const value = interaction.values[0];
      await channel.setRTCRegion(value === 'auto' ? null : value, `Región cambiada por ${interaction.user.tag}`);
      const label = REGIONS.find(([id]) => id === value)?.[1] || value;
      await settleMenu(interaction, `🌐 Región: **${label}**.`);
    } else if (kind === 'pick' && PICKS[action]) {
      await settleMenu(interaction, await applyPick(interaction, action, channel, room));
    }
  } catch (error) {
    await settleMenu(interaction, failureText(error)).catch(() => null);
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
      await ephemeral(interaction, `✏️ Sala renombrada a **${name}**. (Discord deja cambiar el nombre 2 veces cada 10 minutos.)`);
    } else if (action === 'limit') {
      const raw = interaction.fields.getTextInputValue('limit').trim();
      const limit = Number(raw);
      if (!Number.isInteger(limit) || limit < 0 || limit > 99) throw notice('El límite debe ser un número entero entre 0 y 99.');
      await channel.setUserLimit(limit, `Límite temporal cambiado por ${interaction.user.tag}`);
      await ephemeral(interaction, limit ? `👥 Límite ajustado a ${limit} personas.` : '👥 La sala quedó sin límite de personas.');
    }
  } catch (error) {
    await ephemeral(interaction, failureText(error)).catch(() => null);
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Interfaz fija                                                       */
/* ------------------------------------------------------------------ */

async function fetchInterfaceMessage(client, config) {
  const settings = config?.tempVoice || {};
  if (!settings.interfaceChannel || !settings.interfaceMessage) return null;
  const channel = client.channels?.cache?.get(settings.interfaceChannel)
    || await client.channels?.fetch?.(settings.interfaceChannel).catch(() => null);
  return channel?.messages ? channel.messages.fetch(settings.interfaceMessage).catch(() => null) : null;
}

async function publishInterface(client, guildId, channelId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Vesper no está en ese servidor.');
  const channel = await fetchChannel(guild, channelId);
  if (!channel?.isTextBased?.() || channel.isVoiceBased?.()) throw new Error('Elige un canal de texto.');
  const permissions = channel.permissionsFor(guild.members.me);
  if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
    throw new Error(`A Vesper le falta Ver canal o Enviar mensajes en ${channel.name}.`);
  }
  const config = await getGuildConfig(guildId);
  const previous = await fetchInterfaceMessage(client, config);
  const message = await sendBrandedMessage(channel, interfacePayload({ guild, config }), { interactive: true, throwOnFailure: true });
  if (!message?.id) throw new Error('Discord no confirmó el mensaje de la interfaz.');
  await updateGuildSection(guildId, 'tempVoice', { interfaceChannel: channel.id, interfaceMessage: message.id });
  if (previous && previous.id !== message.id) await deleteBrandedMessage(previous.channel, previous.id).catch(() => null);
  return { channelId: channel.id, messageId: message.id };
}

async function refreshInterface(client, guildId) {
  const config = await getGuildConfig(guildId);
  const message = await fetchInterfaceMessage(client, config);
  if (!message) return false;
  await editBrandedMessage(message.channel, message.id, interfacePayload({ guild: client.guilds.cache.get(guildId) || message.guild, config }));
  return true;
}

async function removeInterface(client, guildId) {
  const config = await getGuildConfig(guildId);
  const message = await fetchInterfaceMessage(client, config);
  if (message) await deleteBrandedMessage(message.channel, message.id).catch(() => null);
  await updateGuildSection(guildId, 'tempVoice', { interfaceChannel: null, interfaceMessage: null });
}

async function reconcileTemporaryVoiceChannels(client) {
  const records = await TemporaryVoiceChannel.find({});
  let removed = 0;
  for (const record of records) {
    const guild = client.guilds.cache.get(record.guildId);
    const channel = guild ? await fetchChannel(guild, record.channelId) : null;
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
  handleTempVoiceSelect,
  handleTempVoiceModal,
  reconcileTemporaryVoiceChannels,
  publishInterface,
  fetchInterfaceMessage,
  refreshInterface,
  removeInterface,
  interfacePayload,
  roomName,
  roomTemplate,
  defaultRoomTemplate,
  cleanChannelName,
  controlPayload,
  settleRoom,
  BUTTONS,
  REGIONS
};
