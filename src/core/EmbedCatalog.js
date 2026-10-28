// src/core/EmbedCatalog.js
//
// Catálogo de todos los mensajes que Vesper publica en un servidor.
//
// Cada mensaje tiene una entrada aquí con su nombre, su descripción y las
// variables que admite. El panel web lee este catálogo para construir el
// editor, y los eventos lo usan para publicar.
//
// Regla que no se rompe: si el administrador no ha escrito nada, el mensaje
// sale EXACTAMENTE igual que antes de que esto existiera. La configuración
// sustituye piezas; nunca inventa un formato nuevo por su cuenta.

const { colorNumber, imageUrl, normalizeLayout, rendersMentions } = require('./EmbedTemplateService');
const { containerPayload } = require('./EmbedLayouts');
const { themeLayer } = require('./MessageThemes');
const { guildTier, featureAvailable } = require('../config/guildPolicy');

// Variables comunes a casi todos los registros.
const MEMBER_VARS = [
  ['{user}', 'menciona al miembro'],
  ['{username}', 'su nombre de usuario'],
  ['{userTag}', 'su etiqueta completa'],
  ['{displayName}', 'su apodo en el servidor'],
  ['{userId}', 'su ID'],
  ['{server}', 'nombre del servidor'],
  ['{memberCount}', 'total de miembros']
];

const SERVER_VARS = [
  ['{server}', 'nombre del servidor'],
  ['{memberCount}', 'total de miembros']
];

const ACTOR_VARS = [['{executor}', 'quién realizó la acción']];
const CHANNEL_VARS = [['{channel}', 'canal afectado'], ['{channelName}', 'nombre del canal']];
const ROLE_VARS = [['{role}', 'rol afectado'], ['{roleName}', 'nombre del rol'], ['{roleId}', 'ID del rol']];

const CREATOR_VARS = [
  ['{creator}', 'nombre de la cuenta'],
  ['{title}', 'título de la publicación'],
  ['{url}', 'enlace'],
  ['{server}', 'nombre del servidor']
];

// `supports` dice qué campos tiene sentido ofrecer en el editor de cada
// mensaje. Un registro sin miniatura no debe mostrar esa casilla.
const FULL = { footer: true, thumbnail: true, image: true };
const CONTROLLER = { footer: true, thumbnail: false, image: true };

const TRACK_VARS = [
  ['{title}', 'título de la canción'],
  ['{url}', 'enlace de la canción'],
  ['{author}', 'artista o canal'],
  ['{duration}', 'duración'],
  ['{requester}', 'quién la pidió'],
  ['{source}', 'de dónde sale (SoundCloud, Audius…)'],
  ['{volume}', 'volumen actual'],
  ['{queue}', 'canciones en cola'],
  ['{loop}', '« · en bucle» si la repetición está activa'],
  ['{server}', 'nombre del servidor']
];
const NO_THUMB = { footer: true, thumbnail: false, image: true };

