const test = require('node:test');
const assert = require('node:assert/strict');

// Ningún mensaje que publique el bot puede llevar texto de ejemplo, variables
// sin rellenar ni marcas que Discord enseña tal cual. Se arma cada mensaje del
// catálogo con los tres estilos (Void, Limones y estándar) y los dos formatos,
// y se revisa todo lo que vería un miembro.

const MAIN = '1506580021232406540';
const THEMED = '1124871897688055818';
const FREE = '1300000000000000001';
process.env.MAIN_GUILD_ID = MAIN;
process.env.THEMED_MAIN_GUILD_IDS = THEMED;

const { CATALOG, KINDS, buildMessage } = require('../src/core/EmbedCatalog');

// Valores con la forma real que traen los eventos.
const VARS = {
  user: '<@111111111111111111>', username: 'ana_lopez', userTag: 'ana_lopez', displayName: 'Ana', userId: '111111111111111111',
  server: 'Servidor de prueba', memberCount: 120, executor: '<@222222222222222222>', executorName: 'Mod',
  channel: '<#333333333333333333>', channelName: 'general', role: '<@&444444444444444444>', roleName: 'Miembro', roleId: '444444444444444444',
  roles: '<@&444444444444444444>', before: 'antes', after: 'después', content: 'hola', reason: 'spam', case: 'A1B2C3',
  until: 'mañana', from: '<#555555555555555555>', to: '<#666666666666666666>', creator: 'Creadora', title: 'Un video',
  url: 'https://example.com/v', game: 'Minecraft', viewers: 12, views: 340, count: 5, type: 'Texto', thread: '<#777777777777777777>',
  threadName: 'dudas', owner: '<@111111111111111111>', boostCount: 7, boostLevel: 2, previousLevel: 1, discount: 50,
  price: '$5', originalPrice: '$10', endsAt: 'el lunes', worth: '$10', platforms: 'PC', store: 'Steam', platform: 'Twitch',
  author: 'Artista', duration: '3:20', requester: '<@111111111111111111>', source: 'SoundCloud', volume: 50, queue: 2, loop: '',
  generator: '<#888888888888888888>', ownerName: 'Ana', handle: 'ana_lopez'
};

// Todo el texto visible de lo que se publica, pieza a pieza.
function pieces(payload) {
  const out = [];
  if (payload.content) out.push(['contenido', payload.content]);
  for (const embed of payload.embeds || []) {
    if (embed.title) out.push(['título', embed.title]);
    if (embed.author?.name) out.push(['autor', embed.author.name]);
    if (embed.description) out.push(['cuerpo', embed.description]);
    if (embed.footer?.text) out.push(['pie', embed.footer.text]);
    for (const field of embed.fields || []) out.push(['campo', `${field.name}\n${field.value}`]);
  }
  const walk = component => {
    if (!component) return;
    if (component.content) out.push(['bloque', component.content]);
    for (const child of component.components || []) walk(child);
  };
  for (const component of payload.components || []) walk(component);
  return out;
}

