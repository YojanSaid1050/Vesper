// src/core/MessageThemes.js
//
// Paquetes de mensajes: los 38 avisos del bot escritos de una vez en una
// misma voz y con una misma paleta.
//
// Existen porque personalizar 38 mensajes a mano es una tarde entera, y
// porque un servidor con la mitad de los avisos en el tono de su comunidad y
// la otra mitad en el tono de fábrica queda peor que no haber tocado nada.
//
// Se aplican desde el panel y están disponibles en CUALQUIER servidor: los dos
// Main vienen con el suyo puesto, pero un servidor nuevo puede elegir el que
// quiera o partir de uno y retocarlo. Aplicar un paquete solo escribe en
// `config.embeds`, así que se puede volver atrás mensaje a mensaje.

const VOID = {
  id: 'void',
  name: 'Void',
  tagline: 'Morado profundo, negro y blanco. Solemne y con ornamentos.',
  accent: '#9D63FF',
  swatches: ['#1B1425', '#9D63FF', '#C9A7FF', '#FFFFFF'],
  colors: {
    neutral: '#9D63FF',
    good: '#A78BFA',
    bad: '#6D28D9',
    warn: '#C9A7FF',
    dark: '#1B1425'
  }
};

const LIMONES = {
  id: 'limones',
  name: 'Limones',
  tagline: 'Amarillo cítrico y cielo pastel. Cercano y con guiños a los limones.',
  accent: '#F7D354',
  swatches: ['#F7D354', '#A8DCEF', '#F8C8DC', '#FFF6D6'],
  colors: {
    neutral: '#F7D354',
    good: '#B8E986',
    bad: '#F79E9E',
    warn: '#FFC978',
    dark: '#8DDCF4'
  }
};

// Un mensaje del paquete: título, cuerpo y color. Dejar el cuerpo vacío
// conserva los campos originales del aviso (quién, cuándo, dónde), que en los
// registros es justo lo que interesa.
function pack(theme, messages) {
  const resolved = {};
  for (const [kind, entry] of Object.entries(messages)) {
    resolved[kind] = {
      title: entry.title ?? null,
      message: entry.message ?? null,
      footer: entry.footer ?? null,
      color: theme.colors[entry.tone || 'neutral']
    };
  }
  return { ...theme, messages: resolved };
}

/* ------------------------------------------------------------------ */
/* Void — la voz de Vesper en Embers Void                              */
/* ------------------------------------------------------------------ */

