// src/core/AlertRouter.js
//
// Decide, para cada aviso que publica Vesper, tres cosas:
//
//   1. si se publica o no,
//   2. en qué canal,
//   3. a quién se menciona.
//
// Antes esto estaba repartido por los eventos: cada uno leía
// `general.logChannel` a mano y publicaba siempre que el módulo estuviera
// activo. Eso dejaba dos huecos: no se podía apagar un registro suelto sin
// apagar el módulo entero, y no se podía mandar unos avisos a un canal y
// otros a otro. Ahora todo pasa por aquí, y el panel lo controla.

const { KINDS, kindInfo, isKnownKind } = require('./EmbedCatalog');
const { isModuleEnabledConfig } = require('../config/guildPolicy');

// De qué canal tira cada aviso cuando no tiene uno propio, y qué módulo lo
// enciende. `module: null` significa que no depende de ningún módulo.
const ROUTES = Object.freeze({
  welcome: { channel: 'welcomeChannel', module: 'welcome' },
  goodbye: { channel: 'goodbyeChannel', module: 'goodbye' },

  boost_started: { channel: 'boostChannel', fallback: ['welcomeChannel', 'logChannel'], module: 'boosts' },
  boost_stopped: { channel: 'boostChannel', fallback: ['logChannel'], module: 'boosts' },
  boost_level: { channel: 'boostChannel', fallback: ['logChannel'], module: 'boosts' },

  log_bot_join: { channel: 'botLogChannel', fallback: ['logChannel'], module: 'logs' },
  log_bot_leave: { channel: 'botLogChannel', fallback: ['logChannel'], module: 'logs' },

  log_member_join: { channel: 'logChannel', module: 'logs' },
  log_member_leave: { channel: 'logChannel', module: 'logs' },
  log_nickname: { channel: 'logChannel', module: 'logs' },
  log_roles_added: { channel: 'logChannel', module: 'logs' },
  log_roles_removed: { channel: 'logChannel', module: 'logs' },

  log_timeout_on: { channel: 'logChannel', module: 'logs' },
  log_timeout_off: { channel: 'logChannel', module: 'logs' },
  log_ban_added: { channel: 'logChannel', module: 'logs' },
  log_ban_removed: { channel: 'logChannel', module: 'logs' },
  automod_notice: { channel: null, module: 'moderation' },
  automod_dm: { channel: null, module: 'moderation' },

  log_message_deleted: { channel: 'logChannel', module: 'logs' },
  log_message_edited: { channel: 'logChannel', module: 'logs' },
  log_messages_purged: { channel: 'logChannel', module: 'logs' },
  log_channel_created: { channel: 'logChannel', module: 'logs' },
  log_channel_deleted: { channel: 'logChannel', module: 'logs' },
  log_role_created: { channel: 'logChannel', module: 'logs' },
  log_role_deleted: { channel: 'logChannel', module: 'logs' },
  log_thread_created: { channel: 'logChannel', module: 'logs' },
  log_voice_join: { channel: 'logChannel', module: 'logs' },
  log_voice_leave: { channel: 'logChannel', module: 'logs' },
  log_voice_move: { channel: 'logChannel', module: 'logs' },

  notify_twitch_live: { channel: null, module: 'twitch' },
  notify_youtube_live: { channel: null, module: 'youtube' },
  notify_youtube_video: { channel: null, module: 'youtube' },
  notify_youtube_short: { channel: null, module: 'youtube' },
  notify_tiktok_live: { channel: null, module: 'tiktok' },
  notify_tiktok_video: { channel: null, module: 'tiktok' },

  deal_epic_free: { channel: null, module: 'deals' },
  deal_steam_special: { channel: null, module: 'deals' },
  deal_giveaway: { channel: null, module: 'deals' }
});

// Los avisos que el panel deja encender, apagar y redirigir uno a uno. Los
// que tienen su propio canal en otra pantalla (redes, ofertas) se configuran
// allí y no aparecen aquí.
const ROUTABLE = Object.freeze(KINDS.filter(kind => ROUTES[kind]?.channel));

function storedAlert(config, kind) {
  const stored = config?.alerts?.[kind];
  return stored && typeof stored === 'object' ? stored : {};
}

/**
 * Qué hace este servidor con este aviso concreto.
 *
 * `enabled` sin valor significa «lo que diga el módulo», que es como se
 * comportaba el bot antes de que esto existiera: así, un servidor que no ha
 * tocado nada sigue publicando exactamente lo mismo.
 */
