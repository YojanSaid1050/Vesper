const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LIMITS,
  CustomEmbedError,
  sanitizeCustomEmbed,
  buildCustomEmbedPayload,
  buttonEmoji
} = require('../src/core/CustomEmbedService');

const CHANNEL_ID = '123456789012345678';

function completeMessage(overrides = {}) {
  return {
    channelId: CHANNEL_ID,
    content: 'Texto exterior',
    embed: {
      author: { name: 'AnkeBot', url: 'https://example.com/autor', iconUrl: 'https://example.com/autor.png' },
      title: 'Un anuncio',
      url: 'https://example.com/anuncio',
      description: '**Contenido** con Markdown.',
      color: '#8DDCF4',
      thumbnail: 'https://example.com/miniatura.png',
      image: 'https://example.com/imagen.gif',
      fields: [
        { name: 'Fecha', value: '20 de septiembre', inline: true },
        { name: 'Lugar', value: '#general', inline: true }
      ],
      footer: { text: 'Ankerie Dimension', iconUrl: 'https://example.com/pie.png' },
      timestamp: true
    },
    buttons: [
      { label: 'Abrir', url: 'https://example.com', emoji: '✨' },
      { label: 'Discord', url: 'https://discord.com', emoji: '<:nube:123456789012345678>' }
    ],
    ...overrides
  };
}

test('construye una publicación rica con imágenes, campos y botones', () => {
  const built = buildCustomEmbedPayload(completeMessage());
  assert.equal(built.channelId, CHANNEL_ID);
  assert.deepEqual(built.payload.allowedMentions, { parse: [], roles: [], users: [], repliedUser: false });

  const embed = built.payload.embeds[0].toJSON();
  assert.equal(embed.title, 'Un anuncio');
  assert.equal(embed.color, 0x8DDCF4);
  assert.equal(embed.fields.length, 2);
  assert.equal(embed.image.url, 'https://example.com/imagen.gif');
  assert.equal(embed.thumbnail.url, 'https://example.com/miniatura.png');
  assert.ok(embed.timestamp);

  const row = built.payload.components[0].toJSON();
  assert.equal(row.components.length, 2);
  assert.equal(row.components[0].style, 5, 'los botones son enlaces y no prometen acciones sin programar');
  assert.equal(row.components[1].emoji.id, '123456789012345678');
  assert.deepEqual(built.summary, { fieldCount: 2, buttonCount: 2, roleMenuCount: 0, hasImage: true, hasThumbnail: true, interactive: false });
});

test('el contenido nunca habilita menciones accidentales', () => {
  const built = buildCustomEmbedPayload(completeMessage({ content: '@everyone <@&123456789012345678>' }));
  assert.deepEqual(built.payload.allowedMentions.parse, []);
  assert.deepEqual(built.payload.allowedMentions.roles, []);
  assert.deepEqual(built.payload.allowedMentions.users, []);
});

test('construye autorroles, tickets, canales y menú sin superar las filas de Discord', () => {
  const roleId = '223456789012345678';
  const targetChannel = '323456789012345678';
  const guildId = '423456789012345678';
  const built = buildCustomEmbedPayload(completeMessage({
    mentionRoleId: roleId,
    buttons: [
      { type: 'role', label: 'Dame el rol', roleId, roleAction: 'toggle', style: 'success' },
      { type: 'channel', label: 'Ir a reglas', channelId: targetChannel },
      { type: 'ticket', label: 'Pedir ayuda', style: 'primary' }
    ],
    roleMenu: { enabled: true, mode: 'exclusive', placeholder: 'Elige uno', roles: [{ roleId, label: 'Mi rol' }] }
  }), { guildId });

  assert.equal(built.hasInteractiveComponents, true);
  assert.deepEqual(built.targets.assignableRoleIds, [roleId]);
  assert.deepEqual(built.payload.allowedMentions.roles, [roleId]);
  assert.match(built.payload.content, new RegExp(roleId));
  const components = built.payload.components.map(row => row.toJSON().components).flat();
  assert.match(components[0].custom_id, /^vesper_role:toggle:/);
  assert.equal(components[1].url, `https://discord.com/channels/${guildId}/${targetChannel}`);
  assert.equal(components[2].custom_id, 'community_ticket_open');
  assert.equal(components[3].custom_id, 'vesper_roles:exclusive');
  assert.equal(components[3].max_values, 1);
});

test('rechaza publicaciones vacías, canales falsos y enlaces inseguros', () => {
  assert.throws(() => sanitizeCustomEmbed({ channelId: CHANNEL_ID, embed: {} }), CustomEmbedError);
  assert.throws(() => sanitizeCustomEmbed({ channelId: 'general', embed: { title: 'Hola' } }), /canal seleccionado/);
  assert.throws(() => sanitizeCustomEmbed({ channelId: CHANNEL_ID, embed: { title: 'Hola', image: 'http:\/\/example.com\/x.png' } }), /HTTPS/);
  assert.throws(() => sanitizeCustomEmbed({ channelId: CHANNEL_ID, embed: { title: 'Hola', image: 'https:\/\/127.0.0.1\/x.png' } }), /pública/);
  assert.throws(() => sanitizeCustomEmbed({ channelId: CHANNEL_ID, embed: { url: 'https:\/\/example.com' } }), /título/);
  assert.throws(() => sanitizeCustomEmbed({ channelId: CHANNEL_ID, embed: { title: 'Hola' }, buttons: [{ label: 'Sin enlace' }] }), /obligatorio/);
});

test('respeta los límites globales de Discord', () => {
  const fields = Array.from({ length: LIMITS.fields + 1 }, (_, index) => ({ name: `Campo ${index}`, value: 'x' }));
  assert.throws(() => sanitizeCustomEmbed({ channelId: CHANNEL_ID, embed: { title: 'Hola', fields } }), /máximo 25 campos/);

  const buttons = Array.from({ length: LIMITS.buttons + 1 }, (_, index) => ({ label: `Botón ${index}`, url: 'https://example.com' }));
  assert.throws(() => sanitizeCustomEmbed({ channelId: CHANNEL_ID, embed: { title: 'Hola' }, buttons }), /máximo 20 botones/);

  const tooLong = {
    channelId: CHANNEL_ID,
    embed: {
      title: 'T'.repeat(256),
      description: 'D'.repeat(4096),
      fields: [{ name: 'N'.repeat(256), value: 'V'.repeat(1024) }],
      footer: { text: 'P'.repeat(500) }
    }
  };
  assert.throws(() => sanitizeCustomEmbed(tooLong), /6.000 caracteres|6000 caracteres/);
});

test('normaliza emojis normales y personalizados', () => {
  assert.deepEqual(buttonEmoji('✨', 'emoji'), { name: '✨' });
  assert.deepEqual(buttonEmoji('<a:nube:123456789012345678>', 'emoji'), {
    animated: true,
    name: 'nube',
    id: '123456789012345678'
  });
  assert.throws(() => buttonEmoji('<emoji roto>', 'emoji'), /emoji normal/);
});
