const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLiveResult, normalizeVideoResult } = require('../src/platforms/tiktok/normalizers');

test('normaliza el formato actual de un live', () => {
  const result = normalizeLiveResult({
    username: 'Vesper',
    isLive: true,
    roomId: '123',
    hostName: 'Vesper Live',
    viewerCount: 42,
    title: 'Prueba',
    hostAvatarUrl: 'https://example.com/avatar.jpg'
  });

  assert.equal(result.username, 'vesper');
  assert.equal(result.isLive, true);
  assert.equal(result.roomId, '123');
  assert.equal(result.viewers, 42);
});

test('normaliza los formatos antiguo y TikTools de live', () => {
  const legacy = normalizeLiveResult({
    handle: '@Legacy',
    success: true,
    liveRoom: { streamId: '456', title: 'Anterior', liveRoomStats: { userCount: 7 } },
    liveRoomUserInfo: { status: 2, nickname: 'Legacy' }
  });
  const tiktools = normalizeLiveResult({
    username: 'Tools',
    httpStatus: 200,
    data: [{ alive: true, room_id: '789', userCount: 9 }]
  });

  assert.equal(legacy.isLive, true);
  assert.equal(legacy.viewers, 7);
  assert.equal(tiktools.isLive, true);
  assert.equal(tiktools.roomId, '789');
});

test('normaliza los datos públicos de un video', () => {
  const video = normalizeVideoResult({
    id: '123456',
    text: 'Hola',
    webVideoUrl: 'https://www.tiktok.com/@vesper/video/123456',
    createTime: 100,
    authorMeta: { name: 'Vesper', nickName: 'Vesper Bot', fans: 50 },
    videoMeta: { coverUrl: 'https://example.com/cover.jpg' },
    playCount: 10,
    commentCount: 2
  });
  assert.equal(video.username, 'vesper');
  assert.equal(video.latestVideoId, '123456');
  assert.equal(video.followers, 50);
});
