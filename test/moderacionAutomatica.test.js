// La moderación automática de punta a punta: el mensaje entra por el mismo
// camino que en Discord (EventPolicy → ModerationService) y se comprueba qué
// le pasa: se borra, se abre un caso, se avisa en el canal y por privado.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Events, PermissionFlagsBits } = require('discord.js');

const MAIN = '1506580021232406540';
const THEMED = '1124871897688055818';
process.env.MAIN_GUILD_ID = MAIN;
process.env.THEMED_MAIN_GUILD_IDS = THEMED;

const configs = new Map();
const mongoPath = require.resolve('../src/database/mongoManager');
require.cache[mongoPath] = {
  id: mongoPath, filename: mongoPath, loaded: true,
  exports: { getGuildConfig: async guildId => configs.get(guildId), updateGuildSection: async () => null }
};

const ModerationCase = require('../src/database/models/ModerationCase');
const { executeEventWithPolicy } = require('../src/core/EventPolicy');

const BASE_MODERATION = { filterLinks: true, allowedDomains: ['youtube.com'], exemptChannels: [], exemptRoles: [], blockInvites: true, maxMentions: 3, repeatLimit: 3, action: 'warn' };

function setConfig(guildId, moderation = {}, extra = {}) {
  configs.set(guildId, { guildId, features: { moderation: true, music: true }, moderation: { ...BASE_MODERATION, ...moderation }, ...extra });
}

let counter = 0;
function message(guildId, content, { canManage = false, channelId = '900000000000000001', mentions = 0, authorId = '700000000000000002' } = {}) {
  const log = { deleted: false, sent: [], dms: [], timeouts: [] };
  const author = { id: authorId, bot: false, username: 'xyojansaidx', send: async payload => { log.dms.push(payload.content); } };
  const guild = { id: guildId, name: guildId === MAIN ? '𝐸𝑚𝑏𝑒𝑟𝑠 𝑉𝑜𝑖𝑑𝑠' : 'Ankerie Dimension', memberCount: 100 };
  const member = {
    user: author, guild, displayName: 'Yojan', moderatable: true, toString: () => `<@${authorId}>`,
    permissions: { has: flag => canManage && flag === PermissionFlagsBits.ManageMessages },
    roles: { cache: { some: () => false } },
    timeout: async (ms, reason) => { log.timeouts.push([ms, reason]); }
  };
  const users = new Map(Array.from({ length: mentions }, (_, i) => [String(i), {}]));
  return {
    log,
    msg: {
      id: `m${++counter}`, guild, guildId, channelId, content, author, member,
      client: { user: { id: '1507223570860867725' } },
      channel: { id: channelId, parentId: null, send: async payload => { log.sent.push(payload); return { delete: async () => null }; } },
      mentions: { users, roles: new Map() },
      delete: async () => { log.deleted = true; }
    }
  };
}

const run = msg => executeEventWithPolicy({ name: Events.MessageCreate, execute: async () => null }, [msg], { music: null });

function captureCases(t) {
  const cases = [];
  t.mock.method(ModerationCase, 'create', async data => { cases.push(data); return { ...data, caseId: 'K7P2QX' }; });
  return cases;
}

test('una invitación de Discord se borra, abre un caso y avisa en el canal y por privado', async t => {
  setConfig(MAIN);
  const cases = captureCases(t);
  const { msg, log } = message(MAIN, 'únanse a discord.gg/abcdef');
  await run(msg);
  assert.equal(log.deleted, true);
  assert.equal(cases[0].action, 'warning');
  assert.match(cases[0].reason, /invitaciones/);
  assert.equal(cases[0].evidence, 'únanse a discord.gg/abcdef');
  assert.equal(log.sent.length, 1);
  assert.match(log.sent[0].content, /<@700000000000000002>/);
  assert.match(log.sent[0].content, /#K7P2QX/);
  assert.deepEqual(log.sent[0].allowedMentions.users, ['700000000000000002'], 'solo menciona al autor');
  assert.match(log.dms[0], /K7P2QX/);
  assert.doesNotMatch(log.sent[0].content + log.dms[0], /\{\w+\}|undefined/);
});

test('un enlace a un dominio no permitido se retira; uno permitido, no', async t => {
  setConfig(THEMED);
  const cases = captureCases(t);
  const blocked = message(THEMED, 'miren https://sitio-raro.xyz/promo');
  await run(blocked.msg);
  assert.equal(blocked.log.deleted, true);
  assert.match(cases[0].reason, /sitio-raro\.xyz/);

  const allowed = message(THEMED, 'esta canción https://music.youtube.com/watch?v=x');
  await run(allowed.msg);
  assert.equal(allowed.log.deleted, false, 'los subdominios de un dominio permitido pasan');
});

test('demasiadas menciones y el mismo mensaje repetido también se filtran', async t => {
  setConfig(THEMED);
  const cases = captureCases(t);
  const mentions = message(THEMED, 'hola a todos', { mentions: 4 });
  await run(mentions.msg);
  assert.equal(mentions.log.deleted, true);
  assert.match(cases.at(-1).reason, /menciones/);

  const sent = [];
  for (let i = 0; i < 3; i++) {
    const repeated = message(THEMED, 'compren mi curso', { authorId: '700000000000000009' });
    await run(repeated.msg);
    sent.push(repeated.log.deleted);
  }
  assert.deepEqual(sent, [false, false, true], 'se corta al llegar al límite');
  assert.match(cases.at(-1).reason, /repetido/);
});

test('con «aislar» se aplica un aislamiento de 5 minutos', async t => {
  setConfig(MAIN, { action: 'timeout' });
  const cases = captureCases(t);
  const { msg, log } = message(MAIN, 'discord.gg/spam');
  await run(msg);
  assert.equal(log.timeouts[0][0], 5 * 60 * 1000);
  assert.equal(cases[0].action, 'timeout');
  assert.ok(cases[0].expiresAt instanceof Date);
});

test('no se toca a quien modera, ni un canal exento, ni con el módulo apagado', async t => {
  const cases = captureCases(t);
  setConfig(MAIN);
  const moderator = message(MAIN, 'discord.gg/abc', { canManage: true });
  await run(moderator.msg);
  assert.equal(moderator.log.deleted, false);

  setConfig(MAIN, { exemptChannels: ['900000000000000005'] });
  const exempt = message(MAIN, 'discord.gg/abc', { channelId: '900000000000000005' });
  await run(exempt.msg);
  assert.equal(exempt.log.deleted, false);

  configs.set(MAIN, { guildId: MAIN, features: { moderation: false }, moderation: BASE_MODERATION });
  const off = message(MAIN, 'discord.gg/abc');
  await run(off.msg);
  assert.equal(off.log.deleted, false);
  assert.equal(cases.length, 0);
});

test('en el canal del controlador de música los enlaces de canciones pasan; las invitaciones, no', async t => {
  setConfig(THEMED, {}, { music: { controllerChannel: '900000000000000007' } });
  captureCases(t);
  const song = message(THEMED, 'https://soundcloud.com/joji/sditd', { channelId: '900000000000000007' });
  await run(song.msg);
  assert.equal(song.log.sent.some(payload => /retir|limón|caso/i.test(payload.content || '')), false, 'no hay aviso de moderación');
  const invite = message(THEMED, 'discord.gg/abc', { channelId: '900000000000000007' });
  await run(invite.msg);
  assert.equal(invite.log.deleted, true);
});
