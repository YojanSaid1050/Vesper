const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MAIN_GUILD_ID = process.env.MAIN_GUILD_ID || 'main';

const sources = require('../src/platforms/deals/sources');
const { dealsConfig, buildPayload, collectEligibleGuilds } = require('../src/platforms/deals/monitors');

// Las tres fuentes se consultan por HTTP. Aquí se sustituye fetch para probar
// el análisis de la respuesta sin salir a internet.
function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return Promise.resolve(run()).finally(() => { globalThis.fetch = original; });
}

const jsonResponse = payload => ({ ok: true, status: 200, json: async () => payload });

test('Epic: distingue el juego gratis de esta semana del de la siguiente', async () => {
  const payload = {
    data: { Catalog: { searchStore: { elements: [
      {
        id: 'a1', title: 'Juego Actual', description: 'Gratis ahora',
        productSlug: 'juego-actual',
        keyImages: [{ type: 'OfferImageWide', url: 'https://cdn.epic/a.jpg' }],
        price: { totalPrice: { discountPrice: 0, fmtPrice: { originalPrice: '19,99 €' } } },
        promotions: { promotionalOffers: [{ promotionalOffers: [{ startDate: '2026-09-10T15:00:00.000Z', endDate: '2026-09-17T15:00:00.000Z', discountSetting: { discountPercentage: 0 } }] }] }
      },
      {
        id: 'a2', title: 'Juego Futuro', description: 'Gratis pronto',
        productSlug: 'juego-futuro', keyImages: [],
        price: { totalPrice: { discountPrice: 0 } },
        promotions: { upcomingPromotionalOffers: [{ promotionalOffers: [{ startDate: '2026-09-17T15:00:00.000Z', endDate: '2026-09-24T15:00:00.000Z', discountSetting: { discountPercentage: 0 } }] }] }
      },
      {
        id: 'a3', title: 'Juego De Pago', keyImages: [],
        price: { totalPrice: { discountPrice: 1999 } },
        promotions: { promotionalOffers: [{ promotionalOffers: [{ discountSetting: { discountPercentage: 50 } }] }] }
      }
    ] } } }
  };

  const result = await withFetch(async () => jsonResponse(payload), () => sources.fetchEpicFreeGames());

  assert.equal(result.length, 2, 'solo los que quedan a cero son gratis');
  assert.equal(result[0].title, 'Juego Actual');
  assert.equal(result[0].upcoming, false);
  assert.equal(result[0].image, 'https://cdn.epic/a.jpg');
  assert.equal(result[0].originalPrice, '19,99 €');
  assert.match(result[0].url, /store\.epicgames\.com\/es-ES\/p\/juego-actual/);
  assert.equal(result[1].upcoming, true, 'el de la semana siguiente se marca como próximo');
  assert.equal(result.some(item => item.title === 'Juego De Pago'), false);
});

test('Epic: una respuesta con otra forma se reporta como error, no se traga', async () => {
  await assert.rejects(
    () => withFetch(async () => jsonResponse({ data: {} }), () => sources.fetchEpicFreeGames()),
    /forma inesperada/
  );
});

test('Sorteos: normaliza los campos y descarta entradas incompletas', async () => {
  const payload = [
    { id: 1, title: 'Llave de Steam', worth: '$19.99', open_giveaway_url: 'https://gp/1', image: 'https://gp/1.jpg', platforms: 'PC, Steam', end_date: '2026-10-01 00:00:00', type: 'Game', description: 'Una llave' },
    { id: 2, title: 'Sin fin', worth: 'N/A', gamerpower_url: 'https://gp/2', end_date: 'N/A', platforms: 'PC, GOG', type: 'Game' },
    { title: 'Sin id' }
  ];

  const result = await withFetch(async () => jsonResponse(payload), () => sources.fetchGiveaways({ platforms: ['steam'] }));

  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'giveaway:1');
  assert.equal(result[0].worth, '$19.99');
  assert.equal(result[0].store, 'PC');
  assert.equal(result[1].worth, null, '"N/A" no es un valor');
  assert.equal(result[1].endsAt, null, '"N/A" no es una fecha');
  assert.equal(result[1].url, 'https://gp/2', 'usa el enlace de respaldo');
});

