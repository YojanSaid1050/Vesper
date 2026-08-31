const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseProfileHtml,
  latestBrowserVideo,
  extractVideoLinksFromHtml,
  videoTimestampFromId
} = require('../src/platforms/tiktok/freeClient');

function profileHtml({ username = 'vesper', status = 4 } = {}) {
  const state = {
    LiveRoom: {
      liveRoomStatus: status === 4 ? 0 : status,
      liveRoomUserInfo: {
        user: {
          uniqueId: username,
          secUid: 'MS4wLjABAAAA-test',
          nickname: 'Vesper Test',
          roomId: '123456',
          avatarMedium: { urlList: ['https://example.com/avatar.jpg'] }
        },
        liveRoom: {
          status,
          title: 'Directo de prueba',
          coverUrl: 'https://example.com/live.jpg',
          liveRoomStats: { userCount: 42 }
        }
      }
    }
  };
  return `<html><script id="SIGI_STATE" type="application/json">${JSON.stringify(state)}</script></html>`;
}

test('parseProfileHtml reconoce un directo público activo', () => {
  const result = parseProfileHtml(profileHtml({ status: 2 }), 'vesper');
  assert.equal(result.exists, true);
  assert.equal(result.isLive, true);
  assert.equal(result.viewers, 42);
  assert.equal(result.secUid, 'MS4wLjABAAAA-test');
  assert.equal(result.liveUrl, 'https://www.tiktok.com/@vesper/live');
});

test('parseProfileHtml conserva una cuenta offline sin inventar un live', () => {
  const result = parseProfileHtml(profileHtml({ status: 4 }), 'vesper');
  assert.equal(result.isLive, false);
  assert.equal(result.viewers, 0);
});

test('parseProfileHtml rechaza respuestas pertenecientes a otra cuenta', () => {
  assert.throws(
    () => parseProfileHtml(profileHtml({ username: 'otra_cuenta' }), 'vesper'),
    /perfil público válido/
  );
});

test('latestBrowserVideo escoge el ID más reciente aunque un video antiguo aparezca primero', () => {
  const profile = { username: 'vesper', nickname: 'Vesper' };
  const oldId = String((1700000000n << 32n) + 1n);
  const newId = String((1700100000n << 32n) + 1n);
  const result = latestBrowserVideo([
    { id: oldId, username: 'vesper', title: 'Fijado antiguo' },
    { id: newId, username: 'vesper', title: 'Nuevo', thumbnail: 'https://example.com/cover.jpg' }
  ], profile);

  assert.equal(result.latestVideoId, newId);
  assert.equal(result.latestVideoTitle, 'Nuevo');
  assert.equal(result.latestVideoThumbnail, 'https://example.com/cover.jpg');
  assert.equal(result.latestVideoUrl, `https://www.tiktok.com/@vesper/video/${newId}`);
});

test('extrae enlaces de video desde el HTML como respaldo', () => {
  const oldId = String((1700000000n << 32n) + 1n);
  const newId = String((1700100000n << 32n) + 1n);
  const html = `
    <a href="https://www.tiktok.com/@vesper/video/${oldId}"></a>
    {"url":"https:\\/\\/www.tiktok.com\\/@vesper\\/video\\/${newId}"}
  `;
  const result = extractVideoLinksFromHtml(html, { username: 'vesper' });
  assert.equal(result.latestVideoId, newId);
  assert.equal(videoTimestampFromId(newId), 1700100000);
});
