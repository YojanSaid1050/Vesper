// Los 15 botones de la interfaz de salas, pulsados sobre una sala simulada:
// cada uno tiene que cambiar lo que dice y responder sin errores.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ChannelType } = require('discord.js');

const mongoPath = require.resolve('../src/database/mongoManager');
require.cache[mongoPath] = {
  id: mongoPath, filename: mongoPath, loaded: true,
  exports: { getGuildConfig: async guildId => ({ guildId, tempVoice: {} }), updateGuildSection: async () => null }
};

const TemporaryVoiceChannel = require('../src/database/models/TemporaryVoiceChannel');
const { handleTempVoiceButton, handleTempVoiceSelect, BUTTONS } = require('../src/core/TempVoiceService');

const OWNER = '100000000000000001';
const GUEST = '100000000000000002';
const STRANGER = '100000000000000003';
const ROOM = '900000000000000001';
const INTERFACE_CHANNEL = '900000000000000050';

function collection(entries) {
  const map = new Map(entries);
  map.filter = predicate => collection([...map].filter(([, value]) => predicate(value)));
  map.first = () => map.values().next().value;
  return map;
}

function setup(t, { ownerInside = true } = {}) {
  const log = { overwrites: [], deleted: [], disconnected: [], region: undefined, dms: [], removedChannel: false };
  const member = (id, inside) => ({
    id, user: { id, bot: false, username: `u${id.slice(-1)}`, tag: `u${id.slice(-1)}` },
    voice: { channelId: inside ? ROOM : null, disconnect: async () => { log.disconnected.push(id); } },
    send: async payload => { log.dms.push([id, payload.content]); return {}; }
  });
  const members = new Map([[OWNER, member(OWNER, ownerInside)], [GUEST, member(GUEST, true)], [STRANGER, member(STRANGER, false)]]);
  const inRoom = [...members.values()].filter(item => item.voice.channelId === ROOM).map(item => [item.id, item]);
  const guild = {
    id: '1506580021232406540', name: 'Embers Void',
    roles: { everyone: { id: 'everyone' } },
    members: { me: { id: 'bot' }, cache: members, fetch: async id => members.get(id) }
  };
  const channel = {
    id: ROOM, type: ChannelType.GuildVoice, name: 'Sala de xyojansaidx', userLimit: 0, bitrate: 64000, rtcRegion: null,
    url: `https://discord.com/channels/x/${ROOM}`, guild,
    members: collection(inRoom),
    permissionOverwrites: {
      edit: async (target, perms) => { log.overwrites.push([target.id || target, perms]); },
      delete: async target => { log.deleted.push(target); }
    },
    setRTCRegion: async region => { log.region = region; },
    delete: async () => { log.removedChannel = true; },
    messages: { fetch: async () => null }
  };
  guild.channels = { cache: new Map([[ROOM, channel]]), fetch: async () => null };
  const room = { channelId: ROOM, ownerId: OWNER, locked: false, hidden: false, chatLocked: false, controlMessageId: null, saves: 0 };
  room.save = async () => { room.saves++; };
  t.mock.method(TemporaryVoiceChannel, 'findOne', async ({ channelId }) => (channelId === ROOM ? room : null));
  t.mock.method(TemporaryVoiceChannel, 'deleteOne', async () => ({ deletedCount: 1 }));
  return { guild, channel, room, log, members };
}

// Una interacción pulsada desde la interfaz fija (otro canal de texto).
function press(guild, members, userId, customId, extra = {}) {
  const replies = [];
  const interaction = {
    customId, guild, guildId: guild.id, channelId: INTERFACE_CHANNEL,
    user: members.get(userId).user, member: members.get(userId),
    memberPermissions: { has: () => false },
    deferred: false, replied: false,
    isMessageComponent: () => true,
    reply: async payload => { interaction.replied = true; replies.push(payload); },
    followUp: async payload => { replies.push(payload); },
    update: async payload => { interaction.replied = true; replies.push(payload); },
    showModal: async modal => { replies.push({ modal: modal.toJSON() }); },
    ...extra
  };
  return { interaction, replies };
}

const text = payload => String(payload?.content || '');

test('los 15 botones responden desde la interfaz fija sin errores', async t => {
  for (const [action] of BUTTONS.flat()) {
    if (action === 'delete') continue;
    const { guild, members } = setup(t);
    const { interaction, replies } = press(guild, members, OWNER, `tempvoice:${action}`);
    await handleTempVoiceButton(interaction);
    assert.equal(replies.length, 1, `${action} responde una vez`);
    assert.doesNotMatch(text(replies[0]), /No pude/, `${action}: ${text(replies[0])}`);
  }
});