const CATALOG = Object.freeze({
  // ---------------------------------------------------------------- Entradas
  welcome: {
    group: 'Entradas y salidas', label: 'Bienvenida',
    description: 'Se publica en el canal de bienvenida cuando alguien entra.',
    variables: MEMBER_VARS, supports: FULL
  },
  goodbye: {
    group: 'Entradas y salidas', label: 'Despedida',
    description: 'Se publica en el canal de despedida cuando alguien sale.',
    variables: MEMBER_VARS, supports: FULL
  },

  // ------------------------------------------------------------------ Boost
  boost_started: {
    group: 'Mejoras del servidor', label: 'Gracias por el boost',
    description: 'Se publica cuando alguien mejora el servidor con un boost de Nitro. Es el agradecimiento público.',
    variables: [...MEMBER_VARS, ['{boostCount}', 'boosts totales del servidor'], ['{boostLevel}', 'nivel actual']],
    supports: FULL
  },
  boost_stopped: {
    group: 'Mejoras del servidor', label: 'Boost retirado',
    description: 'Cuando alguien deja de mejorar el servidor.',
    variables: [...MEMBER_VARS, ['{boostCount}', 'boosts totales del servidor'], ['{boostLevel}', 'nivel actual']],
    supports: FULL
  },
  boost_level: {
    group: 'Mejoras del servidor', label: 'Nuevo nivel de mejora',
    description: 'Cuando el servidor alcanza (o pierde) un nivel de mejora.',
    variables: [...SERVER_VARS, ['{boostLevel}', 'nivel nuevo'], ['{previousLevel}', 'nivel anterior'], ['{boostCount}', 'boosts totales']],
    supports: NO_THUMB
  },

  // ------------------------------------------------------------------ Logs
  log_member_join: {
    group: 'Registro de miembros', label: 'Miembro entró',
    description: 'Anotación en el canal de registro cuando entra una persona.',
    variables: MEMBER_VARS, supports: FULL
  },
  log_member_leave: {
    group: 'Registro de miembros', label: 'Miembro salió',
    description: 'Anotación en el canal de registro cuando sale una persona.',
    variables: MEMBER_VARS, supports: FULL
  },
  log_bot_join: {
    group: 'Registro de miembros', label: 'Bot añadido',
    description: 'Se publica en el canal de registro de bots cuando se añade uno.',
    variables: [...MEMBER_VARS, ['{role}', 'menciona el rol asignado'], ['{roleName}', 'nombre de ese rol']], supports: FULL
  },
  log_bot_leave: {
    group: 'Registro de miembros', label: 'Bot retirado',
    description: 'Se publica cuando un bot deja el servidor.',
    variables: MEMBER_VARS, supports: FULL
  },
  log_nickname: {
    group: 'Registro de miembros', label: 'Apodo cambiado',
    description: 'Cuando alguien cambia su apodo en el servidor.',
    variables: [...MEMBER_VARS, ['{before}', 'apodo anterior'], ['{after}', 'apodo nuevo']], supports: FULL
  },
  log_roles_added: {
    group: 'Registro de miembros', label: 'Roles añadidos',
    description: 'Cuando un miembro recibe uno o varios roles.',
    variables: [...MEMBER_VARS, ['{roles}', 'roles añadidos']], supports: NO_THUMB
  },
  log_roles_removed: {
    group: 'Registro de miembros', label: 'Roles retirados',
    description: 'Cuando a un miembro le quitan uno o varios roles.',
    variables: [...MEMBER_VARS, ['{roles}', 'roles retirados']], supports: NO_THUMB
  },

  // ------------------------------------------------------------ Moderación
  log_timeout_on: {
    group: 'Registro de moderación', label: 'Miembro aislado',
    description: 'Cuando se aplica un aislamiento temporal.',
    variables: [...MEMBER_VARS, ...ACTOR_VARS, ['{until}', 'hasta cuándo'], ['{reason}', 'motivo']], supports: FULL
  },
  log_timeout_off: {
    group: 'Registro de moderación', label: 'Aislamiento retirado',
    description: 'Cuando se levanta un aislamiento.',
    variables: [...MEMBER_VARS, ...ACTOR_VARS], supports: FULL
  },
  log_ban_added: {
    group: 'Registro de moderación', label: 'Miembro baneado',
    description: 'Cuando alguien recibe un baneo.',
    variables: [...MEMBER_VARS, ...ACTOR_VARS, ['{reason}', 'motivo del baneo']], supports: FULL
  },
  log_ban_removed: {
    group: 'Registro de moderación', label: 'Baneo retirado',
    description: 'Cuando se retira un baneo.',
    variables: [...MEMBER_VARS, ...ACTOR_VARS], supports: FULL
  },
  automod_notice: {
    group: 'Registro de moderación', label: 'Aviso de moderación automática',
    description: 'El mensaje público que Vesper deja en el canal cuando retira un mensaje. Se borra solo a los 10 segundos.',
    variables: [...MEMBER_VARS, ['{reason}', 'motivo de la retirada'], ['{case}', 'identificador del caso']],
    supports: { footer: false, thumbnail: false, image: false },
    plainText: true
  },
  automod_dm: {
    group: 'Registro de moderación', label: 'Aviso privado de advertencia',
    description: 'El mensaje directo que recibe quien es advertido.',
    variables: [...MEMBER_VARS, ['{reason}', 'motivo'], ['{case}', 'identificador del caso']],
    supports: { footer: false, thumbnail: false, image: false },
    plainText: true
  },

  // -------------------------------------------------------------- Servidor
  log_message_deleted: {
    group: 'Registro del servidor', label: 'Mensaje borrado',
    description: 'Cuando se elimina un mensaje de un canal vigilado.',
    variables: [...MEMBER_VARS, ...CHANNEL_VARS, ...ACTOR_VARS, ['{content}', 'contenido del mensaje']], supports: NO_THUMB
  },
  log_message_edited: {
    group: 'Registro del servidor', label: 'Mensaje editado',
    description: 'Cuando alguien edita un mensaje.',
    variables: [...MEMBER_VARS, ...CHANNEL_VARS, ['{before}', 'texto anterior'], ['{after}', 'texto nuevo']], supports: NO_THUMB
  },
  log_channel_created: {
    group: 'Registro del servidor', label: 'Canal creado',
    description: 'Cuando se crea un canal.',
    variables: [...SERVER_VARS, ...CHANNEL_VARS, ...ACTOR_VARS, ['{type}', 'tipo de canal']], supports: NO_THUMB
  },
  log_channel_deleted: {
    group: 'Registro del servidor', label: 'Canal eliminado',
    description: 'Cuando se elimina un canal.',
    variables: [...SERVER_VARS, ...CHANNEL_VARS, ...ACTOR_VARS, ['{type}', 'tipo de canal']], supports: NO_THUMB
  },
  log_role_created: {
    group: 'Registro del servidor', label: 'Rol creado',
    description: 'Cuando se crea un rol.',
    variables: [...SERVER_VARS, ...ROLE_VARS, ...ACTOR_VARS], supports: NO_THUMB
  },
  log_role_deleted: {
    group: 'Registro del servidor', label: 'Rol eliminado',
    description: 'Cuando se elimina un rol.',
    variables: [...SERVER_VARS, ...ROLE_VARS, ...ACTOR_VARS], supports: NO_THUMB
  },
  log_voice_join: {
    group: 'Registro del servidor', label: 'Entró a voz',
    description: 'Cuando alguien se conecta a un canal de voz.',
    variables: [...MEMBER_VARS, ...CHANNEL_VARS], supports: NO_THUMB
  },
  log_voice_leave: {
    group: 'Registro del servidor', label: 'Salió de voz',
    description: 'Cuando alguien se desconecta de un canal de voz.',
    variables: [...MEMBER_VARS, ...CHANNEL_VARS], supports: NO_THUMB
  },
  log_messages_purged: {
    group: 'Registro del servidor', label: 'Mensajes purgados',
    description: 'Cuando se borran varios mensajes a la vez, por ejemplo con /clear.',
    variables: [...SERVER_VARS, ...CHANNEL_VARS, ['{count}', 'cantidad de mensajes']], supports: NO_THUMB
  },
  log_thread_created: {
    group: 'Registro del servidor', label: 'Hilo creado',
    description: 'Cuando alguien abre un hilo.',
    variables: [...SERVER_VARS, ...CHANNEL_VARS, ['{thread}', 'menciona el hilo'], ['{threadName}', 'nombre del hilo'], ['{owner}', 'quién lo abrió']], supports: NO_THUMB
  },
  log_voice_move: {
    group: 'Registro del servidor', label: 'Cambió de canal de voz',
    description: 'Cuando alguien se mueve entre canales de voz.',
    variables: [...MEMBER_VARS, ['{from}', 'canal de origen'], ['{to}', 'canal de destino']], supports: NO_THUMB
  },

  // ------------------------------------------------------------- Avisos
  notify_tiktok_live: {
    group: 'Avisos de redes', label: 'TikTok · directo',
    description: 'Aviso cuando una cuenta de TikTok empieza directo.',
    variables: [...CREATOR_VARS, ['{viewers}', 'espectadores']], supports: FULL
  },
  deal_epic_free: {
    group: 'Ofertas y juegos gratis', label: 'Epic · juego gratis',
    description: 'Cuando Epic Games regala un juego (o anuncia el de la próxima semana).',
    variables: [['{title}', 'nombre del juego'], ['{url}', 'enlace a la tienda'], ['{store}', 'tienda'], ['{endsAt}', 'cuándo termina'], ['{originalPrice}', 'precio habitual']],
    supports: FULL
  },
  deal_steam_special: {
    group: 'Ofertas y juegos gratis', label: 'Steam · oferta',
    description: 'Cuando un juego de Steam supera el descuento mínimo que configures.',
    variables: [['{title}', 'nombre del juego'], ['{url}', 'enlace'], ['{discount}', 'porcentaje de descuento'], ['{price}', 'precio rebajado'], ['{originalPrice}', 'precio normal'], ['{endsAt}', 'cuándo termina']],
    supports: FULL
  },
  deal_giveaway: {
    group: 'Ofertas y juegos gratis', label: 'Sorteo o llave gratis',
    description: 'Juegos, DLC y llaves gratis de Steam, GOG, Ubisoft, itch.io y otras tiendas.',
    variables: [['{title}', 'nombre'], ['{url}', 'enlace'], ['{worth}', 'valor habitual'], ['{platforms}', 'plataformas'], ['{endsAt}', 'cuándo termina']],
    supports: FULL
  },

  notify_tiktok_video: {
    group: 'Avisos de redes', label: 'TikTok · video nuevo',
    description: 'Aviso cuando una cuenta de TikTok publica un video.',
    variables: [...CREATOR_VARS, ['{views}', 'reproducciones']], supports: FULL
  },
  notify_twitch_live: {
    group: 'Avisos de redes', label: 'Twitch · directo',
    description: 'Aviso cuando un streamer de Twitch empieza directo.',
    variables: [...CREATOR_VARS, ['{game}', 'categoría'], ['{viewers}', 'espectadores']], supports: FULL
  },
  notify_youtube_live: {
    group: 'Avisos de redes', label: 'YouTube · directo',
    description: 'Aviso cuando un canal de YouTube empieza directo.',
    variables: [...CREATOR_VARS, ['{viewers}', 'espectadores']], supports: FULL
  },
  notify_youtube_video: {
    group: 'Avisos de redes', label: 'YouTube · video nuevo',
    description: 'Aviso cuando un canal publica un video.',
    variables: [...CREATOR_VARS, ['{views}', 'visualizaciones']], supports: FULL
  },
  notify_youtube_short: {
    group: 'Avisos de redes', label: 'YouTube · Short nuevo',
    description: 'Aviso cuando un canal publica un Short.',
    variables: [...CREATOR_VARS, ['{views}', 'visualizaciones']], supports: FULL
  },

  // ------------------------------------------------------ Música y salas
  // Mensajes fijos con botones dentro: siempre salen como contenedor V2,
  // porque es la única forma en que Discord deja meter botones en el bloque.
  music_controller: {
    group: 'Música y salas de voz', label: 'Controlador de música · en espera',
    description: 'El mensaje fijo del canal de música cuando no suena nada. Lleva los botones del reproductor.',
    variables: [['{server}', 'nombre del servidor'], ['{channel}', 'canal de música']],
    supports: CONTROLLER, fixedLayout: 'components_v2'
  },
  music_playing: {
    group: 'Música y salas de voz', label: 'Controlador de música · sonando',
    description: 'El mismo mensaje mientras suena una canción. La portada de la canción sale a la derecha.',
    variables: TRACK_VARS, supports: CONTROLLER, fixedLayout: 'components_v2'
  },
  tempvoice_interface: {
    group: 'Música y salas de voz', label: 'Interfaz de salas de voz',
    description: 'El panel fijo con los 15 botones para gestionar la sala temporal de cada uno.',
    variables: [['{server}', 'nombre del servidor'], ['{generator}', 'canal para crear una sala']],
    supports: CONTROLLER, fixedLayout: 'components_v2'
  },
  tempvoice_room: {
    group: 'Música y salas de voz', label: 'Sala de voz recién creada',
    description: 'Se publica en el chat de cada sala nueva, con los mismos botones.',
    variables: [['{owner}', 'menciona al dueño'], ['{ownerName}', 'nombre del dueño'], ['{channel}', 'la sala'], ['{server}', 'nombre del servidor']],
    supports: CONTROLLER, fixedLayout: 'components_v2'
  }
});


