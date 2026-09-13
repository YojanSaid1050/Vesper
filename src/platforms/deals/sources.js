// src/platforms/deals/sources.js
//
// Fuentes de ofertas y juegos gratis. Las tres son públicas y NO necesitan
// clave, cuenta ni créditos:
//
//   · Epic Games  → endpoint público de su tienda (el mismo que usa la web).
//   · GamerPower  → API abierta que agrega sorteos y juegos gratis de Steam,
//                   Epic, GOG, Ubisoft, itch.io y demás. Sin autenticación.
//   · Steam       → endpoint de la portada de la tienda. Es la API interna que
//                   usa la propia web de Steam: no está documentada, así que
//                   aquí se lee de forma defensiva y, si cambia de forma, el
//                   módulo se calla en vez de romperse.

const EPIC_URL = 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions';
const GAMERPOWER_URL = 'https://www.gamerpower.com/api/giveaways';
const STEAM_URL = 'https://store.steampowered.com/api/featuredcategories';

const REQUEST_TIMEOUT_MS = Math.max(5_000, Number(process.env.DEALS_REQUEST_TIMEOUT_MS || 15_000));
const USER_AGENT = 'Vesper-Bot/2.9 (+https://github.com/YojanSaid1050/Vesper)';

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function firstImage(images = [], preferred = ['OfferImageWide', 'DieselStoreFrontWide', 'Thumbnail', 'OfferImageTall']) {
  for (const type of preferred) {
    const found = images.find(image => image?.type === type && image?.url);
    if (found) return found.url;
  }
  return images.find(image => image?.url)?.url || null;
}

// --------------------------------------------------------------------------
// Epic Games: juegos gratis de la semana
// --------------------------------------------------------------------------

function epicStoreUrl(element, locale) {
  const slug = element.productSlug
    || element.catalogNs?.mappings?.find(mapping => mapping?.pageSlug)?.pageSlug
    || element.urlSlug;
  if (!slug) return 'https://store.epicgames.com/es-ES/free-games';
  const clean = String(slug).replace(/\/home$/, '');
  return `https://store.epicgames.com/${locale}/p/${clean}`;
}

async function fetchEpicFreeGames({ country = 'ES', locale = 'es-ES' } = {}) {
  const params = new URLSearchParams({ locale, country, allowCountries: country });
  const data = await fetchJson(`${EPIC_URL}?${params}`);
  const elements = data?.data?.Catalog?.searchStore?.elements;
  if (!Array.isArray(elements)) throw new Error('Epic devolvió un catálogo con una forma inesperada');

  const results = [];
  for (const element of elements) {
    // Un juego está regalado ahora si tiene una promoción activa cuyo descuento
    // deja el precio en cero. `promotionalOffers` son las activas y
    // `upcomingPromotionalOffers` las que empiezan más adelante.
    const active = element.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0];
    const upcoming = element.promotions?.upcomingPromotionalOffers?.[0]?.promotionalOffers?.[0];
    const offer = active || upcoming;
    if (!offer) continue;

    const percentage = offer.discountSetting?.discountPercentage;
    // Epic usa 0 para "gratis" en discountPercentage. Si no viene, se acepta
    // igualmente cuando el precio con descuento es cero.
    const discountPrice = element.price?.totalPrice?.discountPrice;
    const isFree = percentage === 0 || discountPrice === 0;
    if (!isFree) continue;

    results.push({
      source: 'epic',
      id: `epic:${element.id || element.productSlug || element.title}:${offer.startDate || ''}`,
      title: element.title,
      description: element.description || '',
      url: epicStoreUrl(element, locale),
      image: firstImage(element.keyImages || []),
      startsAt: offer.startDate || null,
      endsAt: offer.endDate || null,
      upcoming: !active,
      originalPrice: element.price?.totalPrice?.fmtPrice?.originalPrice || null,
      store: 'Epic Games Store'
    });
  }
  return results;
}

// --------------------------------------------------------------------------
// GamerPower: sorteos y juegos gratis de todas las tiendas
// --------------------------------------------------------------------------

async function fetchGiveaways({ platforms = [], types = ['game'] } = {}) {
  const params = new URLSearchParams();
  if (platforms.length) params.set('platform', platforms.join('.'));
  if (types.length) params.set('type', types.join('.'));
  params.set('sort-by', 'date');

  const query = params.toString();
  const data = await fetchJson(query ? `${GAMERPOWER_URL}?${query}` : GAMERPOWER_URL);
  // Cuando no hay nada activo, GamerPower responde un objeto de estado en vez
  // de una lista. No es un error: simplemente no hay sorteos.
  if (!Array.isArray(data)) return [];

  return data
    .filter(item => item && item.id && item.title)
    .map(item => ({
      source: 'giveaway',
      id: `giveaway:${item.id}`,
      title: item.title,
      description: item.description || '',
      url: item.open_giveaway_url || item.gamerpower_url,
      image: item.image || item.thumbnail || null,
      endsAt: item.end_date && item.end_date !== 'N/A' ? item.end_date : null,
      worth: item.worth && item.worth !== 'N/A' ? item.worth : null,
      platforms: item.platforms || '',
      type: item.type || 'Game',
      store: (item.platforms || 'PC').split(',')[0].trim()
    }));
}

// --------------------------------------------------------------------------
// Steam: ofertas de la portada
// --------------------------------------------------------------------------

function steamPrice(cents, currency) {
  if (typeof cents !== 'number') return null;
  const amount = (cents / 100).toFixed(2);
  return currency ? `${amount} ${currency}` : amount;
}

async function fetchSteamSpecials({ country = 'CO', language = 'spanish', minDiscount = 50 } = {}) {
  const params = new URLSearchParams({ cc: country, l: language });
  const data = await fetchJson(`${STEAM_URL}?${params}`);
  const items = data?.specials?.items;
  if (!Array.isArray(items)) throw new Error('Steam devolvió una portada con una forma inesperada');

  return items
    .filter(item => item && item.id && item.discounted && Number(item.discount_percent) >= minDiscount)
    .map(item => ({
      source: 'steam',
      id: `steam:${item.id}:${item.discount_percent}`,
      appId: item.id,
      title: item.name,
      description: '',
      url: `https://store.steampowered.com/app/${item.id}/`,
      image: item.large_capsule_image || item.header_image || null,
      discount: Number(item.discount_percent),
      originalPrice: steamPrice(item.original_price, item.currency),
      finalPrice: Number(item.final_price) === 0 ? 'Gratis' : steamPrice(item.final_price, item.currency),
      endsAt: item.discount_expiration ? new Date(item.discount_expiration * 1000).toISOString() : null,
      store: 'Steam'
    }));
}

module.exports = {
  EPIC_URL,
  GAMERPOWER_URL,
  STEAM_URL,
  fetchEpicFreeGames,
  fetchGiveaways,
  fetchSteamSpecials,
  epicStoreUrl,
  steamPrice,
  firstImage
};
