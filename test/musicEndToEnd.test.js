// Recorrido completo de /musica reproducir sin Discord: búsqueda, bloqueo de
// YouTube, relevo de SoundCloud, ffmpeg real y entrega del audio al
// reproductor de voz (simulado). Si algo de la cadena se rompe, falla aquí.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const { execFileSync } = require('node:child_process');

const GUILD_ID = '1506580021232406540';
process.env.MAIN_GUILD_ID = GUILD_ID;

// @discordjs/voice simulado: registra lo que se le manda a reproducir.
const played = [];
const voicePath = require.resolve('@discordjs/voice');
require.cache[voicePath] = {
  id: voicePath, filename: voicePath, loaded: true,
  exports: {
    joinVoiceChannel: () => Object.assign(new EventEmitter(), { subscribe: () => null, destroy: () => null }),
    createAudioPlayer: () => Object.assign(new EventEmitter(), {
      play(resource) { played.push(resource); },
      stop() { this.emit('idle'); },
      pause() {}, unpause() {}
    }),
    createAudioResource: (stream, options) => ({ stream, options }),
    StreamType: { OggOpus: 'ogg/opus' },
    AudioPlayerStatus: { Idle: 'idle' },
    VoiceConnectionStatus: { Ready: 'ready', Disconnected: 'disconnected', Signalling: 'signalling', Connecting: 'connecting' },
    NoSubscriberBehavior: { Pause: 'pause' },
    entersState: async () => true,
    getVoiceConnection: () => null
  }
};

const mongoPath = require.resolve('../src/database/mongoManager');
require.cache[mongoPath] = {
  id: mongoPath, filename: mongoPath, loaded: true,
  exports: { getGuildConfig: async () => ({ features: { music: true }, music: {} }) }
};

const { MusicService } = require('../src/core/MusicService');
const providers = require('../src/core/music/providers');
const sources = require('../src/core/music/sources');

function fakeInteraction() {
  const voiceChannel = {
    id: '900000000000000010', userLimit: 0, members: { size: 1 },
    permissionsFor: () => ({ has: () => true }),
    toString: () => '<#900000000000000010>'
  };
  const guild = { id: GUILD_ID, voiceAdapterCreator: () => null, members: { me: { voice: {} } } };
  return {
    guildId: GUILD_ID, guild, channelId: '900000000000000011',
    user: { id: '700000000000000002' },
    member: { voice: { channel: voiceChannel } }
  };
}

test('/musica reproducir suena desde SoundCloud cuando YouTube bloquea al alojamiento', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vesper-e2e-'));
  const mp3 = path.join(dir, 'cancion.mp3');
  execFileSync(sources.ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'libmp3lame', mp3]);
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
    fs.createReadStream(mp3).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const audioUrl = `http://127.0.0.1:${server.address().port}/cancion.mp3`;

  const script = path.join(dir, 'yt-dlp');
  fs.writeFileSync(script, `#!/usr/bin/env node
const target = process.argv.at(-1);
if (!target.startsWith('scsearch')) {
  process.stderr.write("ERROR: [youtube] x: Sign in to confirm you’re not a bot.\\n");
  process.exit(1);
}
console.log(JSON.stringify({ entries: [{ id: '3', title: 'Slow Dancing in the Dark', uploader: 'Joji', duration: 209,
  webpage_url: 'https://soundcloud.com/joji/sditd', formats: [{}], url: ${JSON.stringify(audioUrl)}, acodec: 'mp3' }] }));
`, { mode: 0o755 });
  const previous = process.env.YTDLP_PATH;
  process.env.YTDLP_PATH = script;
  providers.reset();
  const music = new MusicService({ channels: { cache: new Map() } });
  t.after(async () => {
    await music.shutdown();
    server.close();
    if (previous === undefined) delete process.env.YTDLP_PATH; else process.env.YTDLP_PATH = previous;
    providers.reset();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const result = await music.enqueue(fakeInteraction(), 'joji slow dancing in the dark');
  assert.equal(result.position, 0);
  assert.equal(result.item.provider, 'soundcloud');
  assert.equal(played.length, 1);
  assert.equal(played[0].options.inputType, 'ogg/opus');

  const chunks = [];
  for await (const chunk of played[0].stream) chunks.push(chunk);
  const audio = Buffer.concat(chunks);
  assert.equal(audio.subarray(0, 4).toString(), 'OggS', 'Discord recibe Ogg/Opus');
  assert.ok(audio.length > 5_000, 'llega audio de verdad, no un flujo vacío');
});

test('detener la música no deja un temporizador que corte la siguiente sesión', async () => {
  const music = new MusicService({ channels: { cache: new Map() } });
  const audio = Object.assign(new EventEmitter(), { stop() { this.emit('idle'); } });
  audio.on('idle', () => music.advance(GUILD_ID));
  music.players.set(GUILD_ID, { queue: [], current: null, skipVotes: new Set(), settings: {}, idleTimer: null });
  music.connections.set(GUILD_ID, { audio, connection: { destroy() {} } });
  await music.stop(GUILD_ID);
  assert.equal(music.players.has(GUILD_ID), false);
  assert.equal(music.connections.has(GUILD_ID), false);
});
