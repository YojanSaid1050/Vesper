// src/core/MessageThemes.js
//
// Paquetes de mensajes: los 38 avisos del bot escritos de una vez en una
// misma voz y con una misma paleta.
//
// Existen porque personalizar 38 mensajes a mano es una tarde entera, y
// porque un servidor con la mitad de los avisos en el tono de su comunidad y
// la otra mitad en el tono de fábrica queda peor que no haber tocado nada.
//
// Cada paquete tiene DUEÑO. «Void» es la voz de Embers Void y «Limones» la de
// Ankerie Dimension: son la identidad de esos servidores, no plantillas para
// repartir. Ofrecérselas a cualquiera sería regalar la cara de otro.
//
// Para el resto hay «Estándar»: neutro, claro y sin guiños a nadie. Y editar
// los mensajes uno a uno es parte del plan premium.
//
// Aplicar un paquete solo escribe en `config.embeds`, así que se puede volver
// atrás mensaje a mensaje.

const VOID = {
  id: 'void',
  scope: 'primary_main',
  name: 'Void',
  tagline: 'Morado profundo, negro y blanco. Solemne, con ornamentos y en cursiva fina.',
  typeface: 'italic',
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
  scope: 'themed_main',
  name: 'Limones',
  tagline: 'Pastel de principio a fin: cielo, menta, mantequilla y rosa. Cercano y sin adornos.',
  accent: '#A8DCEF',
  swatches: ['#A8DCEF', '#C7EBD6', '#FBE0A2', '#F8C8DC'],
  colors: {
    // Toda la paleta es pastel, sin un solo color saturado: el cielo para lo
    // corriente, la menta para lo bueno, el rosa para lo que va mal y la
    // lavanda para las despedidas.
    neutral: '#A8DCEF',
    good: '#C7EBD6',
    bad: '#F8B8C4',
    warn: '#FBE0A2',
    dark: '#C9BDEF',
    boost: '#F8C8DC'
  }
};

// La tipografía de Embers Void: la cursiva fina de Unicode (𝐸𝑚𝑏𝑒𝑟𝑠 𝑉𝑜𝑖𝑑𝑠,
// 𝐴 𝑛𝑒𝑤 𝑤𝑎𝑛𝑑𝑒𝑟𝑒𝑟). No es una fuente: son letras de verdad, así que se ven
// igual en el celular y en el computador.
const ITALIC_UPPER = 0x1D434;
const ITALIC_LOWER = 0x1D44E;

function italicLetters(text) {
  // Esas letras no traen tildes ni eñe: se escriben como letra + tilde
  // combinada (𝑖́, 𝑛̃), que Discord pinta encima sin problema.
  return [...String(text).normalize('NFD')].map(char => {
    const code = char.codePointAt(0);
    if (char === 'h') return 'ℎ';
    if (code >= 65 && code <= 90) return String.fromCodePoint(ITALIC_UPPER + code - 65);
    if (code >= 97 && code <= 122) return String.fromCodePoint(ITALIC_LOWER + code - 97);
    return char;
  }).join('');
}

// Pasa a cursiva el texto escrito, nunca lo que rellena el bot: {variables},
// direcciones de enlaces ni URLs.
function voidType(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .split(/(\{\w+\}|\]\([^)]*\)|https?:\/\/\S+)/)
    .map((part, index) => (index % 2 ? part : italicLetters(part)))
    .join('');
}

// Un mensaje del paquete: título, cuerpo y color. Dejar el cuerpo vacío
// conserva los campos originales del aviso (quién, cuándo, dónde), que en los
// registros es justo lo que interesa.
function pack(theme, messages) {
  const resolved = {};
  // La bienvenida y la despedida ya vienen escritas a mano con su diseño.
  const type = (kind, text) => (theme.typeface === 'italic' && !['welcome', 'goodbye'].includes(kind) ? voidType(text) : text);
  for (const [kind, entry] of Object.entries(messages)) {
    resolved[kind] = {
      author: type(kind, entry.author ?? null),
      title: type(kind, entry.title ?? null),
      message: type(kind, entry.message ?? null),
      footer: type(kind, entry.footer ?? null),
      ...(entry.image ? { image: entry.image } : {}),
      color: theme.colors[entry.tone || 'neutral']
    };
  }
  return { ...theme, messages: resolved };
}

