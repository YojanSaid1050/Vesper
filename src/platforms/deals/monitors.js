// src/platforms/deals/monitors.js
//
// Publica ofertas y juegos gratis en el canal que cada servidor configure.
// Igual que el resto de monitores: recorre los servidores aprobados, consulta
// las fuentes UNA vez por ciclo (no una por servidor) y recuerda lo ya enviado
// para no repetirse.

const { getAllGuildConfigs } = require('../../database/mongoManager');
const PersistentStateStore = require('../../core/PersistentStateStore');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { buildMessage } = require('../../core/EmbedCatalog');
const { isModuleEnabledConfig } = require('../../config/guildPolicy');
const { monitor, monitorError } = require('../../utils/logger');
const { fetchEpicFreeGames, fetchGiveaways, fetchSteamSpecials } = require('./sources');

const stateStore = new PersistentStateStore('deals');
const running = new Set();

// Las ofertas duran días; no hace falta recordar más de un mes.
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_PER_CYCLE = 5;

function dealsConfig(config) {
  const deals = config.deals || {};
  return {
    channel: deals.channel || null,
    pingRole: deals.pingRole || null,
    epicFree: deals.epicFree !== false,
    giveaways: deals.giveaways !== false,
    steamSpecials: deals.steamSpecials === true,
    minDiscount: Math.min(95, Math.max(10, Number(deals.minDiscount) || 50)),
    giveawayPlatforms: Array.isArray(deals.giveawayPlatforms) ? deals.giveawayPlatforms : ['steam', 'epic-games-store', 'gog'],
    maxPerCycle: Math.min(10, Math.max(1, Number(deals.maxPerCycle) || DEFAULT_MAX_PER_CYCLE)),
    country: deals.country || 'ES',
    locale: deals.locale || 'es-ES'
  };
}

function collectEligibleGuilds(guilds) {
  const eligible = [];
  for (const [guildId, config] of Object.entries(guilds)) {
    if (!isModuleEnabledConfig(config, 'deals', guildId)) continue;
    const settings = dealsConfig(config);
    if (!settings.channel) continue;
    eligible.push({ guildId, config, settings });
  }
  return eligible;
}

// Las fuentes se consultan una sola vez por ciclo y se reparten entre los
// servidores, en lugar de repetir la misma petición por cada uno.
async function gatherOffers(settingsList) {
  const wantsEpic = settingsList.some(settings => settings.epicFree);
  const wantsGiveaways = settingsList.some(settings => settings.giveaways);
  const wantsSteam = settingsList.some(settings => settings.steamSpecials);

  const country = settingsList[0]?.country || 'ES';
  const locale = settingsList[0]?.locale || 'es-ES';
  const lowestDiscount = Math.min(...settingsList.filter(s => s.steamSpecials).map(s => s.minDiscount), 95);
  const platforms = [...new Set(settingsList.flatMap(settings => settings.giveawayPlatforms))];

  const [epic, giveaways, steam] = await Promise.all([
    wantsEpic ? fetchEpicFreeGames({ country, locale }).catch(error => {
      monitorError('Ofertas', 'Epic', null, error);
      return [];
    }) : [],
    wantsGiveaways ? fetchGiveaways({ platforms, types: ['game'] }).catch(error => {
      monitorError('Ofertas', 'GamerPower', null, error);
      return [];
    }) : [],
    wantsSteam ? fetchSteamSpecials({ minDiscount: lowestDiscount }).catch(error => {
      monitorError('Ofertas', 'Steam', null, error);
      return [];
    }) : []
  ]);

  return { epic, giveaways, steam };
}

function offerAppliesTo(offer, settings) {
  if (offer.source === 'epic') return settings.epicFree;
  if (offer.source === 'giveaway') return settings.giveaways;
  if (offer.source === 'steam') return settings.steamSpecials && offer.discount >= settings.minDiscount;
  return false;
}