test('nombre y límite abren su formulario; privacidad, región y personas, su menú', async t => {
  const { guild, members } = setup(t);
  const open = async action => {
    const { interaction, replies } = press(guild, members, OWNER, `tempvoice:${action}`);
    await handleTempVoiceButton(interaction);
    return replies[0];
  };
  assert.equal((await open('rename')).modal.custom_id, 'tempvoice:rename:submit');
  assert.equal((await open('limit')).modal.custom_id, 'tempvoice:limit:submit');
  assert.equal((await open('privacy')).components[0].toJSON().components[0].custom_id, 'tempvoice:privacy');
  assert.equal((await open('region')).components[0].toJSON().components[0].custom_id, 'tempvoice:region');
  assert.equal((await open('kick')).components[0].toJSON().components[0].type, 5, 'menú de usuarios');
});

test('privacidad: cerrar la sala quita Conectar a @everyone', async t => {
  const { guild, members, room, log } = setup(t);
  const { interaction, replies } = press(guild, members, OWNER, 'tempvoice:privacy', { values: ['lock'] });
  await handleTempVoiceSelect(interaction);
  assert.equal(room.locked, true);
  assert.deepEqual(log.overwrites.find(([target]) => target === 'everyone')[1], { Connect: false });
  assert.match(text(replies[0]), /cerrada/);
});

test('permitir, expulsar, bloquear e invitar actúan sobre las personas elegidas', async t => {
  const { guild, members, log } = setup(t);
  const pick = async (action, ids) => {
    const { interaction, replies } = press(guild, members, OWNER, `tempvoice:pick:${action}`, { values: ids });
    await handleTempVoiceSelect(interaction);
    return text(replies[0]);
  };
  assert.match(await pick('trust', [STRANGER]), /Ahora pueden entrar/);
  assert.deepEqual(log.overwrites.at(-1), [STRANGER, { ViewChannel: true, Connect: true }]);
  assert.match(await pick('kick', [GUEST, STRANGER]), /Saqué de la sala.*No estaban/s);
  assert.deepEqual(log.disconnected, [GUEST]);
  assert.match(await pick('block', [GUEST]), /Bloqueaste/);
  assert.deepEqual(log.overwrites.at(-1), [GUEST, { ViewChannel: false, Connect: false }]);
  assert.match(await pick('invite', [STRANGER]), /Invitaste/);
  assert.match(log.dms.at(-1)[1], /te invita a su sala de voz/);
  assert.match(await pick('block', [OWNER]), /Sin cambios/, 'el dueño no se bloquea a sí mismo');
});

test('transferir pasa la sala a alguien de dentro; a alguien de fuera, no', async t => {
  const { guild, members, room } = setup(t);
  const transfer = async id => {
    const { interaction, replies } = press(guild, members, OWNER, 'tempvoice:pick:transfer', { values: [id] });
    await handleTempVoiceSelect(interaction);
    return text(replies[0]);
  };
  assert.match(await transfer(STRANGER), /tiene que estar dentro/);
  assert.equal(room.ownerId, OWNER);
  assert.match(await transfer(GUEST), /ahora es de/);
  assert.equal(room.ownerId, GUEST);
});

test('reclamar solo funciona cuando el dueño se fue', async t => {
  const conDueño = setup(t);
  let pressed = press(conDueño.guild, conDueño.members, GUEST, 'tempvoice:claim');
  await handleTempVoiceButton(pressed.interaction);
  assert.match(text(pressed.replies[0]), /sigue en la sala/);

  const sinDueño = setup(t, { ownerInside: false });
  pressed = press(sinDueño.guild, sinDueño.members, GUEST, 'tempvoice:claim');
  await handleTempVoiceButton(pressed.interaction);
  assert.equal(sinDueño.room.ownerId, GUEST);
  assert.match(text(pressed.replies[0]), /es tuya/);
});

test('quien no es el dueño no puede cambiar la sala', async t => {
  const { guild, members, log } = setup(t);
  const { interaction, replies } = press(guild, members, GUEST, 'tempvoice:chat');
  await handleTempVoiceButton(interaction);
  assert.match(text(replies[0]), /Solo el dueño/);
  assert.equal(log.overwrites.length, 0);
});

test('región automática y chat cerrado', async t => {
  const { guild, members, room, log } = setup(t);
  let pressed = press(guild, members, OWNER, 'tempvoice:region', { values: ['auto'] });
  await handleTempVoiceSelect(pressed.interaction);
  assert.equal(log.region, null);
  assert.match(text(pressed.replies[0]), /Automática/);

  pressed = press(guild, members, OWNER, 'tempvoice:chat');
  await handleTempVoiceButton(pressed.interaction);
  assert.equal(room.chatLocked, true);
  assert.deepEqual(log.overwrites.find(([target]) => target === 'everyone')[1], { SendMessages: false });
});

test('sin sala propia, la interfaz explica qué hacer', async t => {
  const { guild, members } = setup(t);
  const { interaction, replies } = press(guild, members, STRANGER, 'tempvoice:info');
  await handleTempVoiceButton(interaction);
  assert.match(text(replies[0]), /Entra a tu sala temporal/);
});
