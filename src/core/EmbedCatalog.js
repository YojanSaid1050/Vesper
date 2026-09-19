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
    variables: [...MEMBER_VARS, ['{role}', 'rol asignado automáticamente']], supports: FULL
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
    variables: [...MEMBER_VARS, ...ACTOR_VARS], supports: FULL
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
    variables: [...SERVER_VARS, ...CHANNEL_VARS, ...ACTOR_VARS], supports: NO_THUMB
  },
  log_channel_deleted: {
    group: 'Registro del servidor', label: 'Canal eliminado',
    description: 'Cuando se elimina un canal.',
    variables: [...SERVER_VARS, ...CHANNEL_VARS, ...ACTOR_VARS], supports: NO_THUMB
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
    variables: [...SERVER_VARS, ...CHANNEL_VARS, ['{thread}', 'hilo creado'], ['{owner}', 'quién lo abrió']], supports: NO_THUMB
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
  }
});


// Valores con los que sale cada mensaje si no hay nada configurado.
//
// `fields` son los recuadros que el aviso publica de verdad (quién, dónde,
// cuándo). No se usan para publicar —de eso se encargan los eventos, que
// tienen los datos reales— sino para que el panel pueda enseñar en la vista
// previa el mensaje tal y como va a salir, en lugar de un texto que diga «se
// conservan los campos originales». Si cambias un campo en un evento,
// cámbialo también aquí para que la vista previa no mienta.
//
// Los de bienvenida y despedida no están: dependen del servidor y los calcula
// el backend a partir del código que los publica.
const FACTORY = Object.freeze({
  boost_started: {
    title: '💜 ¡Gracias por el boost!',
    message: '{user} acaba de mejorar **{server}**. Ya vamos por {boostCount} boosts (nivel {boostLevel}).',
    color: '#F47FFF'
  },
  boost_stopped: {
    title: '💔 Boost retirado',
    message: '{userTag} dejó de mejorar el servidor. Quedan {boostCount} boosts.',
    color: '#747F8D'
  },
  boost_level: {
    title: '🚀 Nuevo nivel de mejora',
    message: '**{server}** alcanzó el nivel {boostLevel} con {boostCount} boosts. ¡Gracias a quienes lo hicieron posible!',
    color: '#F47FFF'
  },

  log_member_join: {
    title: '📥 Miembro entró', color: '#57F287',
    fields: [['👤 Usuario', '{userTag}'], ['🆔 ID', '{userId}']]
  },
  log_member_leave: {
    title: '📤 Miembro salió', color: '#ED4245',
    fields: [['👤 Usuario', '{userTag}'], ['🆔 ID', '{userId}']]
  },
  log_bot_join: {
    title: '🤖 Bot añadido', color: '#5865F2',
    fields: [['🤖 Bot', '{userTag}'], ['🆔 ID', '{userId}'], ['🎭 Rol añadido', '{role}']]
  },
  log_bot_leave: {
    title: '🤖 Bot retirado', color: '#ED4245',
    fields: [['🤖 Bot', '{userTag}'], ['🆔 ID', '{userId}']]
  },
  log_nickname: {
    title: '📝 Apodo cambiado', color: '#00B0F4',
    fields: [['👤 Usuario', '{userTag}'], ['📌 Antes', '{before}'], ['📌 Después', '{after}']]
  },
  log_roles_added: {
    title: '🎭 Roles añadidos', color: '#57F287',
    fields: [['👤 Usuario', '{userTag}'], ['🎭 Roles', '{roles}']]
  },
  log_roles_removed: {
    title: '❌ Roles retirados', color: '#ED4245',
    fields: [['👤 Usuario', '{userTag}'], ['🎭 Roles', '{roles}']]
  },

  log_timeout_on: {
    title: '🔇 Miembro aislado', color: '#ED4245',
    fields: [['👤 Usuario', '{userTag}'], ['🛠️ Timeout por', '{executor}'], ['📅 Hasta', '{until}'], ['📝 Razón', '{reason}']]
  },
  log_timeout_off: {
    title: '🔊 Aislamiento retirado', color: '#57F287',
    fields: [['👤 Usuario', '{userTag}'], ['🛠️ Removido por', '{executor}']]
  },
  log_ban_added: {
    title: '🔨 Miembro baneado', color: '#ED4245',
    fields: [['👤 Usuario', '{userTag}'], ['🛠️ Baneado por', '{executor}']]
  },
  log_ban_removed: {
    title: '🔓 Baneo retirado', color: '#57F287',
    fields: [['👤 Usuario', '{userTag}'], ['🛠️ Desbaneado por', '{executor}']]
  },
  automod_notice: { message: '{user}, tu mensaje fue retirado: {reason}. Caso **#{case}**.' },
  automod_dm: { message: 'Recibiste una advertencia en **{server}**.\nMotivo: {reason}\nCaso: **#{case}**' },

  log_message_deleted: {
    title: '🗑️ Mensaje borrado', color: '#ED4245',
    fields: [['👤 Usuario', '{userTag}'], ['🛠️ Eliminado por', '{executor}'], ['📍 Canal', '{channel}'], ['💬 Contenido', '{content}']]
  },
  log_message_edited: {
    title: '✏️ Mensaje editado', color: '#FAA61A',
    fields: [['👤 Usuario', '{userTag}'], ['📍 Canal', '{channel}'], ['📌 Antes', '{before}'], ['📌 Después', '{after}']]
  },
  log_channel_created: {
    title: '📁 Canal creado', color: '#57F287',
    fields: [['📌 Canal', '{channel}'], ['📂 Tipo', 'Texto'], ['🛠️ Creado por', '{executor}']]
  },
  log_channel_deleted: {
    title: '🗑️ Canal borrado', color: '#ED4245',
    fields: [['📌 Canal', '{channelName}'], ['📂 Tipo', 'Texto'], ['🛠️ Eliminado por', '{executor}']]
  },
  log_role_created: {
    title: '🎭 Rol creado', color: '#57F287',
    fields: [['🎭 Rol', '{role}'], ['🆔 ID', '{roleId}']]
  },
  log_role_deleted: {
    title: '❌ Rol borrado', color: '#FF4D4D',
    fields: [['🎭 Rol', '{roleName}'], ['🛠️ Eliminado por', '{executor}']]
  },
  log_voice_join: {
    title: '🔊 Entró a voz', color: '#57F287',
    fields: [['👤 Usuario', '{userTag}'], ['🎤 Canal', '{channel}']]
  },
  log_voice_leave: {
    title: '📴 Salió de voz', color: '#ED4245',
    fields: [['👤 Usuario', '{userTag}'], ['🎤 Canal', '{channel}']]
  },
  log_voice_move: {
    title: '🔄 Cambió de canal de voz', color: '#5865F2',
    fields: [['👤 Usuario', '{userTag}'], ['⬅️ De', '{from}'], ['➡️ A', '{to}']]
  },
  log_messages_purged: {
    title: '🧹 Mensajes purgados', color: '#FAA61A',
    fields: [['📍 Canal', '{channel}'], ['🔢 Cantidad', '{count}']]
  },
  log_thread_created: {
    title: '🧵 Hilo creado', color: '#57F287',
    fields: [['🧵 Hilo', '{thread}'], ['📍 En', '{channel}'], ['👤 Creado por', '{owner}']]
  },

  notify_twitch_live: { title: '{creator} está en directo en Twitch', message: '**{title}**\n{url}', color: '#9146FF' },
  notify_youtube_live: { title: '{creator} está en directo en YouTube', message: '**{title}**\n{url}', color: '#FF0000' },
  notify_youtube_video: { title: 'Nuevo video de {creator}', message: '**{title}**\n{url}', color: '#FF0000' },
  notify_youtube_short: { title: 'Nuevo short de {creator}', message: '**{title}**\n{url}', color: '#FF0000' },
  notify_tiktok_live: { title: '{creator} está en directo en TikTok', message: '**{title}**\n{url}', color: '#1E90FF' },
  notify_tiktok_video: { title: 'Nuevo video de {creator}', message: '**{title}**\n{url}', color: '#1E90FF' },
  deal_epic_free: { title: '🎁 Gratis en Epic: {title}', message: 'Gratis hasta {endsAt}.\n{url}', color: '#2A2A2A' },
  deal_steam_special: { title: '🏷️ {discount}% de descuento: {title}', message: 'De {originalPrice} a **{price}**.\n{url}', color: '#1B2838' },
  deal_giveaway: { title: '🎉 {title}', message: 'Valorado en {worth}.\n{url}', color: '#57F287' }
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
function catalogForPanel(defaultLayouts = {}) {
  const groups = new Map();
  for (const [id, entry] of Object.entries(CATALOG)) {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group).push({
      id,
      label: entry.label,
      description: entry.description,
      variables: entry.variables,
      supports: entry.supports,
      plainText: Boolean(entry.plainText),
      defaultLayout: defaultLayouts[id] === 'components_v2' ? 'components_v2' : 'classic',
      factory: factoryDefaults(id)
    });
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }));
}

