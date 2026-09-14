const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MAIN_GUILD_ID = process.env.MAIN_GUILD_ID || 'main-guild';
process.env.THEMED_MAIN_GUILD_IDS = process.env.THEMED_MAIN_GUILD_IDS || 'themed-guild';

const {
  applyVariables,
  resolveEmbedTemplate,
  defaultEmbedTemplate,
  colorNumber,
  imageUrl
} = require('../src/core/EmbedTemplateService');
const memberAdd = require('../src/events/guild/memberAdd');
const memberRemove = require('../src/events/guild/memberRemove');
const { themedWelcomePayload, themedGoodbyePayload } = require('../src/core/PersonalityService');

function fakeMember(overrides = {}) {
  return {
    id: '123456789012345678',
    displayName: 'Yojan',
    user: { username: 'yojan', bot: false, displayAvatarURL: () => 'https://cdn.example/avatar.png' },
    guild: { name: 'Embers Void', memberCount: 1200 },
    toString() { return `<@${this.id}>`; },
    ...overrides
  };
}

test('sin configuración guardada, el diseño de Embers Void es idéntico al original', () => {
  const member = fakeMember();

  const welcome = memberAdd.buildWelcomePayload(member);
  assert.equal(welcome.flags, 32768);
  const welcomeContainer = welcome.components[0];
  assert.equal(welcomeContainer.type, 17);
  assert.equal(welcomeContainer.accent_color, 0xFFFFFF);
  assert.equal(welcomeContainer.spoiler, false);
  assert.deepEqual(welcomeContainer.components.map(item => item.type), [10, 14, 10, 12]);
  assert.equal(welcomeContainer.components[0].content, '# ⛧°. ⋆༺ 𝐴 𝑛𝑒𝑤 𝑤𝑎𝑛𝑑𝑒𝑟𝑒𝑟 ℎ𝑎𝑠 𝑎𝑟𝑟𝑖𝑣𝑒𝑑 ༻⋆. °⛧');
  assert.equal(
    welcomeContainer.components[2].content,
    `### 𝑾𝒆𝒍𝒄𝒐𝒎𝒆 𝒕𝒐 𝑬𝒎𝒃𝒆𝒓𝒔 𝑽𝒐𝒊𝒅, ${member}!\n\n༺𓆩~~𝐿𝑒𝑡 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 𝑔𝑢𝑖𝑑𝑒 𝑦𝑜𝑢𝑟 𝑝𝑎𝑡ℎ.~~𓆪༻`
  );
  assert.equal(welcomeContainer.components[3].items[0].media.url, 'https://i.redd.it/gaoeixac0boe1.gif');

  const goodbye = memberRemove.buildGoodbyePayload(member);
  const goodbyeContainer = goodbye.components[0];
  assert.equal(goodbyeContainer.accent_color, 0x000000);
  assert.deepEqual(goodbyeContainer.components.map(item => item.type), [10, 14, 10, 12]);
  assert.equal(goodbyeContainer.components[0].content, '# ☾°.⋆༺ 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑐𝑙𝑎𝑖𝑚𝑠 𝑎𝑛𝑜𝑡ℎ𝑒𝑟 𝑠𝑜𝑢𝑙 ༻⋆.°☽');
  assert.equal(goodbyeContainer.components[3].items[0].media.url, 'https://i.redd.it/vru2z0kl9uaf1.gif');
});

test('una configuración vacía o con valores nulos tampoco altera el diseño', () => {
  const member = fakeMember();
  const original = JSON.stringify(memberAdd.buildWelcomePayload(member));

  assert.equal(JSON.stringify(memberAdd.buildWelcomePayload(member, {})), original);
  assert.equal(JSON.stringify(memberAdd.buildWelcomePayload(member, { embeds: {} })), original);
  assert.equal(
    JSON.stringify(memberAdd.buildWelcomePayload(member, {
      embeds: { welcome: { title: null, message: '', color: '', image: null, footer: null } }
    })),
    original
  );
});

test('el editor sustituye texto, color e imagen sin tocar la estructura', () => {
  const member = fakeMember();
  const payload = memberAdd.buildWelcomePayload(member, {
    embeds: {
      welcome: {
        title: '# Bienvenido {username}',
        message: 'Hola {user}, ya somos {memberCount} en {server}',
        color: '#FF00AA',
        image: 'https://example.com/nuevo.gif'
      }
    }
  });

  const container = payload.components[0];
  assert.equal(payload.flags, 32768, 'se conserva el flag de Components V2');
  assert.equal(container.type, 17, 'se conserva el contenedor');
  assert.deepEqual(container.components.map(item => item.type), [10, 14, 10, 12], 'se conserva el orden y el separador');
  assert.equal(container.accent_color, 0xFF00AA);
  assert.equal(container.components[0].content, '# Bienvenido yojan');
  assert.equal(container.components[2].content, 'Hola <@123456789012345678>, ya somos 1200 en Embers Void');
  assert.equal(container.components[3].items[0].media.url, 'https://example.com/nuevo.gif');
});

