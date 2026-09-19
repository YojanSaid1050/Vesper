// Comprobación de que los avisos salen completos.
//
// El catálogo es quien escribe el texto y los eventos solo aportan variables.
// Si alguien añade un dato al catálogo y olvida rellenarlo en el evento, el
// miembro ve «{reason}» en el canal de registro. Aquí se ejecuta cada evento
// con datos falsos y se falla si sobrevive un solo hueco sin rellenar.

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MAIN_GUILD_ID = process.env.MAIN_GUILD_ID || '1506580021232406540';
process.env.THEMED_MAIN_GUILD_IDS = process.env.THEMED_MAIN_GUILD_IDS || '1124871897688055818';

const { KINDS, factoryDefaults, kindInfo, buildMessage, memberVars } = require('../src/core/EmbedCatalog');

const HUECO = /\{(\w+)\}/g;

function huecosDe(texto) {
  return [...String(texto || '').matchAll(HUECO)].map(m => m[1]);
}

function textoDe(payload) {
  const partes = [];
  for (const embed of payload.embeds || []) {
    partes.push(embed.title || '', embed.description || '');
    for (const campo of embed.fields || []) partes.push(campo.name, campo.value);
    partes.push(embed.footer?.text || '');
  }
  if (payload.content) partes.push(payload.content);
  for (const componente of payload.components || []) {
    const pila = [componente];
    while (pila.length) {
      const actual = pila.pop();
      if (actual?.content) partes.push(actual.content);
      if (Array.isArray(actual?.components)) pila.push(...actual.components);
    }
  }
  return partes.join('\n');
}

// Las variables que cada evento pone sobre la mesa, copiadas de lo que llama
// a `publishAlert`. Si aquí falta una, el aviso sale con el hueco a la vista.
const MIEMBRO = {
  user: '<@111111111111111111>', username: 'yojan', userTag: 'yojan',
  displayName: 'Yojan', userId: '111111111111111111',
  server: 'Ankerie Dimension', memberCount: 128
};