const VOID_MESSAGES = {
  welcome: {
    title: '# ⛧°. ⋆༺ 𝐴 𝑛𝑒𝑤 𝑤𝑎𝑛𝑑𝑒𝑟𝑒𝑟 ℎ𝑎𝑠 𝑎𝑟𝑟𝑖𝑣𝑒𝑑 ༻⋆. °⛧',
    message: '### 𝑾𝒆𝒍𝒄𝒐𝒎𝒆 𝒕𝒐 {server}, {user}!\n\n༺𓆩~~𝐿𝑒𝑡 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 𝑔𝑢𝑖𝑑𝑒 𝑦𝑜𝑢𝑟 𝑝𝑎𝑡ℎ.~~𓆪༻'
  },
  goodbye: {
    title: '# ☾°.⋆༺ 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑐𝑙𝑎𝑖𝑚𝑠 𝑎𝑛𝑜𝑡ℎ𝑒𝑟 𝑠𝑜𝑢𝑙 ༻⋆.°☽',
    message: '### 𝑭𝒂𝒓𝒆𝒘𝒆𝒍𝒍, {displayName}...\n\n༺𓆩~~𝑀𝑎𝑦 𝑖𝑡𝑠 𝑒𝑚𝑏𝑒𝑟𝑠 𝑐𝑜𝑛𝑡𝑖𝑛𝑢𝑒 𝑡𝑜 𝑏𝑢𝑟𝑛 𝑏𝑒𝑦𝑜𝑛𝑑 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑.~~𓆪༻'
  },

  boost_started: {
    title: '⛧ Una llama más en el vacío',
    message: '{user} ha alimentado el vacío.\n-# {boostCount} brasas encendidas · nivel {boostLevel}',
    tone: 'good'
  },
  boost_stopped: {
    title: '☾ Una brasa se apagó',
    message: '{displayName} retiró su llama. Quedan {boostCount}.',
    tone: 'dark'
  },
  boost_level: {
    title: '⛧ El vacío se ensancha',
    message: '**{server}** alcanzó el nivel **{boostLevel}**.\n-# Antes estaba en el {previousLevel}.',
    tone: 'good'
  },

  log_member_join: { title: '⟡ Un alma cruzó el umbral', tone: 'good' },
  log_member_leave: { title: '⟡ Un alma se desvaneció', tone: 'dark' },
  log_bot_join: { title: '⚙ Un autómata despertó', tone: 'neutral' },
  log_bot_leave: { title: '⚙ Un autómata se apagó', tone: 'dark' },
  log_nickname: { title: '⟡ Otro nombre en la penumbra', tone: 'warn' },
  log_roles_added: { title: '✦ Marcas concedidas', tone: 'good' },
  log_roles_removed: { title: '✦ Marcas retiradas', tone: 'bad' },

  log_timeout_on: { title: '⛧ Silenciado por el vacío', tone: 'bad' },
  log_timeout_off: { title: '⛧ La voz regresa', tone: 'good' },
  log_ban_added: { title: '⸸ Desterrado', tone: 'bad' },
  log_ban_removed: { title: '⸸ Destierro levantado', tone: 'good' },
  automod_notice: { message: '{user}, el vacío se quedó con tu mensaje: {reason}. Caso **#{case}**.' },
  automod_dm: { message: '⛧ Una advertencia en **{server}**.\n\nMotivo: {reason}\nCaso: **#{case}**' },

  log_message_deleted: { title: '☾ Un mensaje se disolvió', tone: 'bad' },
  log_message_edited: { title: '☾ Un mensaje cambió de forma', tone: 'warn' },
  log_messages_purged: { title: '☾ Purga en la penumbra', tone: 'warn' },
  log_channel_created: { title: '⟡ Se abrió un pasaje', tone: 'good' },
  log_channel_deleted: { title: '⟡ Un pasaje se cerró', tone: 'bad' },
  log_role_created: { title: '✦ Nueva marca forjada', tone: 'good' },
  log_role_deleted: { title: '✦ Una marca se deshizo', tone: 'bad' },
  log_thread_created: { title: '⟡ Un hilo en la penumbra', tone: 'good' },
  log_voice_join: { title: '♪ Una voz en el vacío', tone: 'good' },
  log_voice_leave: { title: '♪ La voz se apagó', tone: 'dark' },
  log_voice_move: { title: '♪ La voz cambió de eco', tone: 'neutral' },

  notify_twitch_live: {
    title: '⛧ {creator} está en directo',
    message: '**{title}**\n\n༺ El vacío escucha. ༻\n{url}'
  },
  notify_youtube_live: {
    title: '⛧ {creator} está en directo',
    message: '**{title}**\n{url}'
  },
  notify_youtube_video: {
    title: '☾ {creator} dejó algo nuevo',
    message: '**{title}**\n{url}'
  },
  notify_youtube_short: {
    title: '☾ Un destello de {creator}',
    message: '**{title}**\n{url}'
  },
  notify_tiktok_live: {
    title: '⛧ {creator} está en directo',
    message: '**{title}**\n{url}'
  },
  notify_tiktok_video: {
    title: '☾ {creator} dejó algo nuevo',
    message: '**{title}**\n{url}'
  },

  deal_epic_free: {
    title: '⟡ Ofrenda gratuita: {title}',
    message: 'Epic lo regala. Reclámalo antes de que el vacío lo reclame.\n{url}',
    tone: 'good'
  },
  deal_steam_special: {
    title: '⟡ {discount}% menos: {title}',
    message: '**{title}** cae a {price}.\n{url}',
    tone: 'warn'
  },
  deal_giveaway: {
    title: '⟡ Un sorteo se abrió',
    message: '**{title}**\n{url}',
    tone: 'good'
  }
};

/* ------------------------------------------------------------------ */
/* Limones — la voz de AnkeBot en Ankerie Dimension                    */
/* ------------------------------------------------------------------ */

