const test = require('node:test');
const assert = require('node:assert/strict');
const rss = require('../src/platforms/youtube/rss');

test('construye los feeds separados por tipo de contenido', () => {
  const channelId = 'UCBR8-60-B28hp2BmDPdntcQ';
  assert.equal(rss.playlistIdFor(channelId, 'videos'), 'UULFBR8-60-B28hp2BmDPdntcQ');
  assert.equal(rss.playlistIdFor(channelId, 'shorts'), 'UUSHBR8-60-B28hp2BmDPdntcQ');
  assert.equal(rss.playlistIdFor(channelId, 'lives'), 'UULVBR8-60-B28hp2BmDPdntcQ');
  assert.equal(rss.playlistIdFor(channelId, 'uploads'), 'UUBR8-60-B28hp2BmDPdntcQ');
  assert.match(rss.feedUrl(channelId, 'videos'), /^https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?playlist_id=UULF/);
});

test('rechaza identificadores que no son de canal', () => {
  assert.equal(rss.playlistIdFor('@handle'), null);
  assert.equal(rss.playlistIdFor('PL123'), null);
  assert.equal(rss.playlistIdFor(''), null);
  assert.equal(rss.feedUrl('no-es-un-canal'), null);
});

test('analiza el Atom de YouTube y ordena por fecha', () => {
  const xml = `<?xml version="1.0"?><feed>
    <entry>
      <yt:videoId>viejo1</yt:videoId><yt:channelId>UC123</yt:channelId>
      <title>Video viejo</title><published>2026-01-01T10:00:00+00:00</published>
      <author><name>Canal</name></author>
      <media:thumbnail url="https://i.ytimg.com/vi/viejo1/hq.jpg"/>
      <media:statistics views="100"/>
    </entry>
    <entry>
      <yt:videoId>nuevo1</yt:videoId><yt:channelId>UC123</yt:channelId>
      <title>Nuevo con &amp; y &quot;comillas&quot;</title><published>2026-09-13T10:00:00+00:00</published>
      <author><name>Canal</name></author>
      <media:thumbnail url="https://i.ytimg.com/vi/nuevo1/hq.jpg"/>
      <media:description>Una descripción</media:description>
      <media:statistics views="4200"/>
    </entry>
  </feed>`;

  const entries = rss.parseFeed(xml);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].videoId, 'nuevo1', 'el más reciente va primero');
  assert.equal(entries[0].title, 'Nuevo con & y "comillas"', 'decodifica entidades XML');
  assert.equal(entries[0].views, 4200);
  assert.equal(entries[0].url, 'https://www.youtube.com/watch?v=nuevo1');
  assert.equal(entries[0].description, 'Una descripción');
  assert.equal(entries[1].videoId, 'viejo1');
});

test('una entrada sin identificador de video se descarta', () => {
  const xml = '<feed><entry><title>Rota</title></entry></feed>';
  assert.deepEqual(rss.parseFeed(xml), []);
});

test('un feed vacío o con otra forma no lanza excepciones', () => {
  assert.deepEqual(rss.parseFeed(''), []);
  assert.deepEqual(rss.parseFeed('<html>error</html>'), []);
});

test('un canal sin Shorts devuelve una lista vacía, no un error', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404, text: async () => '' });
  try {
    // YouTube devuelve 404 en la lista de Shorts de un canal que no tiene.
    assert.deepEqual(await rss.fetchFeed('UCBR8-60-B28hp2BmDPdntcQ', 'shorts'), []);
  } finally {
    globalThis.fetch = original;
  }
});