// El texto con el que sale cada mensaje si nadie lo ha tocado.
//
// Esto es la ÚNICA fuente: los eventos ya no escriben su propio título ni su
// propio cuerpo, solo aportan las variables. Así la vista previa del panel no
// puede desviarse de lo que publica el bot, que es lo que pasaba antes.
//
// Forma de los registros: una línea por dato, «Etiqueta: valor», sin emojis y
// sin recuadros apilados. Ocupa la mitad y se lee de un vistazo.
//
// Los de bienvenida y despedida no están: dependen del servidor y los calcula
// el backend a partir del código que los publica.
const FACTORY = Object.freeze({
  boost_started: {
    title: 'Gracias por el boost',
    message: '{user} acaba de mejorar **{server}**.\nBoosts: {boostCount}\nNivel: {boostLevel}',
    color: '#F47FFF'
  },
  boost_stopped: {
    title: 'Boost retirado',
    message: '{username} dejó de mejorar **{server}**.\nBoosts: {boostCount}\nNivel: {boostLevel}',
    color: '#747F8D'
  },
  boost_level: {
    title: 'Nuevo nivel de mejora',
    message: '**{server}** alcanzó el nivel {boostLevel}.\nNivel anterior: {previousLevel}\nBoosts: {boostCount}',
    color: '#F47FFF'
  },

  // -------------------------------------------------------- Registros
  //
  // Forma de un registro, copiada de lo que mejor se lee en Discord:
  //
  //   (foto) Miembro salió · Ankerie Dimension   ← qué pasó y dónde
  //   FreeStuff#9821                              ← a quién o a qué
  //   Apodo que tenía: FreeStuff                  ← los detalles
  //   ID: 672822334641537041 · hoy a las 22:21    ← para copiar
  //
  // La foto es la del miembro cuando el aviso va de una persona, y el icono
  // del servidor cuando va de un canal, un rol o un hilo.
  log_member_join: {
    author: 'Miembro entró · {server}',
    title: '{userTag}',
    message: 'Usuario: {user}\nYa son: {memberCount}',
    footer: 'ID: {userId}',
    color: '#57F287'
  },
  log_member_leave: {
    author: 'Miembro salió · {server}',
    title: '{userTag}',
    message: 'Apodo que tenía: {displayName}\nQuedan: {memberCount}',
    footer: 'ID: {userId}',
    color: '#ED4245'
  },
  log_bot_join: {
    author: 'Bot añadido · {server}',
    title: '{userTag}',
    message: 'Rol asignado: {roleName}',
    footer: 'ID: {userId}',
    color: '#5865F2'
  },
  log_bot_leave: {
    author: 'Bot retirado · {server}',
    title: '{userTag}',
    footer: 'ID: {userId}',
    color: '#ED4245'
  },
  log_nickname: {
    author: 'Apodo cambiado · {server}',
    title: '{userTag}',
    message: 'Antes: {before}\nAhora: {after}',
    footer: 'ID: {userId}',
    color: '#00B0F4'
  },
  log_roles_added: {
    author: 'Roles añadidos · {server}',
    title: '{userTag}',
    message: 'Roles: {roles}',
    footer: 'ID: {userId}',
    color: '#57F287'
  },
  log_roles_removed: {
    author: 'Roles retirados · {server}',
    title: '{userTag}',
    message: 'Roles: {roles}',
    footer: 'ID: {userId}',
    color: '#ED4245'
  },

  // ------------------------------------------------------ Moderación
  log_timeout_on: {
    author: 'Miembro aislado · {server}',
    title: '{userTag}',
    message: 'Aislado por: {executor}\nHasta: {until}\nMotivo: {reason}',
    footer: 'ID: {userId}',
    color: '#ED4245'
  },
  log_timeout_off: {
    author: 'Aislamiento retirado · {server}',
    title: '{userTag}',
    message: 'Retirado por: {executor}',
    footer: 'ID: {userId}',
    color: '#57F287'
  },
  log_ban_added: {
    author: 'Miembro baneado · {server}',
    title: '{userTag}',
    message: 'Baneado por: {executor}\nMotivo: {reason}',
    footer: 'ID: {userId}',
    color: '#ED4245'
  },
  log_ban_removed: {
    author: 'Baneo retirado · {server}',
    title: '{userTag}',
    message: 'Retirado por: {executor}',
    footer: 'ID: {userId}',
    color: '#57F287'
  },
  automod_notice: { message: '{user}, tu mensaje fue retirado: {reason}. Caso **#{case}**.' },
  automod_dm: { message: 'Recibiste una advertencia en **{server}**.\nMotivo: {reason}\nCaso: **#{case}**' },

  // -------------------------------------------------------- Servidor
  log_message_deleted: {
    author: 'Mensaje borrado · {server}',
    title: '{userTag}',
    message: 'Canal: {channel}\nBorrado por: {executor}\n\n{content}',
    footer: 'ID: {userId}',
    color: '#ED4245'
  },
  log_message_edited: {
    author: 'Mensaje editado · {server}',
    title: '{userTag}',
    message: 'Canal: {channel}\n\nAntes: {before}\nAhora: {after}',
    footer: 'ID: {userId}',
    color: '#FAA61A'
  },
  log_messages_purged: {
    author: 'Mensajes purgados · {server}',
    title: '#{channelName}',
    message: 'Mensajes borrados: {count}',
    color: '#FAA61A'
  },
  log_channel_created: {
    author: 'Canal creado · {server}',
    title: '#{channelName}',
    message: 'Tipo: {type}\nCreado por: {executor}',
    color: '#57F287'
  },
  log_channel_deleted: {
    author: 'Canal borrado · {server}',
    title: '#{channelName}',
    message: 'Tipo: {type}\nBorrado por: {executor}',
    color: '#ED4245'
  },
  log_role_created: {
    author: 'Rol creado · {server}',
    title: '{roleName}',
    message: 'Creado por: {executor}',
    footer: 'ID: {roleId}',
    color: '#57F287'
  },
  log_role_deleted: {
    author: 'Rol borrado · {server}',
    title: '{roleName}',
    message: 'Borrado por: {executor}',
    footer: 'ID: {roleId}',
    color: '#FF4D4D'
  },
  log_thread_created: {
    author: 'Hilo creado · {server}',
    title: '{threadName}',
    message: 'En: {channel}\nCreado por: {owner}',
    color: '#57F287'
  },
  log_voice_join: {
    author: 'Entró a un canal de voz · {server}',
    title: '{userTag}',
    message: 'Canal: {channel}',
    footer: 'ID: {userId}',
    color: '#57F287'
  },
  log_voice_leave: {
    author: 'Salió de un canal de voz · {server}',
    title: '{userTag}',
    message: 'Canal: {channel}',
    footer: 'ID: {userId}',
    color: '#ED4245'
  },
  log_voice_move: {
    author: 'Cambió de canal de voz · {server}',
    title: '{userTag}',
    message: 'De: {from}\nA: {to}',
    footer: 'ID: {userId}',
    color: '#5865F2'
  },

  // ----------------------------------------------------------- Redes
  // Lo que importa de un aviso de redes es qué se ha publicado y dónde verlo.
  notify_twitch_live: {
    title: '{creator} está en directo',
    message: '**{title}**\nCategoría: {game}\nEspectadores: {viewers}\n\n{url}',
    color: '#9146FF'
  },
  notify_youtube_live: {
    title: '{creator} está en directo',
    message: '**{title}**\nEspectadores: {viewers}\n\n{url}',
    color: '#FF0000'
  },
  notify_youtube_video: {
    title: 'Video nuevo de {creator}',
    message: '**{title}**\nVisualizaciones: {views}\n\n{url}',
    color: '#FF0000'
  },
  notify_youtube_short: {
    title: 'Short nuevo de {creator}',
    message: '**{title}**\nVisualizaciones: {views}\n\n{url}',
    color: '#FF0000'
  },
  notify_tiktok_live: {
    title: '{creator} está en directo',
    message: '**{title}**\nEspectadores: {viewers}\n\n{url}',
    color: '#1E90FF'
  },
  notify_tiktok_video: {
    title: 'Video nuevo de {creator}',
    message: '**{title}**\nReproducciones: {views}\n\n{url}',
    color: '#1E90FF'
  },

  // --------------------------------------------------------- Ofertas
  // Precio, descuento y hasta cuándo: es lo que decide si merece la pena.
  deal_epic_free: {
    title: 'Gratis en Epic: {title}',
    message: 'Precio habitual: {originalPrice}\nAhora: gratis\nTermina: {endsAt}\n\n{url}',
    color: '#2A2A2A'
  },
  deal_steam_special: {
    title: '{title} · -{discount}%',
    message: 'Antes: {originalPrice}\nAhora: **{price}**\nTermina: {endsAt}\n\n{url}',
    color: '#1B2838'
  },
  deal_giveaway: {
    title: 'Gratis: {title}',
    message: 'Valor habitual: {worth}\nPlataformas: {platforms}\nTermina: {endsAt}\n\n{url}',
    color: '#57F287'
  },

  music_controller: {
    title: '## 🎶 Controlador de música',
    message: 'Esperando música…\nEscribe en este canal el nombre o el enlace de una canción y empezará a sonar.\n\n-# Entra antes a un canal de voz.',
    footer: 'Sistema de música de {server}',
    image: '{assets}/img/musica-estandar.png',
    color: '#5865F2'
  },
  music_playing: {
    title: '## 🎶 Ahora suena',
    message: '### [{title}]({url})\n{author} · {duration}\n\nPedida por {requester} · desde {source}\nVolumen {volume}% · {queue} en cola{loop}',
    footer: 'Sistema de música de {server}',
    color: '#5865F2'
  },
  tempvoice_interface: {
    title: '## 🔊 Salas de voz',
    message: 'Este panel controla tu sala de voz temporal.\nEntra en {generator} para crear la tuya y usa los botones de abajo mientras estés dentro.',
    footer: 'Solo el dueño de la sala puede cambiarla. «Reclamar» sirve cuando el dueño se fue.',
    color: '#5865F2'
  },
  tempvoice_room: {
    title: '## 🔊 Tu sala está lista',
    message: 'Esta sala es de {owner}.\nCambia el nombre, el límite o quién puede entrar con los botones de abajo. Se borra sola cuando queda vacía.',
    footer: 'Salas de voz',
    color: '#5865F2'
  }
});