/* ------------------------------------------------------------------ */
/* Void — la voz de Vesper en Embers Void                              */
/* ------------------------------------------------------------------ */

const VOID_MESSAGES = {
  // La bienvenida y la despedida son el diseño original de Embers Void: la
  // tipografía, los ornamentos y el GIF no se tocan.
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
    message: '{user} ha alimentado el vacío.\n\nBrasas encendidas: {boostCount}\nNivel: {boostLevel}',
    footer: 'Que arda mucho tiempo',
    tone: 'good'
  },
  boost_stopped: {
    title: '☾ Una brasa se apagó',
    message: '{username} retiró su llama.\n\nBrasas encendidas: {boostCount}\nNivel: {boostLevel}',
    footer: 'El vacío se enfría un poco',
    tone: 'dark'
  },
  boost_level: {
    title: '⛧ El vacío se ensancha',
    message: '**{server}** alcanzó el nivel {boostLevel}.\n\nNivel anterior: {previousLevel}\nBrasas encendidas: {boostCount}',
    footer: 'Un umbral más adentro',
    tone: 'good'
  },

  // Los registros conservan los ornamentos de Embers Void en el encabezado,
  // pero el cuerpo es el de fábrica: una línea por dato, sin recuadros.
  log_member_join: { author: '⟡ Un alma cruzó el umbral · {server}', tone: 'good' },
  log_member_leave: { author: '⟡ Un alma se desvaneció · {server}', tone: 'dark' },
  log_bot_join: { author: '⚙ Un autómata despertó · {server}', tone: 'neutral' },
  log_bot_leave: { author: '⚙ Un autómata se apagó · {server}', tone: 'dark' },
  log_nickname: { author: '⟡ Otro nombre en la penumbra · {server}', tone: 'warn' },
  log_roles_added: { author: '✦ Marcas concedidas · {server}', tone: 'good' },
  log_roles_removed: { author: '✦ Marcas retiradas · {server}', tone: 'bad' },

  log_timeout_on: { author: '⛧ Silenciado por el vacío · {server}', tone: 'bad' },
  log_timeout_off: { author: '⛧ La voz regresa · {server}', tone: 'good' },
  log_ban_added: { author: '⸸ Desterrado · {server}', tone: 'bad' },
  log_ban_removed: { author: '⸸ Destierro levantado · {server}', tone: 'good' },
  automod_notice: { message: '{user}, el vacío se quedó con tu mensaje: {reason}. Caso **#{case}**.' },
  automod_dm: { message: '⛧ Una advertencia en **{server}**.\n\nMotivo: {reason}\nCaso: **#{case}**' },

  log_message_deleted: { author: '☾ Un mensaje se disolvió · {server}', tone: 'bad' },
  log_message_edited: { author: '☾ Un mensaje cambió de forma · {server}', tone: 'warn' },
  log_messages_purged: { author: '☾ Purga en la penumbra · {server}', tone: 'warn' },
  log_channel_created: { author: '⟡ Se abrió un pasaje · {server}', tone: 'good' },
  log_channel_deleted: { author: '⟡ Un pasaje se cerró · {server}', tone: 'bad' },
  log_role_created: { author: '✦ Nueva marca forjada · {server}', tone: 'good' },
  log_role_deleted: { author: '✦ Una marca se deshizo · {server}', tone: 'bad' },
  log_thread_created: { author: '⟡ Un hilo en la penumbra · {server}', tone: 'good' },
  log_voice_join: { author: '♪ Una voz en el vacío · {server}', tone: 'good' },
  log_voice_leave: { author: '♪ La voz se apagó · {server}', tone: 'dark' },
  log_voice_move: { author: '♪ La voz cambió de eco · {server}', tone: 'neutral' },

  notify_twitch_live: {
    title: '⛧ {creator} está en directo',
    message: '**{title}**\n\nJugando a: {game}\nEspectadores: {viewers}\n\n{url}',
    footer: '༺ El vacío escucha ༻'
  },
  notify_youtube_live: {
    title: '⛧ {creator} está en directo',
    message: '**{title}**\n\nEspectadores: {viewers}\n\n{url}',
    footer: '༺ El vacío escucha ༻'
  },
  notify_youtube_video: {
    title: '☾ {creator} dejó algo nuevo',
    message: '**{title}**\n\nVisualizaciones: {views}\n\n{url}',
    footer: '༺ Un eco más ༻'
  },
  notify_youtube_short: {
    title: '☾ Un destello de {creator}',
    message: '**{title}**\n\nVisualizaciones: {views}\n\n{url}',
    footer: '༺ Un eco más ༻'
  },
  notify_tiktok_live: {
    title: '⛧ {creator} está en directo',
    message: '**{title}**\n\nEspectadores: {viewers}\n\n{url}',
    footer: '༺ El vacío escucha ༻'
  },
  notify_tiktok_video: {
    title: '☾ {creator} dejó algo nuevo',
    message: '**{title}**\n\nReproducciones: {views}\n\n{url}',
    footer: '༺ Un eco más ༻'
  },

  deal_epic_free: {
    title: '⟡ Ofrenda gratuita: {title}',
    message: 'Precio habitual: {originalPrice}\nAhora: **gratis**\nTermina: {endsAt}\n\n{url}',
    footer: 'Reclámalo antes de que el vacío lo reclame',
    tone: 'good'
  },
  deal_steam_special: {
    title: '⟡ {title} · -{discount}%',
    message: 'Antes: {originalPrice}\nAhora: **{price}**\nTermina: {endsAt}\n\n{url}',
    footer: 'Oferta de Steam',
    tone: 'warn'
  },
  deal_giveaway: {
    title: '⟡ Un sorteo se abrió: {title}',
    message: 'Valor habitual: {worth}\nPlataformas: {platforms}\nTermina: {endsAt}\n\n{url}',
    footer: 'Sorteo o llave gratis',
    tone: 'good'
  },

  // Música y salas de voz: el controlador fijo del canal de música y la
  // interfaz de las salas temporales. Llevan los botones dentro.
  music_controller: {
    title: '## ☾ Resonancia del Vacío',
    message: 'El vacío espera una melodía…\nEscribe aquí el nombre o el enlace de una canción y su eco llenará la sala.\n\n-# Entra antes a un canal de voz.',
    footer: '⛧ {server} · Sistema de resonancia',
    image: '{assets}/img/musica-void.png'
  },
  music_playing: {
    title: '## ⛧ Resuena en el vacío',
    message: '### [{title}]({url})\n{author} · {duration}\n\nInvocada por {requester} · desde {source}\nVolumen {volume}% · {queue} en espera{loop}',
    footer: '⛧ {server} · Sistema de resonancia'
  },
  tempvoice_interface: {
    title: '## ⛧ Cámaras del Vacío',
    message: 'Cada alma puede abrir su propia cámara de voz.\nEntra en {generator} para crear la tuya y gobiérnala con los sellos de abajo mientras estés dentro.',
    footer: 'Solo quien abrió la cámara puede cambiarla. «Reclamar» sirve cuando su dueño se fue.'
  },
  tempvoice_room: {
    title: '## ☾ Tu cámara despertó',
    message: 'Esta cámara pertenece a {owner}.\nCambia su nombre, su límite o quién puede cruzar con los sellos de abajo. Se disuelve sola cuando queda vacía.',
    footer: '⛧ Cámaras del Vacío'
  }
};