function storedTemplate(config, kind) {
  const stored = config?.embeds?.[kind];
  return stored && typeof stored === 'object' ? stored : {};
}

// ¿Tiene este mensaje alguna personalización guardada?
function isCustomised(config, kind) {
  const stored = storedTemplate(config, kind);
  return ['title', 'message', 'footer', 'image', 'color', 'layout'].some(field => stored[field]);
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
function buildMessage(kind, { config, vars = {}, defaults = {}, fields = [] } = {}) {
  const stored = storedTemplate(config, kind);
  const entry = CATALOG[kind];

  // Un campo vacío o en blanco significa "usa el valor original", no "déjalo
  // en blanco": así el editor puede vaciarse para volver al diseño de fábrica.
  const resolve = (value, table = vars) => {
    if (value === null || value === undefined) return null;
    const text = String(value);
    return text.trim() ? substitute(text, table) : null;
  };

  // El título y el pie de un embed clásico no convierten <@123…> en una
  // mención: sale el número en bruto. En esos huecos se usa el nombre.
  const layoutNow = normalizeLayout(stored.layout, defaults.layout);
  const flat = rendersMentions('title', layoutNow) ? vars : plainVars(vars);

  const title = resolve(stored.title, flat) ?? defaults.title ?? null;
  const message = resolve(stored.message);
  const footer = resolve(stored.footer, flat) ?? defaults.footer ?? null;
  const image = imageUrl(stored.image) ?? defaults.image ?? null;
  const color = colorNumber(stored.color, colorNumber(defaults.color, 0x5865F2));
  const showThumbnail = stored.thumbnail === undefined || stored.thumbnail === null
    ? defaults.thumbnail !== false
    : stored.thumbnail !== false;

  // Mensajes que no son embed (avisos de automoderación y MD de advertencia).
  if (entry?.plainText) {
    return { content: message ?? substitute(defaults.message || '', vars) };
  }

  // El administrador elige con qué forma sale el mensaje. Si no ha elegido
  // ninguna, se usa la de fábrica de ese mensaje en ese servidor, así que
  // nada cambia hasta que se toca el selector a propósito.
  const layout = layoutNow;

  const body = message
    ?? (defaults.description ? substitute(defaults.description, vars) : null);
  const usableFields = message ? [] : fields.filter(field => field && field.name && field.value);

  if (layout === 'components_v2') {
    return containerPayload({
      title,
      message: body,
      fields: usableFields,
      footer,
      image,
      color
    });
  }

  const embed = { color, timestamp: new Date().toISOString() };
  if (title) embed.title = title;

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
  FACTORY,
  factoryDefaults,
  KINDS,
  isKnownKind,
  kindInfo,
  catalogForPanel,
  isCustomised,
  buildMessage,
  containerPayload,
  plainVars,
  substitute,
  memberVars
};