function factoryDefaults(kind) {
  return FACTORY[kind] || {};
}

const KINDS = Object.freeze(Object.keys(CATALOG));

function isKnownKind(kind) {
  return Object.hasOwn(CATALOG, kind);
}

function kindInfo(kind) {
  return CATALOG[kind] || null;
}

// Agrupado tal y como lo pinta el panel. `defaultLayouts` dice con qué forma
// sale de fábrica cada mensaje en ESTE servidor: la bienvenida de Embers Void
// nace como contenedor V2 y el resto como embed clásico.
// `config` y `guildId` sirven para enseñar como «original» el texto del
// paquete que ese servidor lleva puesto, que es el que sale de verdad.
function catalogForPanel(defaultLayouts = {}, { config = null, guildId = null } = {}) {
  const groups = new Map();
  const tier = guildId ? guildTier(guildId) : null;
  for (const [id, entry] of Object.entries(CATALOG)) {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    // La imagen se queda con {assets}: el panel lo sustituye por su propia
    // dirección, que es la misma desde la que el bot sirve los banners.
    const factory = { ...factoryDefaults(id), ...themeLayer(config, id, tier) };
    groups.get(entry.group).push({
      id,
      label: entry.label,
      description: entry.description,
      variables: entry.variables,
      supports: entry.supports,
      plainText: Boolean(entry.plainText),
      fixedLayout: entry.fixedLayout || null,
      defaultLayout: entry.fixedLayout || (defaultLayouts[id] === 'components_v2' ? 'components_v2' : 'classic'),
      factory
    });
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }));
}