function problems(payload, { classic }) {
  const found = [];
  for (const [part, text] of pieces(payload)) {
    if (/\{\w+\}/.test(text)) found.push(`${part} con variable sin rellenar: ${text}`);
    if (/@(usuario|nuevo-miembro|miembro)\b/i.test(text)) found.push(`${part} con texto de ejemplo: ${text}`);
    if (/\b(undefined|null|NaN)\b|\[object /.test(text)) found.push(`${part} con un valor roto: ${text}`);
    if (classic && ['título', 'autor', 'pie'].includes(part) && /(^|\n)\s*(-#|#{1,3})\s/.test(text)) found.push(`${part} con «#» que Discord no entiende: ${text}`);
    if (classic && ['autor', 'pie'].includes(part) && /\*\*|__|~~/.test(text)) found.push(`${part} con marcas de formato sueltas: ${text}`);
  }
  if (!pieces(payload).length) found.push('mensaje vacío');
  return found;
}

const GUILDS = [
  ['Embers Void (Void)', MAIN, {}],
  ['Ankerie Dimension (Limones)', THEMED, {}],
  ['Servidor premium (estándar)', FREE, { plan: 'premium' }]
];

for (const [label, guildId, extra] of GUILDS) {
  for (const layout of ['classic', 'components_v2']) {
    test(`todos los mensajes salen limpios · ${label} · ${layout === 'classic' ? 'embed clásico' : 'bloque moderno'}`, () => {
      const failures = [];
      for (const kind of KINDS) {
        // La bienvenida y la despedida tienen su propio diseño; se revisan aparte.
        if (['welcome', 'goodbye'].includes(kind)) continue;
        const config = { guildId, ...extra, embeds: { [kind]: { layout } } };
        const payload = buildMessage(kind, { config, vars: VARS });
        const classic = layout === 'classic' && !CATALOG[kind]?.fixedLayout && !payload.components;
        for (const problem of problems(payload, { classic })) failures.push(`${kind}: ${problem}`);
      }
      assert.deepEqual(failures, []);
    });
  }
}

test('lo escrito a mano como «@usuario» o con «#» en el título sale bien en Discord', () => {
  const config = {
    guildId: THEMED,
    embeds: {
      boost_stopped: {
        layout: 'classic',
        title: '# ¡Por qué te llevas el Limón :c !',
        message: '@usuario acaba de retirar su mejora de {server}. Gracias, @Nuevo-Miembro.',
        footer: '-# **Un Limón** se despidió de la bolsa…'
      }
    }
  };
  const [embed] = buildMessage('boost_stopped', { config, vars: VARS }).embeds;
  assert.equal(embed.title, '¡Por qué te llevas el Limón :c !');
  assert.equal(embed.description, '<@111111111111111111> acaba de retirar su mejora de Servidor de prueba. Gracias, <@111111111111111111>.');
  assert.equal(embed.footer.text, 'Un Limón se despidió de la bolsa…');
  // Un correo o un nombre parecido no se toca.
  const { literalPlaceholders } = require('../src/core/EmbedCatalog');
  assert.equal(literalPlaceholders('escribe a soporte@usuario.com o a @usuarios_vip'), 'escribe a soporte@usuario.com o a @usuarios_vip');
});

test('una variable que el evento no trae se queda en blanco, no como texto', () => {
  const config = { guildId: THEMED, embeds: { boost_stopped: { layout: 'classic', message: 'Quedan {boostCount} boosts.' } } };
  const [embed] = buildMessage('boost_stopped', { config, vars: { user: '<@1>' } }).embeds;
  assert.equal(embed.description, 'Quedan  boosts.');
  // Lo que no es una variable del bot se respeta: {hola} lo escribió alguien a propósito.
  const custom = { guildId: THEMED, embeds: { boost_stopped: { layout: 'classic', message: 'Usa {hola} para saludar.' } } };
  assert.equal(buildMessage('boost_stopped', { config: custom, vars: {} }).embeds[0].description, 'Usa {hola} para saludar.');
});

test('el panel guarda «@usuario» como la variable {user}', () => {
  const { sanitizeGuildPatch } = require('../src/web/configSanitizer');
  const guild = { id: THEMED, channels: { cache: new Map() }, roles: { cache: new Map() } };
  const result = sanitizeGuildPatch({ embeds: { boost_stopped: { message: '@usuario se fue' } } }, guild, {});
  assert.equal(result.embeds.boost_stopped.message, '{user} se fue');
});

test('la bienvenida y la despedida salen limpias en los dos formatos', () => {
  const { buildWelcomePayload } = require('../src/events/guild/memberAdd');
  const { buildGoodbyePayload } = require('../src/events/guild/memberRemove');
  const member = {
    id: '111111111111111111', displayName: 'Ana', toString: () => '<@111111111111111111>',
    user: { id: '111111111111111111', username: 'ana_lopez', tag: 'ana_lopez', displayAvatarURL: () => 'https://cdn.example.com/a.png' },
    guild: { id: MAIN, name: 'Embers Void', memberCount: 120 }
  };
  const failures = [];
  for (const layout of ['classic', 'components_v2']) {
    for (const [kind, build] of [['welcome', buildWelcomePayload], ['goodbye', buildGoodbyePayload]]) {
      const custom = { title: '# Hola @usuario', message: '@nuevo-miembro llegó a {server}', footer: '-# **Bienvenida**' };
      for (const stored of [{ layout }, { layout, ...custom }]) {
        const payload = build(member, { guildId: MAIN, embeds: { [kind]: stored } });
        for (const problem of problems(payload, { classic: layout === 'classic' })) failures.push(`${kind} ${layout}: ${problem}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});