const APORTA = {
  welcome: MIEMBRO,
  goodbye: MIEMBRO,
  boost_started: { ...MIEMBRO, boostCount: 14, boostLevel: 3 },
  boost_stopped: { ...MIEMBRO, boostCount: 13, boostLevel: 2 },
  boost_level: { server: 'Ankerie Dimension', memberCount: 128, boostLevel: 3, previousLevel: 2, boostCount: 14 },
  log_member_join: MIEMBRO,
  log_member_leave: MIEMBRO,
  log_bot_join: { ...MIEMBRO, role: '<@&222>', roleName: 'Bots' },
  log_bot_leave: MIEMBRO,
  log_nickname: { ...MIEMBRO, before: 'Yojan', after: 'Yo' },
  log_roles_added: { ...MIEMBRO, roles: '@Miembro' },
  log_roles_removed: { ...MIEMBRO, roles: '@Miembro' },
  log_timeout_on: { ...MIEMBRO, executor: 'Moderador', until: 'mañana', reason: 'spam' },
  log_timeout_off: { ...MIEMBRO, executor: 'Moderador' },
  log_ban_added: { ...MIEMBRO, executor: 'Moderador', reason: 'spam' },
  log_ban_removed: { ...MIEMBRO, executor: 'Moderador' },
  automod_notice: { ...MIEMBRO, reason: 'enlace', case: 'A1B2' },
  automod_dm: { ...MIEMBRO, reason: 'enlace', case: 'A1B2' },
  log_message_deleted: { ...MIEMBRO, executor: 'Moderador', channel: '<#333>', channelName: 'general', content: 'hola' },
  log_message_edited: { ...MIEMBRO, channel: '<#333>', channelName: 'general', before: 'hola', after: 'adiós' },
  log_messages_purged: { server: 'Ankerie Dimension', memberCount: 128, channel: '<#333>', channelName: 'general', count: 25 },
  log_channel_created: { server: 'Ankerie Dimension', memberCount: 128, channel: '<#333>', channelName: 'general', type: 'Texto', executor: 'Yojan' },
  log_channel_deleted: { server: 'Ankerie Dimension', memberCount: 128, channel: 'general', channelName: 'general', type: 'Texto', executor: 'Yojan' },
  log_role_created: { server: 'Ankerie Dimension', memberCount: 128, role: '<@&222>', roleName: 'Miembro', roleId: '222', executor: 'Yojan' },
  log_role_deleted: { server: 'Ankerie Dimension', memberCount: 128, role: 'Miembro', roleName: 'Miembro', roleId: '222', executor: 'Yojan' },
  log_thread_created: { server: 'Ankerie Dimension', memberCount: 128, channel: '<#333>', channelName: 'general', thread: '<#444>', owner: 'Yojan' },
  log_voice_join: { ...MIEMBRO, channel: '<#555>', channelName: 'voz-1' },
  log_voice_leave: { ...MIEMBRO, channel: '<#555>', channelName: 'voz-1' },
  log_voice_move: { ...MIEMBRO, from: '<#555>', to: '<#556>' },
  notify_twitch_live: { creator: 'yojan', title: 'Directo', url: 'https://twitch.tv/yojan', server: 'Ankerie Dimension', game: 'Just Chatting', viewers: 128 },
  notify_youtube_live: { creator: 'yojan', title: 'Directo', url: 'https://youtu.be/x', server: 'Ankerie Dimension', viewers: 128 },
  notify_youtube_video: { creator: 'yojan', title: 'Vídeo', url: 'https://youtu.be/x', server: 'Ankerie Dimension', views: 4320 },
  notify_youtube_short: { creator: 'yojan', title: 'Short', url: 'https://youtu.be/x', server: 'Ankerie Dimension', views: 4320 },
  notify_tiktok_live: { creator: 'yojan', title: 'Directo', url: 'https://tiktok.com/@y', server: 'Ankerie Dimension', viewers: 128 },
  notify_tiktok_video: { creator: 'yojan', title: 'Vídeo', url: 'https://tiktok.com/@y', server: 'Ankerie Dimension', views: 4320 },
  deal_epic_free: { title: 'Un juego', url: 'https://store.epicgames.com', store: 'Epic', endsAt: 'el 30 de enero', originalPrice: '19,99 €' },
  deal_steam_special: { title: 'Un juego', url: 'https://store.steampowered.com', discount: 75, price: '4,99 €', originalPrice: '19,99 €', endsAt: 'el 30 de enero' },
  deal_giveaway: { title: 'Una llave', url: 'https://ejemplo.com', worth: '14,99 €', platforms: 'PC', endsAt: 'el 30 de enero' }
};

test('todos los avisos salen sin huecos sin rellenar', () => {
  const sueltos = [];
  for (const kind of KINDS) {
    const vars = APORTA[kind];
    assert.ok(vars, `falta declarar qué variables aporta ${kind}`);
    const payload = buildMessage(kind, { config: {}, vars, defaults: {} });
    for (const hueco of huecosDe(textoDe(payload))) sueltos.push(`${kind} → {${hueco}}`);
  }
  assert.deepEqual(sueltos, []);
});

test('cada variable del cuerpo está declarada en el catálogo', () => {
  const problemas = [];
  for (const kind of KINDS) {
    const declaradas = new Set((kindInfo(kind)?.variables || []).map(([token]) => token.slice(1, -1)));
    for (const hueco of huecosDe(factoryDefaults(kind).message)) {
      if (!declaradas.has(hueco)) problemas.push(`${kind} → {${hueco}} no aparece en su lista de variables`);
    }
  }
  assert.deepEqual(problemas, []);
});