test('el embed temático usa el editor y conserva los textos antiguos del perfil', () => {
  const member = fakeMember({ guild: { name: 'Ankerie Dimension', memberCount: 40 } });

  const porDefecto = themedWelcomePayload(member, {}).embeds[0];
  assert.equal(porDefecto.title, '☁️ ¡Una nueva estrella llegó!');
  assert.equal(porDefecto.color, 0x8DDCF4);
  assert.equal(porDefecto.thumbnail.url, 'https://cdn.example/avatar.png');
  assert.equal(porDefecto.footer.text, 'AnkeBot • Ankerie Dimension');

  // Compatibilidad: una configuración anterior guardada en `profile` se respeta.
  const heredado = themedWelcomePayload(member, { profile: { welcomeTitle: 'Título viejo', displayName: 'Anke' } }).embeds[0];
  assert.equal(heredado.title, 'Título viejo');
  assert.equal(heredado.footer.text, 'Anke • Ankerie Dimension');

  // El editor tiene prioridad sobre el perfil heredado.
  const editado = themedGoodbyePayload(member, {
    profile: { goodbyeTitle: 'Título viejo' },
    embeds: { goodbye: { title: 'Adiós {username}', message: 'Quedan {memberCount}', color: '#112233', image: 'https://example.com/x.png', footer: 'Pie propio', thumbnail: false } }
  }).embeds[0];
  assert.equal(editado.title, 'Adiós yojan');
  assert.equal(editado.description, 'Quedan 40');
  assert.equal(editado.color, 0x112233);
  assert.equal(editado.image.url, 'https://example.com/x.png');
  assert.equal(editado.footer.text, 'Pie propio');
  assert.equal(editado.thumbnail, undefined, 'se puede ocultar el avatar del miembro');
});

test('las variables y los validadores de la plantilla se comportan como se espera', () => {
  const member = fakeMember();
  assert.equal(applyVariables('{username} · {server} · {memberCount}', member), 'yojan · Embers Void · 1200');
  assert.equal(applyVariables('{displayName} ({userId})', member), 'Yojan (123456789012345678)');
  assert.equal(applyVariables(null, member), null, 'sin plantilla se devuelve null para usar el valor original');
  assert.equal(applyVariables('   ', member), null, 'una cadena en blanco no cuenta como personalización');

  assert.equal(colorNumber('#8DDCF4', 0), 0x8DDCF4);
  assert.equal(colorNumber('8DDCF4', 0), 0x8DDCF4);
  assert.equal(colorNumber('no es color', 0x123456), 0x123456);

  assert.equal(imageUrl('https://example.com/a.gif'), 'https://example.com/a.gif');
  assert.equal(imageUrl('http://example.com/a.gif'), null, 'solo se acepta HTTPS');
  assert.equal(imageUrl('javascript:alert(1)'), null);
  assert.equal(imageUrl(''), null);

  assert.deepEqual(defaultEmbedTemplate(), {
    title: null, message: null, color: null, image: null, footer: null, thumbnail: true
  });

  const resuelto = resolveEmbedTemplate({}, 'welcome', member, { title: 'original', color: 0xABCDEF });
  assert.equal(resuelto.title, 'original');
  assert.equal(resuelto.color, 0xABCDEF);
  assert.equal(resuelto.thumbnail, true);
});

/* ------------------------------------------------------------------ */
/* Las dos versiones de embed, disponibles en los dos servidores       */
/* ------------------------------------------------------------------ */

test('en Embers Void la bienvenida sale en contenedor V2 mientras no se elija otra cosa', () => {
  const payload = memberAdd.buildWelcomePayload(fakeMember(), { embeds: {} });
  assert.equal(payload.flags, 32768);
  assert.equal(payload.components[0].type, 17);
  assert.ok(!payload.embeds);
});

test('en Embers Void se puede pasar la bienvenida al embed clásico sin perder el texto', () => {
  const member = fakeMember();
  const config = { embeds: { welcome: { layout: 'classic' } } };
  const payload = memberAdd.buildWelcomePayload(member, config);

  assert.ok(!payload.flags, 'ya no lleva la marca de Components V2');
  assert.equal(payload.embeds.length, 1);
  assert.equal(payload.embeds[0].title, memberAdd.WELCOME_DEFAULT_TITLE);
  assert.equal(payload.embeds[0].description, memberAdd.welcomeDefaultMessage(member));
  assert.equal(payload.embeds[0].image.url, memberAdd.WELCOME_DEFAULT_IMAGE);
  assert.equal(payload.embeds[0].color, memberAdd.WELCOME_DEFAULT_COLOR);
  assert.equal(payload.embeds[0].thumbnail.url, 'https://cdn.example/avatar.png');
});