const LIMONES_MESSAGES = {
  welcome: {
    title: '🍋 Bienvenid@ a {server} :3',
    message: 'Olaaa {user}, bienvenid@ a **{server}**\nespero te sientas como en casa y disfrutes!',
    footer: 'Reclama tu limón'
  },
  goodbye: {
    title: '🍋 Hasta pronto',
    message: 'Adiós {displayName}, gracias por haber formado parte de **{server}**.\n¡Hasta pronto! :3',
    footer: 'Devuelve los limones'
  },

  boost_started: {
    title: '🍋✨ ¡Gracias por el boost!',
    message: '{user} acaba de exprimir un limón por **{server}** 💛\n-# Vamos por {boostCount} boosts · nivel {boostLevel}',
    tone: 'good'
  },
  boost_stopped: {
    title: '🍋 Se acabó el zumo',
    message: '{displayName} retiró su boost. Quedan {boostCount}.',
    tone: 'warn'
  },
  boost_level: {
    title: '🍋🎉 ¡Nivel {boostLevel}!',
    message: '**{server}** subió de nivel. La limonada está más dulce.\n-# Veníamos del nivel {previousLevel}.',
    tone: 'good'
  },

  log_member_join: { title: '🍋 Alguien nuevo por aquí', tone: 'good' },
  log_member_leave: { title: '🍋 Alguien se fue', tone: 'warn' },
  log_bot_join: { title: '🤖 Un bot se unió', tone: 'neutral' },
  log_bot_leave: { title: '🤖 Un bot se fue', tone: 'warn' },
  log_nickname: { title: '✏️ Cambio de nombre', tone: 'neutral' },
  log_roles_added: { title: '🎀 Roles nuevos', tone: 'good' },
  log_roles_removed: { title: '🎀 Roles retirados', tone: 'bad' },

  log_timeout_on: { title: '🤐 A pensar un rato', tone: 'bad' },
  log_timeout_off: { title: '💬 Ya puede hablar', tone: 'good' },
  log_ban_added: { title: '🚫 Sin limones para ti', tone: 'bad' },
  log_ban_removed: { title: '🍋 Baneo levantado', tone: 'good' },
  automod_notice: { message: '{user}, quité tu mensaje: {reason}. Caso **#{case}** 🍋' },
  automod_dm: { message: '🍋 Te llevaste una advertencia en **{server}**.\n\nMotivo: {reason}\nCaso: **#{case}**' },

  log_message_deleted: { title: '🗑️ Mensaje borrado', tone: 'bad' },
  log_message_edited: { title: '✏️ Mensaje editado', tone: 'warn' },
  log_messages_purged: { title: '🧹 Limpieza general', tone: 'warn' },
  log_channel_created: { title: '📁 Canal nuevo', tone: 'good' },
  log_channel_deleted: { title: '📁 Canal borrado', tone: 'bad' },
  log_role_created: { title: '🎀 Rol nuevo', tone: 'good' },
  log_role_deleted: { title: '🎀 Rol borrado', tone: 'bad' },
  log_thread_created: { title: '🧵 Hilo nuevo', tone: 'good' },
  log_voice_join: { title: '🎧 Entró a voz', tone: 'good' },
  log_voice_leave: { title: '🎧 Salió de voz', tone: 'warn' },
  log_voice_move: { title: '🎧 Cambió de canal', tone: 'neutral' },

  notify_twitch_live: {
    title: '🍋 {creator} está en directo!',
    message: '**{title}**\n\nPásate a saludar 💛\n{url}'
  },
  notify_youtube_live: {
    title: '🍋 {creator} está en directo!',
    message: '**{title}**\n{url}'
  },
  notify_youtube_video: {
    title: '🍋 Vídeo nuevo de {creator}',
    message: '**{title}**\n{url}'
  },
  notify_youtube_short: {
    title: '🍋 Short nuevo de {creator}',
    message: '**{title}**\n{url}'
  },
  notify_tiktok_live: {
    title: '🍋 {creator} está en directo!',
    message: '**{title}**\n{url}'
  },
  notify_tiktok_video: {
    title: '🍋 TikTok nuevo de {creator}',
    message: '**{title}**\n{url}'
  },

  deal_epic_free: {
    title: '🍋🎁 Gratis en Epic: {title}',
    message: 'Se regala por tiempo limitado. ¡Corre!\n{url}',
    tone: 'good'
  },
  deal_steam_special: {
    title: '🍋🏷️ {discount}% de descuento: {title}',
    message: 'Se queda en {price}.\n{url}',
    tone: 'warn'
  },
  deal_giveaway: {
    title: '🍋🎉 Sorteo: {title}',
    message: '{url}',
    tone: 'good'
  }
};

/* ------------------------------------------------------------------ */

const THEMES = Object.freeze({
  void: Object.freeze(pack(VOID, VOID_MESSAGES)),
  limones: Object.freeze(pack(LIMONES, LIMONES_MESSAGES))
});

const THEME_IDS = Object.freeze(Object.keys(THEMES));

function getTheme(id) {
  return THEMES[id] || null;
}

// Lo que el panel necesita para enseñar los paquetes sin mandar los 38
// mensajes de cada uno.
function themesForPanel() {
  return THEME_IDS.map(id => {
    const theme = THEMES[id];
    return {
      id: theme.id,
      name: theme.name,
      tagline: theme.tagline,
      accent: theme.accent,
      swatches: theme.swatches,
      count: Object.keys(theme.messages).length,
      sample: {
        welcome: theme.messages.welcome,
        log_ban_added: theme.messages.log_ban_added,
        notify_twitch_live: theme.messages.notify_twitch_live
      }
    };
  });
}

/**
 * Convierte un paquete en el bloque `embeds` que se guarda.
 * `kinds` limita qué mensajes se tocan; sin él se aplican todos.
 */
function applyTheme(id, { kinds = null } = {}) {
  const theme = getTheme(id);
  if (!theme) return null;
  const embeds = {};
  for (const [kind, entry] of Object.entries(theme.messages)) {
    if (kinds && !kinds.includes(kind)) continue;
    embeds[kind] = { ...entry };
  }
  return embeds;
}

// Deja los 38 mensajes como venían de fábrica.
function clearTheme(kinds) {
  const embeds = {};
  for (const kind of kinds) {
    embeds[kind] = { title: null, message: null, footer: null, image: null, color: null, layout: null };
  }
  return embeds;
}

module.exports = { THEMES, THEME_IDS, getTheme, themesForPanel, applyTheme, clearTheme };
