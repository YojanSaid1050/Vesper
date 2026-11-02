const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const providers = require('../src/core/music/providers');

// yt-dlp falso: YouTube puede responder con el bloqueo anti-bot que da en los
// centros de datos, y SoundCloud devuelve resultados (uno de ellos, solo una
// muestra de 20 s que no se debe elegir).
function fakeYtdlp(t, { youtube = 'ok', order = 'youtube,soundcloud,audius' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vesper-providers-'));
  const log = path.join(dir, 'calls.log');
  const script = path.join(dir, 'yt-dlp');
  fs.writeFileSync(script, `#!/usr/bin/env node
const args = process.argv.slice(2);
require('node:fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n');
const target = args.at(-1);
const soundcloud = target.startsWith('scsearch') || target.includes('soundcloud.com');
if (!soundcloud && ${JSON.stringify(youtube)} === 'bot') {
  process.stderr.write("ERROR: [youtube] abc: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies for the authentication.\\n");
  process.exit(1);
}
// Las direcciones de audio de cada pista; la protegida no tiene.
const STREAMS = { 'https://soundcloud.com/x/1': 'https://cf/1.mp3', 'https://soundcloud.com/joji/preview': 'https://cf/2.mp3', 'https://soundcloud.com/joji/sditd': 'https://cf/3.mp3' };
if (soundcloud && args.includes('-g')) {
  if (target.includes('protegida')) { process.stderr.write('ERROR: [soundcloud] 9: This video is DRM protected\\n'); process.exit(1); }
  console.log(STREAMS[target] || 'https://cf-media.sndcdn.com/nuevo.mp3'); process.exit(0);
}
if (soundcloud) {
  // Como el yt-dlp real con --flat-playlist: títulos y duraciones, sin audio.
  const full = !args.includes('--flat-playlist');
  const entry = (item, url) => (full ? { ...item, formats: [{}], url, acodec: 'mp3' } : { ...item, _type: 'url', url: 'https://api.soundcloud.com/tracks/' + item.id });
  const protegida = ${JSON.stringify(process.env.__FAKE_SC_PROTECTED || '')} === '1' || args.at(-1).includes('oficial');
  const all = [
    ...(protegida ? [{ id: '9', title: 'SLOW DANCING IN THE DARK oficial', uploader: 'Joji', duration: 209, webpage_url: 'https://soundcloud.com/joji/protegida' }] : []),
    { id: '1', title: 'Otra cosa distinta', uploader: 'Nadie', duration: 200, webpage_url: 'https://soundcloud.com/x/1' },
    { id: '2', title: 'Slow Dancing in the Dark', uploader: 'Joji', duration: 20, webpage_url: 'https://soundcloud.com/joji/preview' },
    { id: '3', title: 'SLOW DANCING IN THE DARK', uploader: 'Joji', duration: 209, webpage_url: 'https://soundcloud.com/joji/sditd' }
  ];
  // --playlist-items N: solo ese resultado, como hace el yt-dlp real.
  const position = args.includes('--playlist-items') ? Number(args[args.indexOf('--playlist-items') + 1]) : 0;
  const picked = position ? all.slice(position - 1, position) : all;
  if (position && picked[0]?.webpage_url.includes('protegida')) { process.stderr.write('ERROR: [soundcloud] 9: This video is DRM protected\\n'); process.exit(1); }
  console.log(JSON.stringify({ _type: 'playlist', entries: picked.map(item => entry(item, STREAMS[item.webpage_url])) }));
  process.exit(0);
}
const video = { id: 'abc123def45', title: 'Joji - SLOW DANCING IN THE DARK', uploader: 'Joji', duration: 209, webpage_url: 'https://www.youtube.com/watch?v=abc123def45' };
if (args.includes('-g')) { console.log('https://rr1.googlevideo.com/audio'); process.exit(0); }
console.log(JSON.stringify({ _type: 'playlist', entries: [{ ...video, formats: [{}], url: 'https://rr1.googlevideo.com/audio', acodec: 'opus' }] }));
`, { mode: 0o755 });
  const previous = { YTDLP_PATH: process.env.YTDLP_PATH, MUSIC_SOURCES: process.env.MUSIC_SOURCES };
  process.env.YTDLP_PATH = script;
  process.env.MUSIC_SOURCES = order;
  providers.reset();
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    providers.reset();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : []);
}

function mockFetch(t, routes) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url));
    const route = Object.entries(routes).find(([prefix]) => String(url).startsWith(prefix));
    if (!route) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => route[1] };
  });
  return calls;
}

test('si YouTube funciona, se usa YouTube', async t => {
  fakeYtdlp(t);
  const [track] = await providers.search('joji slow dancing');
  assert.equal(track.provider, 'youtube');
  assert.equal(track.streamUrl, 'https://rr1.googlevideo.com/audio');
});