function alertSettings(config, kind) {
  const route = ROUTES[kind] || {};
  const stored = storedAlert(config, kind);
  const moduleOn = route.module ? isModuleEnabledConfig(config, route.module) : true;
  const enabled = stored.enabled === undefined || stored.enabled === null ? moduleOn : Boolean(stored.enabled);

  return {
    kind,
    label: kindInfo(kind)?.label || kind,
    group: kindInfo(kind)?.group || 'Otros',
    module: route.module || null,
    moduleEnabled: moduleOn,
    enabled: enabled && moduleOn,
    // Si el módulo está apagado, el interruptor propio no puede encenderlo:
    // se dice para que el panel lo explique en vez de mentir.
    blockedByModule: Boolean(stored.enabled) && !moduleOn,
    overridden: stored.enabled !== undefined && stored.enabled !== null,
    channelId: stored.channel || null,
    defaultChannelKey: route.channel || null,
    fallbackChannelKeys: route.fallback || [],
    pingRole: stored.ping || null
  };
}

// El canal donde acaba publicándose: el suyo propio, si no el de su grupo, y
// si no el general de registros.
function resolveChannelId(config, kind) {
  const settings = alertSettings(config, kind);
  if (settings.channelId) return settings.channelId;
  const general = config?.general || {};
  // Se prueba el canal propio del aviso, luego el de su grupo, y por último
  // el general de registros: así nunca se pierde un aviso por no haber
  // elegido un canal específico.
  for (const key of [settings.defaultChannelKey, ...settings.fallbackChannelKeys]) {
    if (key && general[key]) return general[key];
  }
  return null;
}

function resolveChannel(guild, config, kind) {
  const channelId = resolveChannelId(config, kind);
  if (!channelId) return null;
  return guild?.channels?.cache?.get(channelId) || null;
}

/**
 * Publica un aviso respetando la configuración. Devuelve lo que se hizo, para
 * que la auditoría del panel pueda explicar por qué algo no salió.
 */
async function deliver(guild, config, kind, payload, send) {
  if (!isKnownKind(kind)) return { published: false, reason: 'desconocido' };
  const settings = alertSettings(config, kind);
  if (!settings.enabled) {
    return { published: false, reason: settings.blockedByModule ? 'modulo-apagado' : 'apagado' };
  }
  const channel = resolveChannel(guild, config, kind);
  if (!channel) return { published: false, reason: 'sin-canal' };

  const body = settings.pingRole
    ? { ...payload, content: [`<@&${settings.pingRole}>`, payload.content].filter(Boolean).join(' ') }
    : payload;
  const allowed = settings.pingRole ? { roles: [settings.pingRole], parse: [] } : undefined;

  const result = await send(channel, allowed ? { ...body, allowedMentions: allowed } : body);
  return { published: result !== null && result !== undefined, channelId: channel.id, reason: null };
}

/**
 * Atajo que usan los eventos: construye el mensaje con el catálogo y lo
 * publica donde toque, si toca. Devuelve `null` cuando el aviso está apagado
 * o no tiene canal, para que el evento no tenga que comprobar nada.
 */
async function publishAlert(guild, config, kind, options = {}) {
  const settings = alertSettings(config, kind);
  if (!settings.enabled) return null;
  const channel = resolveChannel(guild, config, kind);
  if (!channel) return null;

  const { buildMessage } = require('./EmbedCatalog');
  const { sendBrandedMessage } = require('../utils/webhookSender');
  const payload = buildMessage(kind, { config, ...options });

  const body = settings.pingRole
    ? {
      ...payload,
      content: [`<@&${settings.pingRole}>`, payload.content].filter(Boolean).join(' '),
      allowedMentions: { roles: [settings.pingRole], parse: [] }
    }
    : payload;

  return sendBrandedMessage(channel, body);
}

// Resumen para la pantalla de registros del panel.
function alertOverview(config) {
  const groups = new Map();
  for (const kind of ROUTABLE) {
    const settings = alertSettings(config, kind);
    if (!groups.has(settings.group)) groups.set(settings.group, []);
    groups.get(settings.group).push({
      ...settings,
      effectiveChannelId: resolveChannelId(config, kind)
    });
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }));
}

module.exports = {
  ROUTES,
  ROUTABLE,
  alertSettings,
  resolveChannelId,
  resolveChannel,
  deliver,
  publishAlert,
  alertOverview
};