/* ------------------------------------------------------------------ */
/* Limones — la voz de AnkeBot en Ankerie Dimension                    */
/* ------------------------------------------------------------------ */

const LIMONES_MESSAGES = {
  welcome: {
    title: 'Bienvenid@ a {server} :3',
    message: 'Olaaa {user}, bienvenid@ a **{server}**\nespero te sientas como en casa y disfrutes!',
    footer: 'Reclama tu limón'
  },
  goodbye: {
    title: 'Hasta pronto {displayName}',
    message: 'Adiós {username}, gracias por haber formado parte de **{server}**.\n¡Hasta pronto! :3',
    footer: 'Devuelve los limones',
    tone: 'dark'
  },

  boost_started: {
    title: '¡Gracias por dejar tu Limón!',
    message: '{user} acaba de mejorar **{server}**.\nYa vamos por {boostCount} boosts (nivel {boostLevel}).',
    footer: 'Gracias por depositar tus limones',
    tone: 'boost'
  },
  boost_stopped: {
    title: '¿Por qué te llevas el Limón :c ?',
    message: '{username} retiró su mejora de **{server}**.\nQuedan {boostCount} boosts (nivel {boostLevel}).',
    footer: 'Un limón se despidió de la bolsa…',
    tone: 'boost'
  },
  boost_level: {
    title: '¡La bolsa de Limones creció!',
    message: '**{server}** acaba de alcanzar el nivel {boostLevel} de Discord.\nVeníamos del nivel {previousLevel}, con {boostCount} boosts.\n\nY todavía queda espacio para muchos más Limones…',
    footer: 'Nueva bolsa desbloqueada',
    tone: 'boost'
  },

  // Los registros llevan el mismo cuerpo que trae el bot de fábrica: una
  // línea por dato y sin adornos. Aquí solo cambia el color y el encabezado.
  log_member_join: { author: 'Entró alguien nuevo · {server}', tone: 'good' },
  log_member_leave: { author: 'Se fue alguien · {server}', tone: 'dark' },
  log_bot_join: { author: 'Bot añadido · {server}', tone: 'neutral' },
  log_bot_leave: { author: 'Bot retirado · {server}', tone: 'dark' },
  log_nickname: { author: 'Cambio de apodo · {server}', tone: 'neutral' },
  log_roles_added: { author: 'Roles añadidos · {server}', tone: 'good' },
  log_roles_removed: { author: 'Roles retirados · {server}', tone: 'bad' },

  log_timeout_on: { author: 'A pensar un rato · {server}', tone: 'bad' },
  log_timeout_off: { author: 'Ya puede hablar · {server}', tone: 'good' },
  log_ban_added: { author: 'Sin limones para ti · {server}', tone: 'bad' },
  log_ban_removed: { author: 'Baneo levantado · {server}', tone: 'good' },
  automod_notice: { message: '{user}, quité tu mensaje: {reason}. Caso **#{case}**' },
  automod_dm: { message: 'Te llevaste una advertencia en **{server}**.\n\nMotivo: {reason}\nCaso: **#{case}**' },

  log_message_deleted: { author: 'Mensaje borrado · {server}', tone: 'bad' },
  log_message_edited: { author: 'Mensaje editado · {server}', tone: 'warn' },
  log_messages_purged: { author: 'Limpieza general · {server}', tone: 'warn' },
  log_channel_created: { author: 'Canal nuevo · {server}', tone: 'good' },
  log_channel_deleted: { author: 'Canal borrado · {server}', tone: 'bad' },
  log_role_created: { author: 'Rol nuevo · {server}', tone: 'good' },
  log_role_deleted: { author: 'Rol borrado · {server}', tone: 'bad' },
  log_thread_created: { author: 'Hilo nuevo · {server}', tone: 'good' },
  log_voice_join: { author: 'Entró a un canal de voz · {server}', tone: 'good' },
  log_voice_leave: { author: 'Salió de un canal de voz · {server}', tone: 'dark' },
  log_voice_move: { author: 'Cambió de canal de voz · {server}', tone: 'neutral' },

  // En un aviso de redes lo que importa es qué han publicado y dónde verlo.
  notify_twitch_live: {
    title: '{creator} está en directo',
    message: '**{title}**\n\nJugando a: {game}\nViéndolo ahora: {viewers}\n\n{url}',
    footer: 'Pásate a saludar'
  },
  notify_youtube_live: {
    title: '{creator} está en directo',
    message: '**{title}**\n\nViéndolo ahora: {viewers}\n\n{url}',
    footer: 'Pásate a saludar'
  },
  notify_youtube_video: {
    title: 'Video nuevo de {creator}',
    message: '**{title}**\n\nVisualizaciones: {views}\n\n{url}',
    footer: 'Dale un vistazo'
  },
  notify_youtube_short: {
    title: 'Short nuevo de {creator}',
    message: '**{title}**\n\nVisualizaciones: {views}\n\n{url}',
    footer: 'Dale un vistazo'
  },
  notify_tiktok_live: {
    title: '{creator} está en directo',
    message: '**{title}**\n\nViéndolo ahora: {viewers}\n\n{url}',
    footer: 'Pásate a saludar'
  },
  notify_tiktok_video: {
    title: 'TikTok nuevo de {creator}',
    message: '**{title}**\n\nReproducciones: {views}\n\n{url}',
    footer: 'Dale un vistazo'
  },

  // Y en una oferta, cuánto cuesta y hasta cuándo.
  deal_epic_free: {
    title: 'Gratis en Epic: {title}',
    message: 'Precio habitual: {originalPrice}\nAhora: **gratis**\nTermina: {endsAt}\n\n{url}',
    footer: 'Reclámalo antes de que se acabe',
    tone: 'good'
  },
  deal_steam_special: {
    title: '{title} · -{discount}%',
    message: 'Antes: {originalPrice}\nAhora: **{price}**\nTermina: {endsAt}\n\n{url}',
    footer: 'Oferta de Steam',
    tone: 'warn'
  },
  deal_giveaway: {
    title: 'Gratis: {title}',
    message: 'Valor habitual: {worth}\nPlataformas: {platforms}\nTermina: {endsAt}\n\n{url}',
    footer: 'Sorteo o llave gratis',
    tone: 'good'
  },

  music_controller: {
    title: '## 🍋 Rockolita Limón',
    message: 'Esperando una canción… :3\nEscribe aquí el nombre o el enlace de una canción y la pongo a sonar.\n\n-# Entra antes a un canal de voz.',
    footer: 'Rockolita de {server}',
    image: '{assets}/img/musica-limones.png',
    tone: 'warn'
  },
  music_playing: {
    title: '## 🍋 Sonando ahora',
    message: '### [{title}]({url})\n{author} · {duration}\n\nLa pidió {requester} · desde {source}\nVolumen {volume}% · {queue} en cola{loop}',
    footer: 'Rockolita de {server}',
    tone: 'warn'
  },
  tempvoice_interface: {
    title: '## 🍋 Equipos Limón',
    message: 'Arma tu propio equipo de voz :3\nEntra en {generator} para crearlo y cámbialo con los botones de abajo mientras estés dentro.',
    footer: 'Solo quien creó el equipo puede cambiarlo. «Reclamar» sirve si se fue.'
  },
  tempvoice_room: {
    title: '## 🍋 ¡Tu equipo está listo!',
    message: 'Este equipo es de {owner}.\nCambia el nombre, el límite o quién puede entrar con los botones de abajo. Se borra solo cuando queda vacío.',
    footer: 'Equipos Limón'
  }
};


