const MODULE_DEFAULTS = Object.freeze({
  tiktok: true,
  twitch: true,
  youtube: true,
  welcome: true,
  goodbye: true,
  logs: true,
  boosts: true,
  deals: false,
  music: false,
  moderation: false,
  tickets: false,
  suggestions: false,
  selfroles: false,
  starboard: false
});

// ------------------------------------------------------------------
// Planes: qué tiene cada servidor
// ------------------------------------------------------------------
//
// Hay tres niveles:
//
//   free     Lo que no cuesta nada tener encendido: mensajes, registros,
//            bienvenidas, moderación y comunidad. Todo eso es reaccionar a
//            eventos que Discord ya manda.
//
//   premium  Lo que SÍ cuesta: vigilar TikTok, Twitch y YouTube significa
//            consultar cada pocos minutos, para cada cuenta, todo el día; las
//            ofertas consultan tres tiendas cada media hora; y la música
//            arranca un ffmpeg y un yt-dlp por servidor que suena. En una
//            máquina modesta, media docena de servidores con monitores se
//            comen el procesador y la cuota antes que nada.
//
//   main     Embers Void y Ankerie Dimension. Todo lo anterior más la
//            identidad propia del bot y el panel dentro de Discord.
//
// Un servidor entra en premium por `PREMIUM_GUILD_IDS` o porque el
// propietario se lo concede desde el panel (se guarda en `plan`).
const PLAN_FEATURES = Object.freeze({
  free: [
    'welcome', 'goodbye', 'boosts', 'logs', 'alerts',
    'moderation', 'tickets', 'suggestions', 'selfroles', 'starboard'
  ],
  // Lo que consume recursos, y escribir los textos del bot.
  premium: ['tiktok', 'twitch', 'youtube', 'deals', 'music', 'embeds', 'messageThemes'],
  // Lo que cambia la cara del bot o le ocupa un canal permanente.
  main: ['profile', 'discordPanel', 'brandingCommands']
});

const PREMIUM_FEATURES = Object.freeze(PLAN_FEATURES.premium);
const MAIN_ONLY_FEATURES = Object.freeze(PLAN_FEATURES.main);

function getPremiumGuildIds() {
  return csvSet(process.env.PREMIUM_GUILD_IDS);
}

/**
 * Plan de un servidor. `config` es opcional: si se pasa, se respeta el plan
 * concedido desde el panel además de la lista del entorno.
 */
function guildPlan(guildId, config = null) {
  if (isAnyMainGuild(guildId)) return 'main';
  if (getPremiumGuildIds().has(String(guildId || ''))) return 'premium';
  return config?.plan === 'premium' ? 'premium' : 'free';
}

function planIncludes(plan, feature) {
  if (PLAN_FEATURES.free.includes(feature)) return true;
  if (PLAN_FEATURES.premium.includes(feature)) return plan === 'premium' || plan === 'main';
  if (PLAN_FEATURES.main.includes(feature)) return plan === 'main';
  // Lo que no está en ninguna lista no se restringe: añadir una función nueva
  // no debe apagarla sin querer en todos los servidores.
  return true;
}

function featureAvailable(feature, guildId, config = null) {
  return planIncludes(guildPlan(guildId, config), feature);
}

// Las funciones de pago que este servidor NO tiene. Sirve para explicarlo en
// el panel en vez de limitarse a esconderlas.
function lockedFeatures(guildId, config = null) {
  const plan = guildPlan(guildId, config);
  return [...PLAN_FEATURES.premium, ...PLAN_FEATURES.main].filter(feature => !planIncludes(plan, feature));
}

// ------------------------------------------------------------------
// (documentación heredada)
// ------------------------------------------------------------------
//
// Vesper no está pensado solo para Embers Void y Ankerie Dimension: cualquiera
// puede añadirlo. Lo que cambia entre unos y otros es esto y solo esto:
//
//   TODOS los servidores tienen
//     · los 38 mensajes editables, con sus dos formatos de embed
//     · los 27 registros con interruptor, canal y mención propios
//     · los paquetes de mensajes (Void, Limones o ninguno)
//     · avisos de TikTok, Twitch y YouTube
//     · ofertas y juegos gratis
//     · moderación, comunidad, música y el panel web entero
//
//   SOLO los dos Main tienen
//     · identidad propia del bot: apodo, avatar y colores por servidor. En los
//       demás, Vesper se llama y se ve igual que su cuenta de Discord.
//     · el panel de control DENTRO de Discord (/panel y sus botones).
//     · los comandos de identidad: /branding, /setbotname, /setbotavatar,
//       /testbranding, /resetbranding.
//
// El motivo no es caprichoso: la identidad por servidor cambia el nombre y el
// avatar con los que el bot publica, y el panel de Discord ocupa un canal
// permanente. Son decisiones que afectan a cómo se ve el bot entero, y se
// reservan a los servidores de casa.
function csvSet(value) {
  return new Set(String(value || '').split(',').map(item => item.trim()).filter(Boolean));
}

