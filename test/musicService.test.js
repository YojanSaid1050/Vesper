const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');

const {
  MusicService,
  sessionDefaults,
  voicePermissionIssues,
  withLegacyShape,
  formatDuration
} = require('../src/core/MusicService');
const sources = require('../src/core/music/sources');

/* ------------------------------------------------------------------ */
/* El motor vive dentro del bot: no hace falta ningún servidor aparte   */
/* ------------------------------------------------------------------ */

test('las herramientas de audio vienen con el bot', () => {
  const tools = sources.toolCheck();
  assert.equal(tools.ok, true, `faltan: ${tools.missing.join(', ')}`);
  assert.match(tools.ytdlp, /yt-dlp$/);
  assert.match(tools.ffmpeg, /ffmpeg$/);
});

test('el estado dice que el motor está disponible sin configurar nada', () => {
  const status = new MusicService({}).status();
  assert.equal(status.engine, 'integrado');
  assert.equal(status.available, true);
  assert.equal(status.reason, null);
});

test('si falta una herramienta se explica qué hacer, sin tecnicismos', () => {
  const service = new MusicService({});
  service.tools = { ok: false, missing: ['ffmpeg'], ytdlp: 'x', ffmpeg: 'y' };
  const status = service.status();
  assert.equal(status.available, false);
  assert.match(status.reason, /npm install/);
  assert.rejects(() => service.waitUntilReady(), /npm install/);
});

/* ------------------------------------------------------------------ */
/* Reconocer lo que escribe la gente                                   */
/* ------------------------------------------------------------------ */

test('un archivo de audio suelto se reproduce sin buscar nada', () => {
  const track = sources.directAudio('https://ejemplo.com/musica/cancion.mp3');
  assert.equal(track.title, 'cancion');
  assert.equal(track.live, false);
  assert.equal(track.streamUrl, 'https://ejemplo.com/musica/cancion.mp3');
});

test('una radio se reconoce como directo', () => {
  assert.equal(sources.directAudio('https://icecast.ejemplo.com/stream').live, true);
});

test('un enlace normal de YouTube no se trata como archivo directo', () => {
  assert.equal(sources.directAudio('https://www.youtube.com/watch?v=abc123'), null);
});

test('los errores de yt-dlp se traducen a algo entendible', () => {
  assert.match(sources.friendlyError('ERROR: Private video'), /privado/);
  assert.match(sources.friendlyError('ERROR: Sign in to confirm your age'), /edad/);
  assert.match(sources.friendlyError('Unable to connect to proxy'), /internet/);
  assert.equal(sources.friendlyError(''), null);
});

/* ------------------------------------------------------------------ */
/* ffmpeg entrega lo que Discord espera                                */
/* ------------------------------------------------------------------ */

test('ffmpeg entrega Ogg/Opus, que es lo que Discord reproduce', async () => {
  const { execFileSync } = require('node:child_process');
  const fs = require('node:fs');
  const file = `${require('node:os').tmpdir()}/vesper-tono.opus`;
  execFileSync(sources.ffmpegPath(), [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=2', '-c:a', 'libopus', '-f', 'opus', file, '-y'
  ]);

  const handle = sources.openStream(file, { volume: 40 });
  const chunks = [];
  await new Promise((resolve, reject) => {
    handle.stream.on('data', chunk => chunks.push(chunk));
    handle.process.on('close', code => (code === 0 ? resolve() : reject(new Error(handle.errorText()))));
  });
  const audio = Buffer.concat(chunks);
  assert.equal(audio.subarray(0, 4).toString('latin1'), 'OggS');
  assert.ok(audio.length > 1000, 'el audio llegó vacío');
  fs.unlinkSync(file);
});

test('las opciones de reconexión solo se usan con direcciones de internet', () => {
  // Son opciones del protocolo HTTP: con un archivo local ffmpeg ni abre la
  // entrada, y la música se quedaba muda sin decir por qué.
  const local = sources.openStream('/tmp/no-existe.opus', {});
  local.process.kill('SIGKILL');
  assert.equal(sources.isHttpUrl('/tmp/no-existe.opus'), false);
  assert.equal(sources.isHttpUrl('https://ejemplo.com/a.mp3'), true);
});

/* ------------------------------------------------------------------ */
/* Reglas de la cola                                                   */
/* ------------------------------------------------------------------ */

test('la sesión nace con los valores del servidor', () => {
  const session = sessionDefaults({ defaultVolume: 35 });
  assert.equal(session.volume, 35);
  assert.equal(session.loop, false);
  assert.deepEqual(session.queue, []);
});

test('detecta los permisos de voz que le faltan al bot', () => {
  const guild = { members: { me: {} } };
  const voiceChannel = {
    permissionsFor: () => ({ has: permission => permission === PermissionFlagsBits.ViewChannel })
  };
  assert.deepEqual(voicePermissionIssues(guild, voiceChannel), ['Conectar', 'Hablar']);
});