function storedTemplate(config, kind) {
  const stored = config?.embeds?.[kind];
  return stored && typeof stored === 'object' ? stored : {};
}

// Dirección pública de las imágenes del panel (los banners del controlador).
// Sin WEB_BASE_URL no hay de dónde servirlas y el mensaje sale sin imagen.
function assetsBase() {
  const base = String(process.env.WEB_BASE_URL || '').trim().replace(/\/+$/, '');
  return /^https:\/\//.test(base) ? `${base}/panel/assets` : '';
}

// Lo guardado en el panel encima del paquete de mensajes del servidor. Un
// campo vacío en lo guardado no borra el del paquete.
function effectiveTemplate(config, kind) {
  // Los textos escritos a mano son del plan premium: si el servidor lo
  // pierde, vuelven los de siempre sin borrar lo guardado.
  const stored = config?.guildId && !featureAvailable('embeds', config.guildId, config) ? {} : storedTemplate(config, kind);
  const layer = themeLayer(config, kind, config?.guildId ? guildTier(config.guildId) : null);
  const merged = { ...layer };
  for (const [field, value] of Object.entries(stored)) {
    if (value !== null && value !== undefined && value !== '') merged[field] = value;
  }
  return merged;
}

// ¿Tiene este mensaje alguna personalización guardada?
const CAMPOS_EDITABLES = Object.freeze(['author', 'title', 'message', 'footer', 'image', 'color', 'layout']);