test('si YouTube bloquea al alojamiento, la canción sale de SoundCloud y se elige la versión completa y parecida', async t => {
  const calls = fakeYtdlp(t, { youtube: 'bot' });
  const [track] = await providers.search('joji slow dancing in the dark');
  assert.equal(track.provider, 'soundcloud');
  assert.equal(track.title, 'SLOW DANCING IN THE DARK');
  assert.equal(track.streamUrl, 'https://cf/3.mp3');
  assert.equal(providers.status().youtubeBlocked, true);

  const before = calls().length;
  await providers.search('slow dancing in the dark joji');
  const after = calls().slice(before);
  assert.ok(after.every(args => !args.includes('ytsearch1:joji slow dancing in the dark')), 'con YouTube bloqueado no se vuelve a intentar');
  assert.ok(after.some(args => args.at(-1).startsWith('scsearch')));
});

test('SoundCloud excluye las muestras de 30 s al elegir formato', async t => {
  const calls = fakeYtdlp(t, { youtube: 'bot' });
  await providers.search('joji slow dancing in the dark');
  const scCall = calls().find(args => args.at(-1).startsWith('scsearch'));
  assert.equal(scCall[scCall.indexOf('-f') + 1], providers.SOUNDCLOUD_FORMAT);
  assert.match(providers.SOUNDCLOUD_FORMAT, /format_id!\*=preview/);
});

test('SoundCloud abre los primeros resultados a la vez y salta los protegidos', async t => {
  const calls = fakeYtdlp(t, { order: 'soundcloud' });
  const [track] = await providers.search('joji slow dancing in the dark oficial');
  // La oficial está protegida: se salta y suena la siguiente que sí se puede.
  assert.equal(track.title, 'SLOW DANCING IN THE DARK');
  assert.equal(track.streamUrl, 'https://cf/3.mp3');
  // Los procesos 4 y 5 pueden no haber escrito aún: basta con que los tres
  // primeros resultados se abrieran cada uno por su lado.
  const positions = calls().filter(args => args.includes('--playlist-items')).map(args => args[args.indexOf('--playlist-items') + 1]);
  for (const position of ['1', '2', '3']) assert.ok(positions.includes(position), `se abrió el resultado ${position}`);
});

test('lo pedido hace poco no se vuelve a buscar', async t => {
  const calls = fakeYtdlp(t, { order: 'soundcloud' });
  const [first] = await providers.search('joji slow dancing in the dark');
  const before = calls().length;
  const [again] = await providers.search('  Joji SLOW dancing in the dark ');
  assert.equal(calls().length, before, 'sale de la memoria');
  assert.equal(again.title, first.title);
  again.streamUrl = 'cambiada';
  const [third] = await providers.search('joji slow dancing in the dark');
  assert.notEqual(third.streamUrl, 'cambiada', 'cada búsqueda recibe su propia copia');
});

test('las fuentes se consultan a la vez y gana la preferida si contesta a tiempo', async () => {
  const later = (value, ms) => new Promise(resolve => setTimeout(() => resolve(value), ms));
  const failing = ms => new Promise((_, reject) => setTimeout(() => reject(new Error('no')), ms));
  assert.equal(await providers.firstInOrder([later('preferida', 60), later('otra', 5)], 500), 'preferida');
  assert.equal(await providers.firstInOrder([later('preferida', 400), later('otra', 5)], 50), 'otra', 'no se espera de más');
  assert.equal(await providers.firstInOrder([failing(5), later('otra', 30)], 500), 'otra');
  await assert.rejects(providers.firstInOrder([failing(5), failing(10)], 50), errors => errors.length === 2);
});

test('un enlace de YouTube bloqueado se busca por su título en otra fuente', async t => {
  fakeYtdlp(t, { youtube: 'bot' });
  const fetches = mockFetch(t, {
    'https://www.youtube.com/oembed': { title: 'Joji - SLOW DANCING IN THE DARK (Official Video)', author_name: 'Joji' }
  });
  const [track] = await providers.search('https://www.youtube.com/watch?v=K3Qzzggn--s');
  assert.equal(track.provider, 'soundcloud');
  assert.ok(fetches[0].startsWith('https://www.youtube.com/oembed'));
});

test('un enlace de Spotify se busca por su título', async t => {
  fakeYtdlp(t, { youtube: 'bot' });
  mockFetch(t, { 'https://open.spotify.com/oembed': { title: 'SLOW DANCING IN THE DARK' } });
  const [track] = await providers.search('https://open.spotify.com/track/0rKtyWc8bvkriBthvHKY8d');
  assert.equal(track.title, 'SLOW DANCING IN THE DARK');
});

