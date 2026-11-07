// src/core/music/sessionStore.js
//
// La sesión de música de cada servidor, guardada en MongoDB para que un
// reinicio (un despliegue, Render despertando, una caída) no la corte: qué
// canción sonaba y por dónde iba, la cola, el volumen, el bucle y en qué
// canales estaba. Al arrancar, MusicService la retoma si sigue habiendo
// alguien escuchando.

const MonitorState = require('../../database/models/MonitorState');

const PREFIX = 'music:';
// Tras más de dos horas sin el bot, retomar una canción a medias ya no tiene
// sentido: la sesión se descarta.
const RESTORE_WINDOW_MS = 2 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 2_000;
const FOREVER = 8_640_000_000_000_000; // la fecha más lejana que JSON guarda

const TRACK_FIELDS = ['title', 'author', 'duration', 'live', 'pageUrl', 'provider', 'source', 'thumbnail', 'acodec', 'streamUrl', 'streamExpires', 'requesterId', 'info'];

function trackData(track) {
  if (!track) return null;
  const data = {};
  for (const field of TRACK_FIELDS) {
    if (track[field] === undefined) continue;
    data[field] = field === 'streamExpires' && !Number.isFinite(track[field]) ? FOREVER : track[field];
  }
  return data;
}

function snapshot(player, elapsedSeconds) {
  return {
    voiceChannelId: player.voiceChannelId,
    textChannelId: player.textChannelId,
    volume: player.volume,
    loop: Boolean(player.loop),
    paused: Boolean(player.pausedAt),
    elapsed: Math.max(0, Math.floor(elapsedSeconds || 0)),
    current: trackData(player.current),
    queue: (player.queue || []).map(trackData),
    savedAt: Date.now()
  };
}

const pending = new Map();

async function save(guildId, state) {
  await MonitorState.findOneAndUpdate(
    { key: `${PREFIX}${guildId}` },
    { $set: { value: state } },
    { upsert: true }
  );
}

// Guarda poco después del último cambio: saltar tres canciones seguidas es
// una sola escritura.
function scheduleSave(guildId, build) {
  clearTimeout(pending.get(guildId));
  const timer = setTimeout(() => {
    pending.delete(guildId);
    const state = build();
    (state ? save(guildId, state) : remove(guildId)).catch(error => console.warn(`[Música] No se pudo guardar la sesión de ${guildId}: ${error.message}`));
  }, SAVE_DELAY_MS);
  timer.unref?.();
  pending.set(guildId, timer);
}

async function remove(guildId) {
  clearTimeout(pending.get(guildId));
  pending.delete(guildId);
  await MonitorState.deleteOne({ key: `${PREFIX}${guildId}` });
}

async function loadAll() {
  const rows = await MonitorState.find({ key: { $regex: `^${PREFIX}` } }).lean();
  return rows.map(row => ({ guildId: row.key.slice(PREFIX.length), state: row.value }))
    .filter(({ state }) => state && typeof state === 'object');
}

function fresh(state, now = Date.now()) {
  return Boolean(state?.current) && now - Number(state.savedAt || 0) <= RESTORE_WINDOW_MS;
}

module.exports = { trackData, snapshot, scheduleSave, save, remove, loadAll, fresh, RESTORE_WINDOW_MS };
