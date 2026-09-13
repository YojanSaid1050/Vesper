/* ============================================================
   Comprobación de superficie del bot
   ------------------------------------------------------------
   Ejecuta TODOS los comandos, eventos y manejadores con Discord
   y MongoDB simulados. No comprueba la lógica de negocio de cada
   uno: comprueba que ninguno se rompe (TypeError, ReferenceError,
   propiedad de undefined), que todos responden a la interacción y
   que sus definiciones cumplen los límites de Discord.

   Es la red de seguridad que faltaba: antes, un fallo de este tipo
   solo aparecía cuando un usuario ejecutaba el comando en producción.
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');

process.env.MAIN_GUILD_ID = '323456789012345678';
process.env.THEMED_MAIN_GUILD_IDS = '423456789012345678';
process.env.BOT_OWNER_IDS = '111111111111111111';
process.env.WEB_BASE_URL = 'https://vesper.example.com';
process.env.WEB_DASHBOARD_ENABLED = 'true';

/* ---------------------------------------------------------------- */
/* Base de datos simulada                                            */
/* ---------------------------------------------------------------- */

const { createDefaultGuildConfig } = require('../src/config/defaultGuild');

const GUILD_ID = '323456789012345678';

function sampleConfig() {
  const config = createDefaultGuildConfig(GUILD_ID);
  config.general = {
    welcomeChannel: '900000000000000001',
    goodbyeChannel: '900000000000000002',
    logChannel: '900000000000000003',
    botLogChannel: '900000000000000004',
    botRole: '800000000000000001'
  };
  config.dashboard = { channel: '900000000000000001', message: '950000000000000001', enabled: true, currentPanel: 'main', currentMode: 'default' };
  config.tiktok = { ...config.tiktok, liveChannel: '900000000000000001', users: ['ankerie'] };
  config.twitch = { ...config.twitch, liveChannel: '900000000000000001', users: ['yojan'] };
  config.youtube = { ...config.youtube, liveChannel: '900000000000000001', users: ['UC123'] };
  config.features = { ...config.features, music: true, moderation: true, tickets: true, suggestions: true, selfroles: true, starboard: true };
  return config;
}

// Se inyecta en la caché de módulos ANTES de cargar nada del bot, para que
// todos los require de mongoManager reciban esta versión sin red.
function stubModule(relativePath, exports) {
  const resolved = require.resolve(relativePath);
  require.cache[resolved] = new Module(resolved, null);
  require.cache[resolved].filename = resolved;
  require.cache[resolved].loaded = true;
  require.cache[resolved].exports = exports;
  return resolved;
}

const dbCalls = [];
const mongoStub = {
  connectMongo: async () => {},
  disconnectMongo: async () => {},
  getMongoStatus: () => ({ connected: true, readyState: 1 }),
  getGuildConfig: async () => sampleConfig(),
  getGeneralConfig: async () => sampleConfig().general,
  updateGuildConfig: async (guildId, updates) => { dbCalls.push(['updateGuildConfig', updates]); return sampleConfig(); },
  updateGuildSection: async (guildId, section, values) => { dbCalls.push(['updateGuildSection', section, values]); return sampleConfig(); },
  updateCommunitySection: async (guildId, subsection, values) => { dbCalls.push(['updateCommunitySection', subsection, values]); return sampleConfig(); },
  addGuildListItem: async () => sampleConfig(),
  removeGuildListItem: async () => sampleConfig(),
  getAllGuilds: async () => [],
  getAllGuildConfigs: async () => ({ [GUILD_ID]: sampleConfig() }),
  deleteGuild: async () => ({ deletedCount: 1 }),
  cleanDuplicateUsers: async () => 0,
  invalidateGuildConfig: () => {}
};
stubModule('../src/database/mongoManager', mongoStub);