function isCustomised(config, kind) {
  const stored = storedTemplate(config, kind);
  return CAMPOS_EDITABLES.some(field => stored[field]);
}

/**
 * Construye el mensaje que se va a publicar.
 *
 * `defaults` son los valores que el bot usaba antes de que esto fuese
 * configurable, y `fields` son los campos del embed original. Si el
 * administrador no ha escrito un mensaje propio, se conservan los campos tal
 * cual; si lo ha escrito, ese texto sustituye el cuerpo, que es justo lo que
 * se espera al personalizar.
 */
function buildMessage(kind, { config, vars: eventVars = {}, defaults = {}, fields = [] } = {}) {
  const stored = effectiveTemplate(config, kind);
  const entry = CATALOG[kind];
  const vars = { assets: assetsBase(), ...eventVars };

  // Un campo vacío o en blanco significa "usa el valor original", no "déjalo
  // en blanco": así el editor puede vaciarse para volver al diseño de fábrica.
  const resolve = (value, table = vars) => {
    if (value === null || value === undefined) return null;
    const text = String(value);
    return text.trim() ? substitute(text, table) : null;
  };

  // El título y el pie de un embed clásico no convierten <@123…> en una
  // mención: sale el número en bruto. En esos huecos se usa el nombre.
  const layoutNow = entry?.fixedLayout || normalizeLayout(stored.layout, defaults.layout);
  const flat = rendersMentions('title', layoutNow) ? vars : plainVars(vars);

  // El catálogo manda cuando el evento no trae nada propio. Los eventos solo
  // aportan variables y la miniatura; el texto vive en un único sitio, así que
  // lo que enseña el panel es exactamente lo que se publica.
  const fabrica = FACTORY[kind] || {};
  // El título y el pie del catálogo también llevan variables ({creator},
  // {title}, {discount}…). Antes solo se sustituía lo que escribía el
  // administrador, así que un aviso de Twitch salía con «{creator}» literal.
  const plantillaTitulo = defaults.title ?? fabrica.title ?? null;
  const plantillaPie = defaults.footer ?? fabrica.footer ?? null;
  // La fila de autor de un registro: «Rol borrado · Ankerie Dimension». Dice
  // de un vistazo qué pasó y en qué servidor, que es lo que se busca cuando se
  // repasa un canal de registro lleno.
  const plantillaAutor = resolve(stored.author, flat) ?? defaults.authorName ?? fabrica.author ?? null;
  const authorLine = plantillaAutor ? substitute(plantillaAutor, flat) : null;
  const title = resolve(stored.title, flat) ?? (plantillaTitulo ? substitute(plantillaTitulo, flat) : null);
  const message = resolve(stored.message);
  const footer = resolve(stored.footer, flat) ?? (plantillaPie ? substitute(plantillaPie, flat) : null);
  const fabricaImagen = fabrica.image ? substitute(fabrica.image, vars) : null;
  const image = imageUrl(resolve(stored.image)) ?? defaults.image ?? imageUrl(fabricaImagen) ?? null;
  const color = colorNumber(stored.color, colorNumber(defaults.color ?? fabrica.color, 0x5865F2));
  const showThumbnail = stored.thumbnail === undefined || stored.thumbnail === null
    ? defaults.thumbnail !== false
    : stored.thumbnail !== false;

  // Mensajes que no son embed (avisos de automoderación y MD de advertencia).
  if (entry?.plainText) {
    return { content: message ?? substitute(defaults.message || fabrica.message || '', vars) };
  }

  // El administrador elige con qué forma sale el mensaje. Si no ha elegido
  // ninguna, se usa la de fábrica de ese mensaje en ese servidor, así que
  // nada cambia hasta que se toca el selector a propósito.
  const layout = layoutNow;

  const plantilla = defaults.description ?? defaults.message ?? fabrica.message ?? null;
  const body = message ?? (plantilla ? substitute(plantilla, vars) : null);
  const usableFields = message ? [] : fields.filter(field => field && field.name && field.value);

  if (layout === 'components_v2') {
    return containerPayload({
      title,
      message: body,
      fields: usableFields,
      footer,
      image,
      color,
      author: authorLine
    });
  }

  const embed = { color, timestamp: new Date().toISOString() };
  if (title) embed.title = title;

  // Quién provocó el aviso, con su foto de perfil pequeña arriba del todo.
  // Es lo que hace que un registro se lea de un vistazo: se reconoce a la
  // persona antes de leer una sola línea.
  if (authorLine) {
    embed.author = { name: authorLine };
    if (showThumbnail && defaults.authorIconUrl) embed.author.icon_url = defaults.authorIconUrl;
  }

  // El administrador escribió su propio cuerpo: sustituye a los campos.
  if (body) embed.description = body;
  if (usableFields.length) embed.fields = usableFields;

  if (showThumbnail && defaults.thumbnailUrl) embed.thumbnail = { url: defaults.thumbnailUrl };
  if (image) embed.image = { url: image };
  if (footer) embed.footer = { text: footer };

  return { embeds: [embed] };
}