test('si YouTube y SoundCloud fallan, Audius toma el relevo', async t => {
  fakeYtdlp(t, { youtube: 'bot' });
  process.env.MUSIC_SOURCES = 'youtube,audius';
  mockFetch(t, {
    'https://api.audius.co/': { data: ['https://audius.example'] },
    'https://audius.example/v1/tracks/search': { data: [{ id: 'Ab1', title: 'Lofi Hip Hop Beat', duration: 180, user: { name: 'Chill' } }] }
  });
  const [track] = await providers.search('lofi hip hop');
  assert.equal(track.provider, 'audius');
  assert.equal(track.streamUrl, 'https://audius.example/v1/tracks/Ab1/stream?app_name=Vesper');
});

test('sin ninguna fuente disponible, la persona lee una frase clara y el detalle queda para el diagnóstico', async t => {
  fakeYtdlp(t, { youtube: 'bot' });
  process.env.MUSIC_SOURCES = 'youtube,audius';
  mockFetch(t, {});
  await assert.rejects(providers.search('cancion inexistente'), error => {
    assert.equal(error.message, 'No encontré esa canción en ninguna fuente.');
    assert.deepEqual(error.causes.map(cause => cause.provider), ['youtube', 'audius']);
    assert.match(error.causes[0].error.message, /YouTube bloqueó/);
    return true;
  });
});

test('si el audio de YouTube no abre, el tercer intento cambia de fuente sin perder la pista', async t => {
  fakeYtdlp(t);
  const [track] = await providers.search('joji slow dancing in the dark');
  assert.equal(await providers.resolveStream(track, { attempt: 0 }), 'https://rr1.googlevideo.com/audio');
  const url = await providers.resolveStream(track, { attempt: 2 });
  assert.equal(track.provider, 'soundcloud');
  assert.equal(track.switchedFrom, 'youtube');
  assert.equal(url, 'https://cf/3.mp3');
  assert.equal(providers.canRetry(track, 1), true);
  assert.equal(providers.canRetry({ provider: 'directo' }, 0), false);
});

test('los títulos de YouTube se limpian para buscar en otra fuente', () => {
  assert.equal(providers.cleanTitle('Joji - SLOW DANCING IN THE DARK (Official Video)'), 'Joji - SLOW DANCING IN THE DARK');
  assert.equal(providers.cleanTitle('Bad Bunny - DtMF [Video Oficial]'), 'Bad Bunny - DtMF');
  assert.equal(providers.cleanTitle('Canción (Lyrics)'), 'Canción');
});

test('la relevancia evita poner una canción que no tiene nada que ver', () => {
  assert.equal(providers.relevant('joji slow dancing', { title: 'SLOW DANCING IN THE DARK', author: 'Joji' }), true);
  assert.equal(providers.relevant('joji slow dancing', { title: 'Despacito', author: 'Luis Fonsi' }), false);
  assert.equal(providers.relevant('canción', { title: 'Canción', author: '' }), true);
});

test('el orden de fuentes se puede cambiar y valida los nombres', t => {
  const previous = process.env.MUSIC_SOURCES;
  t.after(() => { if (previous === undefined) delete process.env.MUSIC_SOURCES; else process.env.MUSIC_SOURCES = previous; });
  process.env.MUSIC_SOURCES = 'soundcloud, youtube, inventada';
  assert.deepEqual(providers.providerOrder(), ['soundcloud', 'youtube']);
  delete process.env.MUSIC_SOURCES;
  assert.deepEqual(providers.providerOrder(), ['soundcloud', 'audius', 'youtube']);
});

test('por defecto YouTube va de último y ni se consulta si SoundCloud responde', async t => {
  const calls = fakeYtdlp(t, { order: '' });
  delete process.env.MUSIC_SOURCES;
  const [track] = await providers.search('joji slow dancing in the dark');
  assert.equal(track.provider, 'soundcloud');
  assert.ok(calls().every(args => args.at(-1).startsWith('scsearch') || args.at(-1).includes('soundcloud.com')), 'no se llamó a YouTube');
});

test('con YouTube de último, un enlace de YouTube se busca por su título sin tocar YouTube', async t => {
  const calls = fakeYtdlp(t, { order: 'soundcloud,audius,youtube' });
  mockFetch(t, { 'https://www.youtube.com/oembed': { title: 'Joji - SLOW DANCING IN THE DARK (Official Video)' } });
  const [track] = await providers.search('https://www.youtube.com/watch?v=K3Qzzggn--s');
  assert.equal(track.provider, 'soundcloud');
  assert.ok(calls().every(args => !args.at(-1).includes('youtube.com')), 'no se pidió el enlace a YouTube');
});

test('quitar youtube de MUSIC_SOURCES lo deja fuera por completo', async t => {
  fakeYtdlp(t, { order: 'soundcloud' });
  assert.deepEqual(providers.providerOrder(), ['soundcloud']);
  mockFetch(t, {});
  await assert.rejects(providers.search('https://www.youtube.com/watch?v=K3Qzzggn--s'), /No pude leer ese enlace/);
});