test('rechaza canciones duplicadas y respeta el límite pendiente por usuario', async () => {
  const service = new MusicService({});
  const player = sessionDefaults({ maxQueue: 10, maxPerUser: 1, maxTrackMinutes: 15 });
  const voiceChannel = { id: 'voice' };
  service.ensureAllowed = async () => ({ config: { music: player.settings }, voiceChannel });
  service.join = async () => player;
  service.advance = async () => { if (!player.current) player.current = player.queue.shift() || null; };
  let sequence = 0;
  service.loadTrack = async query => withLegacyShape({
    title: query, author: 'x', duration: 1, live: false, pageUrl: `https://youtube.com/watch?v=${query}`, sequence: sequence++
  });
  const interaction = { guildId: 'guild', channelId: 'text', user: { id: 'user' }, guild: {} };

  await service.enqueue(interaction, 'one');
  await assert.rejects(() => service.enqueue(interaction, 'one'), /ya está/);
  await service.enqueue(interaction, 'two');
  await assert.rejects(() => service.enqueue(interaction, 'three'), /máximo 1/);
});

test('una canción demasiado larga se rechaza, pero un directo no', async () => {
  const service = new MusicService({});
  const player = sessionDefaults({ maxTrackMinutes: 3, maxQueue: 10, maxPerUser: 9 });
  service.ensureAllowed = async () => ({ config: { music: player.settings }, voiceChannel: { id: 'v' } });
  service.join = async () => player;
  service.advance = async () => {};
  const interaction = { guildId: 'g', channelId: 't', user: { id: 'u' }, guild: {} };

  service.loadTrack = async () => withLegacyShape({ title: 'larga', duration: 600, live: false, pageUrl: 'https://y/1' });
  await assert.rejects(() => service.enqueue(interaction, 'larga'), /supera el máximo/);

  service.loadTrack = async () => withLegacyShape({ title: 'radio', duration: 0, live: true, pageUrl: 'https://y/2' });
  const result = await service.enqueue(interaction, 'radio');
  assert.equal(result.item.title, 'radio');
});

test('si una pista falla se salta y la sesión sigue viva', async () => {
  const service = new MusicService({});
  const player = sessionDefaults({});
  player.queue = [
    withLegacyShape({ title: 'rota', duration: 10, pageUrl: 'https://y/rota' }),
    withLegacyShape({ title: 'buena', duration: 10, pageUrl: 'https://y/buena' })
  ];
  service.players.set('g', player);
  const avisos = [];
  service.announce = (_, text) => avisos.push(text);
  service.playCurrent = async () => {
    if (service.players.get('g').current.title === 'rota') throw new Error('enlace caducado');
  };

  await service.advance('g');
  assert.equal(player.current.title, 'buena', 'debería haber pasado a la siguiente');
  assert.match(avisos[0], /rota/);
});

test('el tiempo reproducido cuenta las pausas', () => {
  const service = new MusicService({});
  const player = sessionDefaults({});
  player.startedAt = Date.now() - 10_000;
  player.elapsedBeforeSeek = 5;
  assert.ok(service.elapsed(player) >= 14 && service.elapsed(player) <= 16);
  player.pausedAt = player.startedAt + 3_000;
  assert.equal(service.elapsed(player), 8);
});

test('la duración se muestra en minutos, y los directos se dicen con palabras', () => {
  assert.equal(formatDuration(125), '2:05');
  assert.equal(formatDuration(0), 'en directo');
});

/* ------------------------------------------------------------------ */
/* La instalación nunca puede caerse por culpa de la música            */
/* ------------------------------------------------------------------ */

test('el script que descarga yt-dlp nunca devuelve un código de error', async () => {
  // La librería que se usaba antes descargaba el binario en su postinstall:
  // si GitHub no respondía, `npm install` fallaba y el despliegue entero se
  // caía por no poder poner música. Este script avisa y sigue.
  const { execFileSync } = require('node:child_process');
  const salida = execFileSync(process.execPath, [require('node:path').join(__dirname, '..', 'scripts', 'ensure-ytdlp.js')], {
    encoding: 'utf8',
    env: { ...process.env, SKIP_YTDLP_DOWNLOAD: 'true' }
  });
  assert.match(salida, /omitida/);
});

test('sin yt-dlp el bot arranca igual y explica qué hacer', () => {
  const original = process.env.YTDLP_PATH;
  process.env.YTDLP_PATH = '/ruta/que/no/existe/yt-dlp';
  try {
    const service = new MusicService({});
    const status = service.status();
    assert.equal(status.available, false);
    assert.match(status.reason, /music:setup/);
    assert.match(status.reason, /el resto del bot funciona igual/);
  } finally {
    if (original === undefined) delete process.env.YTDLP_PATH;
    else process.env.YTDLP_PATH = original;
  }
});

test('yt-dlp se busca primero donde lo deja el instalador del proyecto', () => {
  const original = process.env.YTDLP_PATH;
  delete process.env.YTDLP_PATH;
  try {
    assert.match(sources.ytdlpPath(), /(bin[/\\]yt-dlp|^yt-dlp$)/);
  } finally {
    if (original !== undefined) process.env.YTDLP_PATH = original;
  }
});