// Versión de las variables sin menciones, para los huecos donde Discord no
// las convierte. `<@123>` pasa a `@Nombre`, `<#123>` a `#canal`, etc.
function plainVars(vars) {
  const plain = { ...vars };
  if (typeof plain.user === 'string' && /^<@!?\d+>$/.test(plain.user)) {
    const name = plain.displayName || plain.username;
    plain.user = name ? `@${name}` : plain.userId ? `@${plain.userId}` : '';
  }
  if (typeof plain.channel === 'string' && /^<#\d+>$/.test(plain.channel)) {
    plain.channel = plain.channelName ? `#${plain.channelName}` : plain.channel;
  }
  if (typeof plain.role === 'string' && /^<@&\d+>$/.test(plain.role)) {
    plain.role = plain.roleName ? `@${plain.roleName}` : plain.role;
  }
  if (typeof plain.executor === 'string' && /^<@!?\d+>$/.test(plain.executor)) {
    plain.executor = plain.executorName ? `@${plain.executorName}` : plain.executor;
  }
  return plain;
}

// Sustituye {variables} por sus valores. Se hace aquí y no en
// EmbedTemplateService porque estas variables dependen del evento.
function substitute(text, vars) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (match, name) => {
    const value = vars[name];
    return value === undefined || value === null ? match : String(value);
  });
}

// Variables de miembro, que casi todos los registros comparten.
function memberVars(member, extra = {}) {
  const user = member?.user || member;
  return {
    user: member?.toString?.() ?? (user?.id ? `<@${user.id}>` : ''),
    username: user?.username ?? '',
    userTag: user?.tag ?? user?.username ?? '',
    displayName: member?.displayName ?? user?.username ?? '',
    userId: user?.id ?? '',
    server: member?.guild?.name ?? '',
    memberCount: member?.guild?.memberCount ?? '',
    ...extra
  };
}

module.exports = {
  CATALOG,
  CAMPOS_EDITABLES,
  FACTORY,
  factoryDefaults,
  KINDS,
  isKnownKind,
  kindInfo,
  catalogForPanel,
  isCustomised,
  effectiveTemplate,
  assetsBase,
  buildMessage,
  containerPayload,
  plainVars,
  substitute,
  memberVars
};