/* ------------------------------------------------------------------ */
/* Estándar — el paquete para cualquier servidor                       */
/* ------------------------------------------------------------------ */

// Sin guiños a ninguna comunidad: dice lo que pasó, con claridad y en
// castellano. Es lo que se le ofrece a un servidor que acaba de añadir el bot.
const ESTANDAR = {
  id: 'estandar',
  scope: 'all',
  name: 'Estándar',
  tagline: 'Claro y directo, sin adornos. Va bien en cualquier servidor.',
  accent: '#5865F2',
  swatches: ['#5865F2', '#57F287', '#ED4245', '#FAA61A'],
  colors: {
    neutral: '#5865F2',
    good: '#57F287',
    bad: '#ED4245',
    warn: '#FAA61A',
    dark: '#747F8D'
  }
};

const ESTANDAR_MESSAGES = {
  welcome: {
    title: 'Te damos la bienvenida',
    message: 'Hola {user}, bienvenid@ a **{server}**.\nYa son {memberCount}. Ponte cómodo.',
    tone: 'good'
  },
  goodbye: {
    title: 'Hasta pronto',
    message: '**{displayName}** ha dejado el servidor.\nGracias por haber pasado por aquí.',
    tone: 'dark'
  },

  boost_started: {
    title: 'Gracias por el boost',
    message: '{user} acaba de mejorar **{server}**.\n\nBoosts: {boostCount}\nNivel: {boostLevel}',
    tone: 'good'
  },
  boost_stopped: {
    title: 'Boost retirado',
    message: '{username} dejó de mejorar **{server}**.\n\nBoosts: {boostCount}\nNivel: {boostLevel}',
    tone: 'warn'
  },
  boost_level: {
    title: 'Nivel {boostLevel}',
    message: '**{server}** subió de nivel de mejora.\n\nNivel anterior: {previousLevel}\nBoosts: {boostCount}',
    tone: 'good'
  },

  log_member_join: { author: 'Miembro entró · {server}', tone: 'good' },
  log_member_leave: { author: 'Miembro salió · {server}', tone: 'bad' },
  log_bot_join: { author: 'Bot añadido · {server}', tone: 'neutral' },
  log_bot_leave: { author: 'Bot retirado · {server}', tone: 'warn' },
  log_nickname: { author: 'Apodo cambiado · {server}', tone: 'neutral' },
  log_roles_added: { author: 'Roles añadidos · {server}', tone: 'good' },
  log_roles_removed: { author: 'Roles retirados · {server}', tone: 'bad' },

  log_timeout_on: { author: 'Miembro aislado · {server}', tone: 'bad' },
  log_timeout_off: { author: 'Aislamiento retirado · {server}', tone: 'good' },
  log_ban_added: { author: 'Miembro baneado · {server}', tone: 'bad' },
  log_ban_removed: { author: 'Baneo retirado · {server}', tone: 'good' },
  automod_notice: { message: '{user}, retiré tu mensaje: {reason}. Caso **#{case}**.' },
  automod_dm: { message: 'Recibiste una advertencia en **{server}**.\n\nMotivo: {reason}\nCaso: **#{case}**' },

  log_message_deleted: { author: 'Mensaje borrado · {server}', tone: 'bad' },
  log_message_edited: { author: 'Mensaje editado · {server}', tone: 'warn' },
  log_messages_purged: { author: 'Mensajes purgados · {server}', tone: 'warn' },
  log_channel_created: { author: 'Canal creado · {server}', tone: 'good' },
  log_channel_deleted: { author: 'Canal borrado · {server}', tone: 'bad' },
  log_role_created: { author: 'Rol creado · {server}', tone: 'good' },
  log_role_deleted: { author: 'Rol borrado · {server}', tone: 'bad' },
  log_thread_created: { author: 'Hilo creado · {server}', tone: 'good' },
  log_voice_join: { author: 'Entró a un canal de voz · {server}', tone: 'good' },
  log_voice_leave: { author: 'Salió de un canal de voz · {server}', tone: 'warn' },
  log_voice_move: { author: 'Cambió de canal de voz · {server}', tone: 'neutral' },

  notify_twitch_live: {
    title: '{creator} está en directo',
    message: '**{title}**\n\nJugando a: {game}\nEspectadores: {viewers}\n\n{url}'
  },
  notify_youtube_live: {
    title: '{creator} está en directo',
    message: '**{title}**\n\nEspectadores: {viewers}\n\n{url}'
  },
  notify_youtube_video: {
    title: 'Video nuevo de {creator}',
    message: '**{title}**\n\nVisualizaciones: {views}\n\n{url}'
  },
  notify_youtube_short: {
    title: 'Short nuevo de {creator}',
    message: '**{title}**\n\nVisualizaciones: {views}\n\n{url}'
  },
  notify_tiktok_live: {
    title: '{creator} está en directo',
    message: '**{title}**\n\nEspectadores: {viewers}\n\n{url}'
  },
  notify_tiktok_video: {
    title: 'TikTok nuevo de {creator}',
    message: '**{title}**\n\nReproducciones: {views}\n\n{url}'
  },

  deal_epic_free: {
    title: 'Gratis en Epic: {title}',
    message: 'Precio habitual: {originalPrice}\nAhora: **gratis**\nTermina: {endsAt}\n\n{url}',
    tone: 'good'
  },
  deal_steam_special: {
    title: '{title} · -{discount}%',
    message: 'Antes: {originalPrice}\nAhora: **{price}**\nTermina: {endsAt}\n\n{url}',
    tone: 'warn'
  },
  deal_giveaway: {
    title: 'Gratis: {title}',
    message: 'Valor habitual: {worth}\nPlataformas: {platforms}\nTermina: {endsAt}\n\n{url}',
    tone: 'good'
  },

  music_controller: {
    title: '## 🎶 Controlador de música',
    message: 'Esperando música…\nEscribe en este canal el nombre o el enlace de una canción y empezará a sonar.\n\n-# Entra antes a un canal de voz.',
    footer: 'Sistema de música de {server}',
    image: '{assets}/img/musica-estandar.png'
  },
  music_playing: {
    title: '## 🎶 Ahora suena',
    message: '### [{title}]({url})\n{author} · {duration}\n\nPedida por {requester} · desde {source}\nVolumen {volume}% · {queue} en cola{loop}',
    footer: 'Sistema de música de {server}'
  },
  tempvoice_interface: {
    title: '## 🔊 Salas de voz',
    message: 'Este panel controla tu sala de voz temporal.\nEntra en {generator} para crear la tuya y usa los botones de abajo mientras estés dentro.',
    footer: 'Solo el dueño de la sala puede cambiarla. «Reclamar» sirve cuando el dueño se fue.'
  },
  tempvoice_room: {
    title: '## 🔊 Tu sala está lista',
    message: 'Esta sala es de {owner}.\nCambia el nombre, el límite o quién puede entrar con los botones de abajo. Se borra sola cuando queda vacía.',
    footer: 'Salas de voz'
  }
};