function buildPayload(offer, config, pingText) {
  // Una fecha relativa de Discord: «en 3 días», y se actualiza sola.
  const endsAt = offer.endsAt
    ? `<t:${Math.floor(new Date(offer.endsAt).getTime() / 1000)}:R>`
    : 'sin fecha de cierre';

  const kind = offer.source === 'epic'
    ? 'deal_epic_free'
    : offer.source === 'steam' ? 'deal_steam_special' : 'deal_giveaway';

  // El texto lo escribe el catálogo, no este archivo: así el aviso sale igual
  // que en la vista previa del panel y se puede cambiar desde la web. Aquí
  // solo se aportan los datos y la carátula del juego.
  const defaults = { image: offer.image };
  // El juego de la semana siguiente todavía no se puede reclamar: decir
  // «Ahora: gratis» ahí manda a la gente a una tienda donde aún cuesta.
  if (offer.source === 'epic' && offer.upcoming) {
    defaults.title = `Pronto gratis en Epic: ${offer.title}`;
    defaults.description = 'Precio habitual: {originalPrice}\nTodavía no se puede reclamar.\nEmpieza: {endsAt}\n\n{url}';
  }

  const payload = buildMessage(kind, {
    config,
    vars: {
      title: offer.title,
      url: offer.url,
      store: offer.store,
      endsAt,
      price: offer.finalPrice || 'gratis',
      originalPrice: offer.originalPrice || 'sin precio publicado',
      discount: offer.discount ?? 100,
      worth: offer.worth || 'sin precio publicado',
      platforms: offer.platforms || offer.store || 'varias tiendas'
    },
    defaults
  });

  if (payload.embeds?.[0] && offer.url) payload.embeds[0].url = offer.url;
  if (pingText) payload.content = pingText;
  return payload;
}

async function monitorDeals(client) {
  if (running.has('deals')) return { success: false, reason: 'already_running' };
  running.add('deals');

  try {
    const startedAt = Date.now();
    const guilds = await getAllGuildConfigs({ approvedOnly: true });
    const eligible = collectEligibleGuilds(guilds);
    if (eligible.length === 0) {
      return { success: true, guilds: 0, offers: 0, skipped: 'not_configured' };
    }

    const { epic, giveaways, steam } = await gatherOffers(eligible.map(entry => entry.settings));
    const allOffers = [...epic, ...giveaways, ...steam];
    if (allOffers.length === 0) {
      return { success: true, guilds: eligible.length, offers: 0 };
    }

    const sent = await stateStore.load('sent', {});
    const now = Date.now();
    // Se olvidan las ofertas antiguas para que el archivo no crezca sin fin.
    for (const [key, timestamp] of Object.entries(sent)) {
      if (now - Number(timestamp) > REMEMBER_MS) delete sent[key];
    }

    let published = 0;
    let errors = 0;

    for (const { guildId, config, settings } of eligible) {
      const channel = await client.channels.fetch(settings.channel).catch(() => null);
      if (!channel?.guild) {
        errors++;
        monitorError('Ofertas', 'Canal', guildId, new Error(`Canal ${settings.channel} no disponible`));
        continue;
      }

      const pingText = settings.pingRole ? `<@&${settings.pingRole}>` : '';
      const pending = allOffers
        .filter(offer => offerAppliesTo(offer, settings))
        .filter(offer => !sent[`${guildId}:${offer.id}`])
        .slice(0, settings.maxPerCycle);

      for (const offer of pending) {
        try {
          await sendBrandedMessage(channel, buildPayload(offer, config, pingText));
          sent[`${guildId}:${offer.id}`] = now;
          published++;
        } catch (error) {
          errors++;
          monitorError('Ofertas', 'Envío', guildId, error);
        }
      }
    }

    await stateStore.save('sent', sent);
    monitor('Ofertas', 'Ciclo completado', null, {
      guilds: eligible.length,
      disponibles: allOffers.length,
      publicadas: published,
      errors,
      duration: `${Date.now() - startedAt}ms`
    });

    return { success: true, guilds: eligible.length, offers: published, errors };
  } catch (error) {
    monitorError('Ofertas', 'Fatal', null, error);
    throw error;
  } finally {
    running.delete('deals');
  }
}

async function getMonitorStats() {
  const sent = await stateStore.load('sent', {});
  return { entries: Object.keys(sent).length };
}

async function clearGuildCache(guildId) {
  const sent = await stateStore.load('sent', {});
  for (const key of Object.keys(sent)) {
    if (key.startsWith(`${guildId}:`)) delete sent[key];
  }
  await stateStore.save('sent', sent);
}

module.exports = { monitorDeals, getMonitorStats, clearGuildCache, dealsConfig, buildPayload, collectEligibleGuilds };