test('Sorteos: cuando no hay nada activo devuelve una lista vacía', async () => {
  // GamerPower responde un objeto de estado en vez de una lista; no es un error.
  const result = await withFetch(async () => jsonResponse({ status: 0, status_message: 'No results' }), () => sources.fetchGiveaways());
  assert.deepEqual(result, []);
});

test('Steam: solo publica lo que supera el descuento mínimo', async () => {
  const payload = { specials: { items: [
    { id: 10, name: 'Rebajado', discounted: true, discount_percent: 75, original_price: 5999, final_price: 1499, currency: 'COP', large_capsule_image: 'https://cdn.steam/10.jpg' },
    { id: 11, name: 'Poco descuento', discounted: true, discount_percent: 20, original_price: 1000, final_price: 800, currency: 'COP' },
    { id: 12, name: 'Regalado', discounted: true, discount_percent: 100, original_price: 2000, final_price: 0, currency: 'COP' },
    { id: 13, name: 'Sin oferta', discounted: false, discount_percent: 0 }
  ] } };

  const result = await withFetch(async () => jsonResponse(payload), () => sources.fetchSteamSpecials({ minDiscount: 50 }));

  assert.deepEqual(result.map(item => item.title), ['Rebajado', 'Regalado']);
  assert.equal(result[0].originalPrice, '59.99 COP');
  assert.equal(result[0].finalPrice, '14.99 COP');
  assert.equal(result[1].finalPrice, 'Gratis', 'el 100% de descuento se muestra como gratis');
  assert.match(result[0].url, /store\.steampowered\.com\/app\/10\//);
});

test('la configuración de ofertas aplica límites sensatos', () => {
  assert.deepEqual(dealsConfig({ deals: { minDiscount: 5, maxPerCycle: 99 } }).minDiscount, 10);
  assert.equal(dealsConfig({ deals: { maxPerCycle: 99 } }).maxPerCycle, 10);
  assert.equal(dealsConfig({}).epicFree, true, 'Epic viene activo por defecto');
  assert.equal(dealsConfig({}).steamSpecials, false, 'las rebajas de Steam son opt-in');
});

test('solo entran los servidores con el módulo activo, un canal elegido y plan', () => {
  const guilds = {
    // Las ofertas consultan tres tiendas cada media hora: son de plan premium.
    conTodo: { plan: 'premium', features: { deals: true }, deals: { channel: '123' } },
    sinCanal: { plan: 'premium', features: { deals: true }, deals: {} },
    apagado: { plan: 'premium', features: { deals: false }, deals: { channel: '123' } },
    sinPlan: { features: { deals: true }, deals: { channel: '123' } }
  };
  const eligible = collectEligibleGuilds(guilds);
  assert.deepEqual(eligible.map(entry => entry.guildId), ['conTodo']);
});

test('un servidor que pierde el plan deja de consultar, aunque siga configurado', () => {
  // Es el punto del plan: que el gasto pare solo, sin tener que tocar nada.
  const configurado = { features: { deals: true }, deals: { channel: '123' } };
  assert.deepEqual(collectEligibleGuilds({ sinPlan: configurado }), []);
  assert.equal(collectEligibleGuilds({ conPlan: { ...configurado, plan: 'premium' } }).length, 1);
});

test('el aviso usa el formato por defecto y admite personalización', () => {
  const offer = {
    source: 'steam', id: 'steam:10:75', title: 'Rebajado',
    url: 'https://store.steampowered.com/app/10/', image: null,
    discount: 75, originalPrice: '59.99 COP', finalPrice: '14.99 COP', endsAt: null, store: 'Steam'
  };

  const base = buildPayload(offer, {}, '');
  assert.match(base.embeds[0].title, /75% de descuento: Rebajado/);
  assert.equal(base.embeds[0].url, offer.url, 'el embed enlaza a la tienda');

  const custom = buildPayload(offer, {
    embeds: { deal_steam_special: { title: '{title} a {discount}%', message: 'Ahora {price} en {store}' } }
  }, '<@&1>');
  assert.equal(custom.embeds[0].title, 'Rebajado a 75%');
  assert.equal(custom.embeds[0].description, 'Ahora 14.99 COP en Steam');
  assert.equal(custom.content, '<@&1>', 'el ping al rol se conserva');
});