/* ------------------------------------------------------------------ */

const THEMES = Object.freeze({
  estandar: Object.freeze(pack(ESTANDAR, ESTANDAR_MESSAGES)),
  void: Object.freeze(pack(VOID, VOID_MESSAGES)),
  limones: Object.freeze(pack(LIMONES, LIMONES_MESSAGES))
});

const THEME_IDS = Object.freeze(Object.keys(THEMES));

function getTheme(id) {
  return THEMES[id] || null;
}

// ¿Puede este servidor usar este paquete? Los temáticos son de su servidor y
// de nadie más: son su identidad, no una plantilla que repartir.
function themeAllowed(id, tier) {
  const theme = THEMES[id];
  if (!theme) return false;
  if (theme.scope === 'all') return true;
  return theme.scope === tier;
}

// Lo que el panel necesita para enseñar los paquetes sin mandar los 38
// mensajes de cada uno. `tier` decide cuáles se ofrecen.
function themesForPanel(tier = null) {
  return THEME_IDS.filter(id => themeAllowed(id, tier)).map(id => {
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
    // La imagen del paquete no se escribe: queda como valor por defecto y no
    // pisa la que el servidor ya tuviera puesta.
    const { image, ...fields } = entry;
    embeds[kind] = fields;
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

// El paquete que lleva cada Main sin que nadie lo aplique: Embers Void habla
// con la voz de Void y Ankerie Dimension con la de Limones. Lo guardado en el
// panel siempre manda, y elegir «ninguno» vuelve a los mensajes de fábrica.
const TIER_THEMES = Object.freeze({ primary_main: 'void', themed_main: 'limones' });

// La bienvenida y la despedida tienen su propio diseño por servidor (el de
// Embers Void es un contenedor con GIF) y no se tocan desde aquí.
const OWN_DESIGN = new Set(['welcome', 'goodbye']);

function activeThemeId(config, tier) {
  const chosen = config?.profile?.messageTheme;
  if (chosen === 'ninguno') return null;
  if (chosen && themeAllowed(chosen, tier)) return chosen;
  return TIER_THEMES[tier] || null;
}

// Los campos del paquete activo para un mensaje, o un objeto vacío.
function themeLayer(config, kind, tier) {
  if (OWN_DESIGN.has(kind)) return {};
  const theme = getTheme(activeThemeId(config, tier));
  const entry = theme?.messages?.[kind];
  if (!entry) return {};
  return Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== null && value !== undefined && value !== ''));
}

module.exports = { voidType, THEMES, THEME_IDS, TIER_THEMES, getTheme, themeAllowed, themesForPanel, applyTheme, clearTheme, activeThemeId, themeLayer };
