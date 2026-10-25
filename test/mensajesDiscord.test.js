// Cada mensaje del catálogo, construido para cada tipo de servidor, tiene que
// ser algo que Discord acepte y que se lea bien: sin huecos sin rellenar, sin
// «undefined» y dentro de los límites de tamaño.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ContainerBuilder } = require('discord.js');

const MAIN = '1506580021232406540';
const THEMED = '1124871897688055818';
const SATELLITE = '1300000000000000001';
process.env.MAIN_GUILD_ID = MAIN;
process.env.THEMED_MAIN_GUILD_IDS = THEMED;
process.env.APPROVED_GUILD_IDS = SATELLITE;
process.env.WEB_BASE_URL = 'https://vesper.example.com';

const { CATALOG, KINDS, buildMessage } = require('../src/core/EmbedCatalog');

// Un valor de ejemplo por variable, con la forma real que les da el bot.
const SAMPLE = {
  user: '<@700000000000000002>', username: 'xyojansaidx', userTag: 'xyojansaidx', displayName: 'Yojan',
  userId: '700000000000000002', server: '𝐸𝑚𝑏𝑒𝑟𝑠 𝑉𝑜𝑖𝑑𝑠', memberCount: 128, executor: 'Desconocido',
  channel: '<#900000000000000001>', channelName: 'general', role: '<@&900000000000000002>', roleName: 'Miembro',
  roleId: '900000000000000002', roles: '<@&1>, <@&2>', before: 'antes', after: 'después', content: 'hola',
  reason: 'spam', case: 'A1B2C3', until: '<t:1800000000:f>', from: '<#1>', to: '<#2>', creator: 'Ankerie',
  title: 'Título', url: 'https://ejemplo.com/x', game: 'Just Chatting', viewers: 128, views: 4320, count: 25,
  type: 'Texto', thread: '<#3>', threadName: 'dudas', owner: '<@700000000000000002>', ownerName: 'xyojansaidx',
  boostCount: 14, boostLevel: 3, previousLevel: 2, discount: 75, price: '4,99 €', originalPrice: '19,99 €',
  endsAt: 'el 30 de enero', worth: '14,99 €', platforms: 'PC', store: 'Epic', platform: 'Twitch',
  author: 'Joji', duration: '3:29', requester: '<@700000000000000002>', source: 'SoundCloud', volume: 50,
  queue: 2, loop: '', generator: '<#900000000000000003>'
};

function varsFor(kind) {
  const vars = {};
  for (const [token] of CATALOG[kind].variables || []) {
    const name = token.slice(1, -1);
    assert.ok(Object.hasOwn(SAMPLE, name), `falta un ejemplo para ${token} (${kind})`);
    vars[name] = SAMPLE[name];
  }
  return vars;
}

// Todo el texto visible de un mensaje, para buscar restos.
function visibleText(payload) {
  const parts = [payload.content || ''];
  for (const embed of payload.embeds || []) {
    parts.push(embed.title, embed.description, embed.author?.name, embed.footer?.text);
    for (const field of embed.fields || []) parts.push(field.name, field.value);
  }
  const walk = items => {
    for (const item of items || []) {
      if (item.content) parts.push(item.content);
      walk(item.components);
    }
  };
  walk(payload.components);
  return parts.filter(Boolean).join('\n');
}

function checkLimits(kind, payload) {
  const problems = [];
  for (const embed of payload.embeds || []) {
    if ((embed.title || '').length > 256) problems.push('título > 256');
    if ((embed.description || '').length > 4096) problems.push('cuerpo > 4096');
    if ((embed.author?.name || '').length > 256) problems.push('autor > 256');
    if ((embed.footer?.text || '').length > 2048) problems.push('pie > 2048');
    if ((embed.fields || []).length > 25) problems.push('más de 25 campos');
    if (!embed.title && !embed.description && !embed.author && !(embed.fields || []).length) problems.push('embed vacío');
  }
  if (payload.components?.length && payload.flags) {
    try {
      for (const block of payload.components) new ContainerBuilder(block).toJSON();
    } catch (error) {
      problems.push(`contenedor V2 no válido: ${error.message}`);
    }
    if (visibleText(payload).length > 4000) problems.push('el contenedor supera 4000 caracteres');
  }
  if ((payload.content || '').length > 2000) problems.push('texto > 2000');
  return problems.map(problem => `${kind}: ${problem}`);
}

for (const [label, guildId] of [['Embers Void', MAIN], ['Ankerie Dimension', THEMED], ['un satélite', SATELLITE]]) {
  test(`los ${KINDS.length} mensajes de ${label} son válidos para Discord y no dejan huecos`, () => {
    const problems = [];
    for (const kind of KINDS) {
      const payload = buildMessage(kind, {
        config: { guildId },
        vars: varsFor(kind),
        // Los registros traen además sus recuadros y la foto del miembro.
        defaults: { authorIconUrl: 'https://cdn.discordapp.com/embed/avatars/0.png', thumbnailUrl: 'https://cdn.discordapp.com/embed/avatars/0.png' },
        fields: [{ name: 'Canal', value: '<#900000000000000001>', inline: true }]
      });
      const text = visibleText(payload);
      if (!text.trim()) problems.push(`${kind}: sale vacío`);
      for (const leftover of text.match(/\{\w+\}/g) || []) problems.push(`${kind}: queda ${leftover}`);
      for (const word of ['undefined', 'null', '[object Object]', 'NaN']) {
        if (text.includes(word)) problems.push(`${kind}: aparece «${word}»`);
      }
      problems.push(...checkLimits(kind, payload));
    }
    assert.deepEqual(problems, []);
  });
}

test('el banner del controlador apunta al de cada tema', () => {
  const image = guildId => buildMessage('music_controller', { config: { guildId }, vars: varsFor('music_controller') })
    .components[0].components.find(part => part.type === 12)?.items[0].media.url;
  assert.equal(image(MAIN), 'https://vesper.example.com/panel/assets/img/musica-void.png');
  assert.equal(image(THEMED), 'https://vesper.example.com/panel/assets/img/musica-limones.png');
  assert.equal(image(SATELLITE), 'https://vesper.example.com/panel/assets/img/musica-estandar.png');
});