// Modelos de Mongoose: cualquier consulta devuelve vacío.
function modelStub(name) {
  // Mongoose devuelve una Query encadenable, no una promesa suelta: el mock
  // tiene que comportarse igual o el código de producción parece roto cuando
  // en realidad lo roto es el banco de pruebas.
  const listChain = {
    sort: () => listChain, limit: () => listChain, skip: () => listChain,
    lean: () => listChain, select: () => listChain, then: resolve => resolve([])
  };
  const docChain = {
    sort: () => docChain, lean: () => docChain, select: () => docChain,
    populate: () => docChain, then: resolve => resolve(null)
  };
  const model = {
    modelName: name,
    find: () => listChain,
    findOne: () => docChain,
    findById: () => docChain,
    findOneAndUpdate: async () => null,
    create: async doc => ({ ...doc, _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', caseId: 'TESTID', save: async () => {} }),
    deleteOne: async () => ({ deletedCount: 1 }),
    deleteMany: async () => ({ deletedCount: 0 }),
    countDocuments: async () => 0,
    collection: { findOne: async () => null, updateOne: async () => ({}) },
    createCaseId: () => 'TESTID'
  };
  return model;
}
for (const name of ['ModerationCase', 'Suggestion', 'WebAuditLog', 'WebSession', 'WebIdentityLink', 'CommunityTicket', 'StarboardEntry', 'NotificationEvent', 'MonitorState', 'Guild']) {
  try { stubModule(`../src/database/models/${name}`, modelStub(name)); } catch { /* modelo opcional */ }
}

// Los monitores de plataforma se sustituyen: sin esto, /forcecheck lanzaba
// peticiones reales a YouTube y abría un navegador para TikTok, y la suite
// pasaba de segundos a minutos y dependía de la red.
const monitorStub = async () => ({ success: true, guilds: 0, channels: 0, videos: 0, lives: 0, shorts: 0, streams: 0, errors: 0 });
const statsStub = async () => ({
  guilds: { live: 0, videos: 0, shorts: 0 },
  entries: { live: 0, videos: 0, shorts: 0 },
  provider: { mode: 'browser', browser: { ready: false, installed: true, path: null }, requests: 0 },
  errors: []
});
const noop = async () => {};
stubModule('../src/platforms/youtube/monitors', {
  monitorLives: monitorStub, monitorVideos: monitorStub, monitorShorts: monitorStub,
  clearGuildCache: noop, cleanYouTubeChannelCache: noop, getMonitorStats: statsStub
});
stubModule('../src/platforms/twitch/monitors', {
  monitorStreams: monitorStub, clearGuildCache: noop, clearUserState: noop, getMonitorStats: statsStub
});
stubModule('../src/platforms/tiktok/monitors', {
  monitorLives: monitorStub, monitorVideos: monitorStub,
  clearGuildCache: noop, clearUserState: noop, getMonitorStats: statsStub
});
// Se conserva el módulo real de comprobaciones de TikTok (para que CONFIG y
// las estadísticas sean las de verdad) y solo se sustituye el cliente que
// arranca Chromium y sale a internet.
const tiktokFreeClient = require('../src/platforms/tiktok/freeClient');
stubModule('../src/platforms/tiktok/freeClient', {
  ...tiktokFreeClient,
  getFreeTikTokClient: () => ({
    stats: async () => ({ mode: 'browser', browser: { ready: false, installed: true, path: null }, requests: 0 }),
    fetchProfile: async () => ({ exists: true, username: 'prueba', live: false, videos: [] }),
    latestVideo: async () => null,
    isLive: async () => false
  }),
  stopFreeTikTokClient: () => {}
});

// La verificación de cuentas sale a las APIs de YouTube y Twitch. Se sustituye
// para que el banco sea determinista y no dependa de la red.
const youtubeUtils = require('../src/platforms/youtube/utils');
stubModule('../src/platforms/youtube/utils', {
  ...youtubeUtils,
  verifyChannel: async () => ({ exists: true, id: 'UC123', name: 'Canal de prueba' }),
  getChannelInfo: async () => ({ id: 'UC123', title: 'Canal de prueba' })
});
const twitchUtils = require('../src/platforms/twitch/utils');
stubModule('../src/platforms/twitch/utils', {
  ...twitchUtils,
  getAccessToken: async () => 'token-de-prueba',
  verifyStreamer: async () => ({ exists: true, login: 'yojan', name: 'Yojan' }),
  getStreamerInfo: async () => ({ id: '1', login: 'yojan', name: 'Yojan', avatar: 'https://cdn.example/s.png' })
});

// Los envíos a Discord no salen de aquí.
stubModule('../src/utils/webhookSender', {
  sendBrandedMessage: async () => ({ id: '960000000000000001' }),
  editBrandedMessage: async () => ({ id: '960000000000000001' }),
  clearWebhookCache: () => {}
});

/* ---------------------------------------------------------------- */
/* Discord simulado                                                  */
/* ---------------------------------------------------------------- */

const { PermissionFlagsBits } = require('discord.js');

function collection(items) {
  const map = new Map(items.map(item => [item.id, item]));
  map.some = predicate => [...map.values()].some(predicate);
  map.filter = predicate => collection([...map.values()].filter(predicate));
  map.map = fn => [...map.values()].map(fn);
  map.find = predicate => [...map.values()].find(predicate);
  map.first = () => [...map.values()][0];
  return map;
}

function mockChannel(id, name, overrides = {}) {
  return {
    id, name, guildId: GUILD_ID,
    type: 0,
    parent: null, parentId: null,
    isTextBased: () => true,
    isThread: () => false,
    permissionsFor: () => ({ has: () => true }),
    send: async payload => ({ id: '960000000000000001', payload, delete: async () => {}, edit: async () => {} }),
    messages: {
      fetch: async () => ({ id: '950000000000000001', edit: async () => {}, delete: async () => {} }),
      bulkDelete: async () => collection([])
    },
    bulkDelete: async () => collection([]),
    fetchWebhooks: async () => collection([]),
    createWebhook: async () => ({ id: 'w1', send: async () => ({ id: 'm1' }), editMessage: async () => ({ id: 'm1' }) }),
    ...overrides
  };
}

function mockRole(id, name, position = 1) {
  return { id, name, position, managed: false, hexColor: '#ffffff', editable: true, comparePositionTo: role => position - (role?.position || 0) };
}

function mockGuild() {
  const channels = collection([
    mockChannel('900000000000000001', 'bienvenidas'),
    mockChannel('900000000000000002', 'despedidas'),
    mockChannel('900000000000000003', 'registro'),
    mockChannel('900000000000000004', 'registro-bots')
  ]);
  const roles = collection([mockRole('800000000000000001', 'Bots', 2), mockRole('800000000000000002', 'Miembro', 1)]);
  const me = {
    id: '700000000000000001',
    nickname: null,
    displayName: 'Vesper',
    permissions: { has: () => true },
    roles: { highest: { position: 50 }, cache: collection([]) },
    setNickname: async () => {},
    voice: { channelId: null }
  };

  return {
    id: GUILD_ID,
    name: 'Embers Void',
    ownerId: '600000000000000001',
    memberCount: 1200,
    iconURL: () => 'https://cdn.example/guild.png',
    channels: { cache: channels, fetch: async id => channels.get(id) || null, create: async () => mockChannel('910000000000000001', 'ticket-0001') },
    roles: { cache: roles, fetch: async id => roles.get(id) || null, everyone: mockRole(GUILD_ID, '@everyone', 0) },
    members: {
      me,
      cache: collection([me]),
      fetch: async () => me,
      fetchMe: async () => me,
      search: async () => collection([])
    },
    shard: { send: () => {} },
    bans: { fetch: async () => collection([]) }
  };
}

function mockClient(guild) {
  return {
    user: { id: '700000000000000001', tag: 'Vesper#0001', username: 'Vesper', displayAvatarURL: () => 'https://cdn.example/bot.png', setAvatar: async () => {}, setUsername: async () => {} },
    guilds: { cache: collection([guild]), fetch: async () => guild },
    channels: { fetch: async id => guild.channels.cache.get(id) || null },
    commands: collection([]),
    uptime: 60_000,
    ws: { ping: 42, on: () => {} },
    isReady: () => true,
    music: { status: () => ({ configured: false, connected: false, players: 0 }), queue: () => null }
  };
}

// Discord garantiza un valor para las opciones `required`. El banco debe
// hacer lo mismo: si devolviera null estaría probando una situación que en
// producción no ocurre, y marcaría como fallo un código correcto.
const OPTION_TYPE = { STRING: 3, INTEGER: 4, BOOLEAN: 5, USER: 6, CHANNEL: 7, ROLE: 8, MENTIONABLE: 9, NUMBER: 10, ATTACHMENT: 11 };

function optionValuesFor(commandJson, subcommandName, guild) {
  const container = subcommandName
    ? (commandJson.options || []).find(option => option.type === 1 && option.name === subcommandName)
    : commandJson;
  const values = {};

  for (const option of container?.options || []) {
    if (option.type === OPTION_TYPE.STRING) {
      // Se respetan las restricciones declaradas para no fallar por longitud
      // o por un valor fuera de la lista de opciones.
      if (option.choices?.length) values[option.name] = option.choices[0].value;
      else {
        const min = option.min_length || 1;
        const base = /url|imagen|avatar/i.test(option.name) ? 'https://example.com/imagen.png'
          : /servidor|guild|id/i.test(option.name) ? '323456789012345678'
          : 'valor de prueba';
        values[option.name] = base.length >= min ? base : base.padEnd(min, 'x');
      }
    } else if (option.type === OPTION_TYPE.INTEGER || option.type === OPTION_TYPE.NUMBER) {
      values[option.name] = Math.max(option.min_value ?? 1, 1);
    } else if (option.type === OPTION_TYPE.BOOLEAN) {
      values[option.name] = true;
    }
  }
  return values;
}

function mockInteraction(commandName, { optionValues = {}, subcommand = null, guild = mockGuild(), client = null } = {}) {
  const resolvedClient = client || mockClient(guild);
  const record = { replies: [], deferred: false, replied: false, errors: [] };

  const respond = kind => async payload => {
    record.replies.push({ kind, payload });
    if (kind === 'reply' || kind === 'followUp') record.replied = true;
    return { id: '960000000000000001', edit: async () => {}, delete: async () => {}, createMessageComponentCollector: () => ({ on: () => {}, stop: () => {} }) };
  };

  const member = {
    id: '500000000000000001',
    user: { id: '500000000000000001', username: 'yojan', tag: 'yojan#0', bot: false, displayAvatarURL: () => 'https://cdn.example/u.png', send: async () => {} },
    displayName: 'Yojan',
    permissions: { has: () => true },
    roles: { cache: collection([]), highest: { position: 5, comparePositionTo: () => -1 }, add: async () => {}, remove: async () => {} },
    moderatable: true,
    manageable: true,
    communicationDisabledUntilTimestamp: null,
    timeout: async () => {},
    voice: { channel: null, channelId: null },
    toString() { return `<@${this.id}>`; }
  };

  return {
    record,
    id: '990000000000000001',
    commandName,
    customId: '',
    guild,
    guildId: guild.id,
    channel: guild.channels.cache.first(),
    channelId: '900000000000000001',
    client: resolvedClient,
    user: member.user,
    member,
    memberPermissions: { has: () => true },
    appPermissions: { has: () => true },
    locale: 'es-ES',
    deferred: false,
    replied: false,
    inGuild: () => true,
    isChatInputCommand: () => true,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isChannelSelectMenu: () => false,
    isRoleSelectMenu: () => false,
    isModalSubmit: () => false,
    isRepliable: () => true,
    options: {
      getSubcommand: () => subcommand,
      getSubcommandGroup: () => null,
      getString: name => (name in optionValues ? optionValues[name] : null),
      getInteger: name => optionValues[name] ?? null,
      getNumber: name => optionValues[name] ?? null,
      getBoolean: name => optionValues[name] ?? null,
      getUser: name => optionValues[name] ?? member.user,
      getMember: () => member,
      getChannel: name => optionValues[name] ?? guild.channels.cache.first(),
      getRole: name => optionValues[name] ?? guild.roles.cache.first(),
      getAttachment: () => null
    },
    reply: async payload => { record.replied = true; return respond('reply')(payload); },
    editReply: respond('editReply'),
    followUp: respond('followUp'),
    deferReply: async payload => { record.deferred = true; return respond('deferReply')(payload); },
    deferUpdate: async () => { record.deferred = true; return respond('deferUpdate')({}); },
    update: respond('update'),
    showModal: respond('showModal'),
    deleteReply: async () => {},
    fetchReply: async () => ({ id: '960000000000000001', createMessageComponentCollector: () => ({ on: () => {}, stop: () => {} }) })
  };
}

/* ---------------------------------------------------------------- */
/* Descubrimiento de archivos                                        */
/* ---------------------------------------------------------------- */

function walk(directory) {
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const commandFiles = walk(path.join(__dirname, '..', 'src', 'commands'));
const eventFiles = walk(path.join(__dirname, '..', 'src', 'events'));

// Errores que indican un bug de programación, no una validación de negocio.
const PROGRAMMING_ERRORS = ['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError'];

function isProgrammingError(error) {
  if (!error) return false;
  if (PROGRAMMING_ERRORS.includes(error.name)) return true;
  return /is not a function|of undefined|of null|is not defined|Cannot read/i.test(String(error.message));
}

/* ---------------------------------------------------------------- */
/* Pruebas                                                           */
/* ---------------------------------------------------------------- */

test('todos los comandos se cargan y declaran una forma válida', () => {
  assert.ok(commandFiles.length >= 40, `se esperaban al menos 40 comandos, hay ${commandFiles.length}`);
  const names = new Map();

  for (const file of commandFiles) {
    const relative = path.relative(path.join(__dirname, '..'), file);
    let command;
    assert.doesNotThrow(() => { command = require(file); }, `no se pudo cargar ${relative}`);

    assert.ok(command.data, `${relative} no exporta data`);
    assert.equal(typeof command.execute, 'function', `${relative} no exporta execute`);

    const json = command.data.toJSON();
    assert.match(json.name, /^[\w-]{1,32}$/, `${relative}: nombre de comando inválido`);
    assert.ok(json.description && json.description.length <= 100, `${relative}: descripción vacía o de más de 100 caracteres`);
    assert.ok((json.options || []).length <= 25, `${relative}: más de 25 opciones`);

    for (const option of json.options || []) {
      assert.ok(option.description && option.description.length <= 100,
        `${relative}: la opción ${option.name} tiene una descripción inválida`);
    }

    // Discord rechaza el despliegue entero si hay nombres duplicados.
    assert.equal(names.has(json.name), false, `nombre de comando duplicado: ${json.name} (${relative} y ${names.get(json.name)})`);
    names.set(json.name, relative);
  }
});

test('todos los eventos declaran nombre y ejecutor', () => {
  for (const file of eventFiles) {
    const relative = path.relative(path.join(__dirname, '..'), file);
    const event = require(file);
    assert.ok(event.name, `${relative} no declara name`);
    assert.equal(typeof event.execute, 'function', `${relative} no exporta execute`);
  }
});

test('ningún comando se rompe al ejecutarse ni deja la interacción sin respuesta', async () => {
  const problems = [];

  for (const file of commandFiles) {
    const relative = path.relative(path.join(__dirname, '..'), file);
    const command = require(file);
    const json = command.data.toJSON();

    // Los comandos con subcomandos se prueban uno por uno.
    const subcommands = (json.options || []).filter(option => option.type === 1).map(option => option.name);
    const variants = subcommands.length ? subcommands : [null];

    for (const subcommand of variants) {
      const guild = mockGuild();
      const interaction = mockInteraction(json.name, {
        subcommand,
        guild,
        optionValues: optionValuesFor(json, subcommand, guild)
      });

      try {
        await command.execute(interaction, interaction.client);
      } catch (error) {
        if (isProgrammingError(error)) {
          problems.push(`${relative}${subcommand ? ` (${subcommand})` : ''}: ${error.name}: ${error.message}`);
          continue;
        }
        // Un error de negocio controlado es aceptable en este banco de pruebas.
        continue;
      }

      const answered = interaction.record.replies.length > 0 || interaction.record.deferred;
      if (!answered) {
        problems.push(`${relative}${subcommand ? ` (${subcommand})` : ''}: terminó sin responder a la interacción`);
      }
    }
  }

  assert.deepEqual(problems, [], `Comandos con problemas:\n${problems.join('\n')}`);
});

test('los manejadores de botones, menús y modales resisten identificadores desconocidos', async () => {
  const { handleButton } = require('../src/handlers/buttons');
  const { handleSelect } = require('../src/handlers/selects');
  const { handleModal } = require('../src/handlers/modals');

  const cases = [
    ['botón', handleButton, { isButton: () => true }],
    ['menú', handleSelect, { isStringSelectMenu: () => true, values: ['800000000000000002'] }],
    ['modal', handleModal, { isModalSubmit: () => true, fields: { getTextInputValue: () => 'valor' } }]
  ];

  // Identificadores que no existen, y además nombres de propiedades del
  // prototipo de Object: antes, un customId como "constructor" pasaba por
  // truthy en las búsquedas por mapa y se tragaba la interacción.
  const ids = ['identificador_inexistente', 'constructor', 'toString', '__proto__', 'hasOwnProperty', ''];

  for (const [label, handler, extra] of cases) {
    for (const customId of ids) {
      const interaction = { ...mockInteraction('x'), ...extra, customId, isChatInputCommand: () => false };
      try {
        await handler(interaction, interaction.client);
      } catch (error) {
        assert.equal(isProgrammingError(error), false,
          `El manejador de ${label} se rompió con customId "${customId}": ${error.name}: ${error.message}`);
      }
    }
  }
});

test('el enrutador de interacciones no se rompe con entradas inesperadas', async () => {
  const interactionCreate = require('../src/events/interactionCreate');
  const guild = mockGuild();
  const client = mockClient(guild);
  client.commands = collection([]);

  const variants = [
    { label: 'comando inexistente', patch: { commandName: 'no-existe' } },
    { label: 'customId prototipo', patch: { isChatInputCommand: () => false, isButton: () => true, customId: 'constructor' } },
    { label: 'sin customId', patch: { isChatInputCommand: () => false, isButton: () => true, customId: undefined } },
    { label: 'tipo desconocido', patch: { isChatInputCommand: () => false, isButton: () => false } }
  ];

  for (const variant of variants) {
    const interaction = { ...mockInteraction('x', { guild, client }), ...variant.patch };
    await assert.doesNotReject(
      () => interactionCreate.execute(interaction, client),
      `interactionCreate falló con ${variant.label}`
    );
  }
});

test('la política de eventos enruta sin romperse en cualquier tipo de servidor', async () => {
  const { executeEventWithPolicy } = require('../src/core/EventPolicy');
  const { Events } = require('discord.js');

  const guild = mockGuild();
  const client = mockClient(guild);
  const member = {
    id: '500000000000000001',
    user: { id: '500000000000000001', username: 'ana', tag: 'ana#0', bot: false, displayAvatarURL: () => 'https://cdn.example/u.png' },
    guild,
    guildId: guild.id,
    roles: { cache: collection([]), add: async () => {} },
    toString() { return `<@${this.id}>`; }
  };

  const events = [
    [Events.GuildMemberAdd, member],
    [Events.GuildMemberRemove, member],
    [Events.MessageCreate, { guild, guildId: guild.id, author: { bot: false, id: '5' }, content: 'hola', member, channelId: '900000000000000001', channel: guild.channels.cache.first(), mentions: { users: collection([]), roles: collection([]) }, delete: async () => {} }]
  ];

  for (const [name, subject] of events) {
    const event = { name, execute: async () => {} };
    await assert.doesNotReject(
      () => executeEventWithPolicy(event, [subject], client),
      `executeEventWithPolicy falló en ${String(name)}`
    );
  }

  // Un evento de un servidor no aprobado debe ignorarse sin tocar nada.
  let ran = false;
  await executeEventWithPolicy(
    { name: Events.MessageCreate, execute: async () => { ran = true; } },
    [{ guildId: '111000000000000000' }],
    client
  );
  assert.equal(ran, false, 'un servidor no aprobado no debe ejecutar eventos');
});

test('el catálogo de comandos encaja con los límites de registro de Discord', () => {
  const { commandVisible } = require('../src/core/CommandVisibilityService');
  const { commandAvailable } = require('../src/config/guildPolicy');

  const commands = commandFiles.map(file => require(file));
  const globals = commands.filter(command => command.scope !== 'main' && commandVisible(command));
  const mains = commands.filter(command => command.scope === 'main' && commandVisible(command));

  assert.ok(globals.length <= 100, 'Discord no admite más de 100 comandos globales');
  assert.ok(mains.length <= 100, 'Discord no admite más de 100 comandos por servidor');

  // Los comandos de Main tienen que estar disponibles en los dos Main.
  for (const command of mains) {
    assert.equal(commandAvailable(command, process.env.MAIN_GUILD_ID), true,
      `${command.data.name} no está disponible en el Main principal`);
    assert.equal(commandAvailable(command, '423456789012345678'), true,
      `${command.data.name} no está disponible en el Main temático`);
  }

  // Y ninguno debe llegar a un servidor no aprobado.
  for (const command of commands) {
    assert.equal(commandAvailable(command, '111000000000000000'), false,
      `${command.data.name} se ofrecería en un servidor no aprobado`);
  }
});