test('la despedida de Embers Void también admite el embed clásico', () => {
  const payload = memberRemove.buildGoodbyePayload(fakeMember(), { embeds: { goodbye: { layout: 'classic' } } });
  assert.ok(!payload.flags);
  assert.equal(payload.embeds[0].title, memberRemove.GOODBYE_DEFAULT_TITLE);
});

test('en el Main temático la bienvenida sale como embed clásico por defecto', () => {
  const payload = themedWelcomePayload(fakeMember(), { embeds: {} });
  assert.ok(Array.isArray(payload.embeds));
  assert.ok(!payload.flags);
});

test('el Main temático puede pedir el contenedor V2 y queda igual que el de Embers Void', () => {
  const payload = themedWelcomePayload(fakeMember(), { embeds: { welcome: { layout: 'components_v2' } } });
  assert.equal(payload.flags, 32768);

  const container = payload.components[0];
  assert.equal(container.type, 17);
  const kinds = container.components.map(part => part.type);
  assert.deepEqual(kinds.slice(0, 3), [10, 14, 10], 'título, separador y cuerpo');
  // El pie no existe en V2: se publica como texto pequeño de Markdown.
  assert.ok(container.components.at(-1).content.startsWith('-# '));
});

test('la despedida temática también admite el contenedor V2', () => {
  const payload = themedGoodbyePayload(fakeMember(), { embeds: { goodbye: { layout: 'components_v2' } } });
  assert.equal(payload.flags, 32768);
});

test('un formato desconocido no rompe nada: se usa el de fábrica', () => {
  const payload = memberAdd.buildWelcomePayload(fakeMember(), { embeds: { welcome: { layout: 'inventado' } } });
  assert.equal(payload.flags, 32768);
});

/* ------------------------------------------------------------------ */
/* Menciones donde Discord no las convierte                            */
/* ------------------------------------------------------------------ */

test('una mención en el título de un embed clásico sale como nombre, no como número', () => {
  // Era el fallo de la despedida de Ankerie Dimension: el título mostraba
  // «Hasta pronto <@292953664492929025>» porque Discord no convierte
  // menciones fuera de la descripción.
  const { resolveEmbedTemplate } = require('../src/core/EmbedTemplateService');
  const member = fakeMember({ guild: { name: 'Ankerie Dimension', memberCount: 12 } });
  const config = { embeds: { goodbye: { title: 'Hasta pronto {user}', message: 'Adiós {user}.' } } };

  const template = resolveEmbedTemplate(config, 'goodbye', member, { layout: 'classic' });
  assert.equal(template.title, 'Hasta pronto @Yojan');
  assert.match(template.message, /<@123456789012345678>/, 'en la descripción sí debe ser una mención real');
});

test('en el contenedor V2 la mención funciona también en el título', () => {
  const { resolveEmbedTemplate } = require('../src/core/EmbedTemplateService');
  const config = { embeds: { goodbye: { title: 'Hasta pronto {user}', layout: 'components_v2' } } };
  const template = resolveEmbedTemplate(config, 'goodbye', fakeMember(), {});
  assert.match(template.title, /<@123456789012345678>/);
});

test('el pie tampoco convierte menciones', () => {
  const { resolveEmbedTemplate } = require('../src/core/EmbedTemplateService');
  const config = { embeds: { welcome: { footer: 'Añadido por {user}' } } };
  const template = resolveEmbedTemplate(config, 'welcome', fakeMember(), { layout: 'classic' });
  assert.equal(template.footer, 'Añadido por @Yojan');
});

test('lo mismo vale para roles y canales en el catálogo', () => {
  const { buildMessage } = require('../src/core/EmbedCatalog');
  const vars = {
    user: '<@1>', displayName: 'Yojan', username: 'yojan', userId: '1',
    role: '<@&2>', roleName: 'Miembro', channel: '<#3>', channelName: 'general'
  };
  const config = { embeds: { log_roles_added: { title: '{user} · {role} · {channel}', message: '{user} en {channel}' } } };
  const payload = buildMessage('log_roles_added', { config, vars, defaults: {} });
  assert.equal(payload.embeds[0].title, '@Yojan · @Miembro · #general');
  assert.equal(payload.embeds[0].description, '<@1> en <#3>');
});