function getMainGuildId() {
  return String(process.env.MAIN_GUILD_ID || process.env.GUILD_ID || '').trim();
}

function isMainGuild(guildId) {
  const mainGuildId = getMainGuildId();
  return Boolean(mainGuildId && guildId && String(guildId) === mainGuildId);
}

function getApprovedGuildIds() {
  return csvSet(process.env.APPROVED_GUILD_IDS);
}

function getThemedMainGuildIds() {
  return csvSet(process.env.THEMED_MAIN_GUILD_IDS);
}

function isThemedMainGuild(guildId) {
  return Boolean(guildId && getThemedMainGuildIds().has(String(guildId)) && !isMainGuild(guildId));
}

// Embers Void y Ankerie Dimension son ambos Main: el primero es el principal
// y el segundo un Main temático con identidad propia. Las dos tienen el mismo
// conjunto de funciones; lo único que cambia es la personalización.
function isAnyMainGuild(guildId) {
  return isMainGuild(guildId) || isThemedMainGuild(guildId);
}

function guildTier(guildId) {
  if (isMainGuild(guildId)) return 'primary_main';
  if (isThemedMainGuild(guildId)) return 'themed_main';
  if (getApprovedGuildIds().has(String(guildId || ''))) return 'satellite';
  return 'external';
}

function isApprovedGuild(guildId) {
  if (!guildId) return false;
  if (isMainGuild(guildId)) return true;
  if (isThemedMainGuild(guildId)) return true;
  const approved = getApprovedGuildIds();
  if (approved.has(String(guildId))) return true;
  return String(process.env.ALLOW_UNLISTED_GUILDS || 'false').toLowerCase() === 'true';
}

function moduleDefaults() {
  return { ...MODULE_DEFAULTS };
}

// `guildId` es opcional por compatibilidad con las llamadas antiguas. Cuando
// se pasa, un módulo de pago queda apagado en un servidor que no lo tenga,
// aunque su configuración diga que está activo: así, si alguien pierde el
// plan, los monitores dejan de consultar sin tener que tocar nada.
function isModuleEnabledConfig(config, moduleName, guildId = null) {
  if (!Object.hasOwn(MODULE_DEFAULTS, moduleName)) return false;
  if (guildId && !featureAvailable(moduleName, guildId, config)) return false;
  const configured = config?.features?.[moduleName];
  return configured === undefined ? MODULE_DEFAULTS[moduleName] : configured === true;
}

function commandAvailable(command, guildId) {
  const scope = command?.scope || 'all';
  if (!isApprovedGuild(guildId)) return false;
  // 'main' significa «cualquier Main», principal o temático.
  if (scope === 'main') return isAnyMainGuild(guildId);
  // 'primary_main' queda para lo que solo tiene sentido en Embers Void.
  if (scope === 'primary_main') return isMainGuild(guildId);
  if (scope === 'themed_main') return isThemedMainGuild(guildId);
  if (scope === 'satellite') return guildTier(guildId) === 'satellite';
  return true;
}

module.exports = {
  MODULE_DEFAULTS,
  csvSet,
  getMainGuildId,
  getApprovedGuildIds,
  getThemedMainGuildIds,
  isMainGuild,
  isThemedMainGuild,
  isAnyMainGuild,
  PLAN_FEATURES,
  PREMIUM_FEATURES,
  MAIN_ONLY_FEATURES,
  getPremiumGuildIds,
  guildPlan,
  planIncludes,
  featureAvailable,
  lockedFeatures,
  guildTier,
  isApprovedGuild,
  moduleDefaults,
  isModuleEnabledConfig,
  commandAvailable
};