test('los registros salen en líneas «Etiqueta: valor», sin emojis', () => {
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
  const problemas = [];
  for (const kind of KINDS.filter(k => k.startsWith('log_'))) {
    const { title, message } = factoryDefaults(kind);
    if (EMOJI.test(title || '')) problemas.push(`${kind}: el título lleva emoji`);
    if (EMOJI.test(message || '')) problemas.push(`${kind}: el cuerpo lleva emoji`);
    for (const linea of String(message || '').split('\n')) {
      const texto = linea.trim();
      // Una línea que es solo una variable es el contenido en bruto (el texto
      // del mensaje borrado, por ejemplo): ahí una etiqueta sobra.
      if (!texto || /^\{\w+\}$/.test(texto)) continue;
      if (!texto.includes(':')) problemas.push(`${kind}: «${texto}» no tiene forma de «Etiqueta: valor»`);
    }
  }
  assert.deepEqual(problemas, []);
});

// Quien ya no está en el servidor no se puede mencionar: Discord enseña un
// usuario desconocido. En las salidas y los baneos se usa su nombre.
test('los avisos de quien se fue no dependen de una mención', () => {
  for (const kind of ['log_member_leave', 'log_bot_leave', 'log_ban_added', 'log_ban_removed', 'boost_stopped']) {
    const cuerpo = factoryDefaults(kind).message || '';
    assert.ok(!cuerpo.includes('{user}'), `${kind} menciona a alguien que puede no estar ya en el servidor`);
  }
});

test('memberVars rellena las siete variables de miembro', () => {
  const vars = memberVars({
    user: { id: '1', username: 'yojan', tag: 'yojan' },
    displayName: 'Yojan',
    guild: { name: 'Ankerie Dimension', memberCount: 128 },
    toString: () => '<@1>'
  });
  for (const clave of ['user', 'username', 'userTag', 'displayName', 'userId', 'server', 'memberCount']) {
    assert.ok(vars[clave] !== '' && vars[clave] !== undefined, `memberVars no rellena {${clave}}`);
  }
});

// Los paquetes escriben los 38 mensajes de golpe. Si uno usa una variable que
// su aviso no rellena, el servidor entero se queda con «{viewers}» a la vista.
const { THEMES } = require('../src/core/MessageThemes');

test('ningún paquete usa variables que su aviso no rellena', () => {
  const problemas = [];
  for (const theme of Object.values(THEMES)) {
    for (const [kind, entry] of Object.entries(theme.messages)) {
      const vars = APORTA[kind];
      if (!vars) { problemas.push(`${theme.id}/${kind}: aviso desconocido`); continue; }
      const payload = buildMessage(kind, {
        config: { embeds: { [kind]: entry } },
        vars,
        defaults: {}
      });
      for (const hueco of huecosDe(textoDe(payload))) {
        problemas.push(`${theme.id}/${kind} → {${hueco}}`);
      }
    }
  }
  assert.deepEqual(problemas, []);
});

test('los paquetes cubren los 38 mensajes del catálogo', () => {
  for (const theme of Object.values(THEMES)) {
    assert.deepEqual(Object.keys(theme.messages).sort(), [...KINDS].sort(), `al paquete ${theme.id} le falta algún mensaje`);
  }
});

// «Cinnamoroll»: nada saturado. Se mide en HSL — un pastel tiene la luz alta.
test('la paleta de Limones es pastel de arriba abajo', () => {
  const { getTheme } = require('../src/core/MessageThemes');
  const limones = getTheme('limones');
  for (const [nombre, hex] of Object.entries(limones.colors)) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const luz = (max + min) / 2;
    assert.ok(luz > 0.6, `${nombre} (${hex}) es demasiado oscuro para un pastel`);
  }
});

// Aplicar un paquete no puede llevarse por delante las imágenes que ya haya
// configuradas: son URLs que el administrador buscó a mano.
test('aplicar un paquete no toca las imágenes guardadas', () => {
  const { applyTheme } = require('../src/core/MessageThemes');
  const embeds = applyTheme('limones');
  for (const [kind, campos] of Object.entries(embeds)) {
    assert.ok(!('image' in campos), `${kind}: el paquete estaría borrando la imagen`);
  }
});
