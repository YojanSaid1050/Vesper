#!/usr/bin/env node
// scripts/diagnose.js
//
// Prueba de verdad, contra los servicios reales, todo lo que el bot necesita
// para funcionar. Se ejecuta EN EL ALOJAMIENTO, donde sí hay internet:
//
//   npm run diagnostico
//
// No toca la base de datos ni publica nada en Discord: solo comprueba y
// cuenta lo que encuentra.

require('dotenv').config();

const resultados = [];

function anotar(grupo, nombre, estado, detalle = '') {
  resultados.push({ grupo, nombre, estado, detalle });
  const icono = { ok: '✅', aviso: '⚠️ ', fallo: '❌', salto: '⏭️ ' }[estado];
  console.log(`${icono} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

async function medir(accion) {
  const inicio = Date.now();
  const valor = await accion();
  return { valor, ms: Date.now() - inicio };
}

function encabezado(texto) {
  console.log(`\n${'─'.repeat(64)}\n${texto}\n${'─'.repeat(64)}`);
}

/* ---------------------------------------------------------------- */

async function probarYouTube() {
  encabezado('YouTube · feeds RSS (gratis, sin clave, sin cuota)');
  const { fetchFeed, feedUrl } = require('../src/platforms/youtube/rss');

  const canales = (process.env.DIAGNOSTICO_YOUTUBE || 'UCX6OQ3DkcsbYNE6H8uQQuVA,UCBJycsmduvYEL83R_U4JriQ')
    .split(',').map(id => id.trim()).filter(Boolean);

  for (const channelId of canales) {
    for (const kind of ['videos', 'shorts', 'lives']) {
      const url = feedUrl(channelId, kind);
      if (!url) { anotar('youtube', `${channelId} · ${kind}`, 'fallo', 'identificador de canal no válido'); continue; }
      try {
        const { valor, ms } = await medir(() => fetchFeed(channelId, kind));
        // Un canal sin shorts devuelve una lista vacía, y eso es correcto.
        anotar('youtube', `${channelId} · ${kind}`, 'ok', `${valor.length} entradas en ${ms} ms${valor[0] ? ` · ${valor[0].title.slice(0, 40)}` : ''}`);
      } catch (error) {
        anotar('youtube', `${channelId} · ${kind}`, 'fallo', error.message.slice(0, 90));
      }
    }
  }

  if (process.env.YOUTUBE_API_KEY) {
    try {
      const { getChannelInfo } = require('../src/platforms/youtube/utils');
      const { valor, ms } = await medir(() => getChannelInfo(canales[0]));
      anotar('youtube', 'API de datos (solo para detalles)', valor ? 'ok' : 'aviso', valor ? `${valor.name} en ${ms} ms` : 'sin respuesta');
    } catch (error) {
      anotar('youtube', 'API de datos', 'fallo', error.message.slice(0, 90));
    }
  } else {
    anotar('youtube', 'API de datos', 'salto', 'sin YOUTUBE_API_KEY (el RSS funciona igual)');
  }
}

async function probarTwitch() {
  encabezado('Twitch');
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    anotar('twitch', 'Credenciales', 'salto', 'faltan TWITCH_CLIENT_ID o TWITCH_CLIENT_SECRET');
    return;
  }
  try {
    const utils = require('../src/platforms/twitch/utils');
    const { ms } = await medir(() => utils.getAccessToken());
    anotar('twitch', 'Token de aplicación', 'ok', `obtenido en ${ms} ms`);

    const usuarios = (process.env.DIAGNOSTICO_TWITCH || 'auronplay,ibai').split(',').map(v => v.trim()).filter(Boolean);
    const { valor, ms: ms2 } = await medir(() => Promise.all(usuarios.map(nombre => utils.getStreamerInfo(nombre).catch(() => null))));
    const enDirecto = (valor || []).filter(Boolean);
    anotar('twitch', `Consulta de ${usuarios.length} canales`, 'ok',
      `${enDirecto.length} en directo en ${ms2} ms${enDirecto[0] ? ` · ${enDirecto[0].user_name || enDirecto[0].title?.slice(0, 30)}` : ''}`);
  } catch (error) {
    anotar('twitch', 'Twitch', 'fallo', error.message.slice(0, 110));
  }
}

async function probarTikTok() {
  encabezado('TikTok · navegador propio (gratis, sin Apify)');
  try {
    const { getFreeTikTokClient, stopFreeTikTokClient } = require('../src/platforms/tiktok/freeClient');
    const usuario = (process.env.DIAGNOSTICO_TIKTOK || 'tiktok').trim().replace(/^@/, '');
    const cliente = getFreeTikTokClient();
    const { valor, ms } = await medir(() => cliente.fetchLatestVideo(usuario));
    anotar('tiktok', `Último video de @${usuario}`, valor ? 'ok' : 'aviso',
      valor ? `${String(valor.title || valor.id).slice(0, 45)} en ${ms} ms` : `sin datos tras ${ms} ms`);
    await stopFreeTikTokClient();
  } catch (error) {
    anotar('tiktok', 'TikTok', 'fallo', error.message.slice(0, 110));
  }
}

async function probarOfertas() {
  encabezado('Ofertas y juegos gratis (las tres fuentes son gratuitas)');
  const deals = require('../src/platforms/deals/sources');
  const pruebas = [
    ['Epic Games', () => deals.fetchEpicFreeGames({ country: 'ES', locale: 'es-ES' })],
    ['GamerPower (sorteos)', () => deals.fetchGiveaways({ platforms: ['steam', 'epic-games-store'] })],
    ['Steam (rebajas)', () => deals.fetchSteamSpecials({ country: 'ES', language: 'spanish', minDiscount: 50 })]
  ];
  for (const [nombre, accion] of pruebas) {
    try {
      const { valor, ms } = await medir(accion);
      anotar('ofertas', nombre, valor.length ? 'ok' : 'aviso',
        `${valor.length} resultados en ${ms} ms${valor[0] ? ` · ${String(valor[0].title).slice(0, 40)}` : ''}`);
    } catch (error) {
      anotar('ofertas', nombre, 'fallo', error.message.slice(0, 90));
    }
  }
}

async function probarMusica() {
  encabezado('Música · motor integrado (yt-dlp + ffmpeg)');
  const sources = require('../src/core/music/sources');
  const herramientas = sources.toolCheck();
  anotar('musica', 'Herramientas instaladas', herramientas.ok ? 'ok' : 'fallo',
    herramientas.ok ? `${herramientas.ytdlp} · ${herramientas.ffmpeg}` : `faltan: ${herramientas.missing.join(', ')}`);
  if (!herramientas.ok) return;

  try {
    const { valor, ms } = await medir(() => sources.search(process.env.DIAGNOSTICO_MUSICA || 'lofi hip hop radio', { limit: 1 }));
    const pista = valor[0];
    anotar('musica', 'Búsqueda', 'ok', `«${pista.title.slice(0, 40)}» de ${pista.author} en ${ms} ms`);

    const { valor: url, ms: ms2 } = await medir(() => sources.resolveStream(pista));
    anotar('musica', 'Dirección del audio', /^https?:/.test(url) ? 'ok' : 'fallo', `resuelta en ${ms2} ms`);

    // Se abre el flujo de verdad y se comprueba que llega audio Opus válido.
    const handle = sources.openStream(url, { volume: 50 });
    const trozos = [];
    await new Promise((resolve, reject) => {
      const corte = setTimeout(() => { handle.process.kill('SIGKILL'); resolve(); }, 12_000);
      handle.stream.on('data', trozo => {
        trozos.push(trozo);
        if (Buffer.concat(trozos).length > 60_000) { clearTimeout(corte); handle.process.kill('SIGKILL'); resolve(); }
      });
      handle.process.on('error', error => { clearTimeout(corte); reject(error); });
    });
    const audio = Buffer.concat(trozos);
    const valido = audio.subarray(0, 4).toString('latin1') === 'OggS';
    anotar('musica', 'Audio reproducible', valido ? 'ok' : 'fallo',
      valido ? `${(audio.length / 1024).toFixed(0)} KB de Ogg/Opus, listo para Discord` : `flujo inesperado: ${handle.errorText().slice(0, 80)}`);
  } catch (error) {
    anotar('musica', 'Música', 'fallo', error.message.slice(0, 120));
  }
}

async function probarAcceso() {
  encabezado('Acceso al panel');
  const { redirectUris, discordConfigured, googleConfigured } = require('../src/web/OAuthService');
  const uris = redirectUris();

  if (!uris.base) {
    anotar('acceso', 'WEB_BASE_URL', 'fallo', 'sin configurar: el acceso al panel no puede funcionar');
    return;
  }
  anotar('acceso', 'Dirección pública', 'ok', uris.base);

  console.log('\n   Estas dos direcciones tienen que estar dadas de alta, tal cual:');
  console.log(`   · Discord → Developer Portal → OAuth2 → Redirects:\n     ${uris.discord}`);
  console.log(`   · Google  → Cloud Console → Credenciales → URIs de redireccionamiento:\n     ${uris.google}\n`);

  anotar('acceso', 'OAuth de Discord', discordConfigured() ? 'ok' : 'aviso',
    discordConfigured() ? 'credenciales presentes' : 'faltan DISCORD_OAUTH_CLIENT_ID/SECRET');
  anotar('acceso', 'OAuth de Google', googleConfigured() ? 'ok' : 'aviso',
    googleConfigured() ? 'credenciales presentes' : 'faltan GOOGLE_CLIENT_ID/SECRET');
}

async function probarBaseDeDatos() {
  encabezado('Base de datos');
  if (!process.env.MONGODB_URI) {
    anotar('datos', 'MongoDB', 'salto', 'sin MONGODB_URI');
    return;
  }
  try {
    const mongoose = require('mongoose');
    const { ms } = await medir(() => mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 }));
    anotar('datos', 'MongoDB', 'ok', `conectada en ${ms} ms`);
    await mongoose.disconnect();
  } catch (error) {
    anotar('datos', 'MongoDB', 'fallo', error.message.slice(0, 110));
  }
}

/* ---------------------------------------------------------------- */

async function main() {
  const solo = process.argv.slice(2).filter(arg => !arg.startsWith('-'));
  const todas = {
    acceso: probarAcceso,
    datos: probarBaseDeDatos,
    youtube: probarYouTube,
    twitch: probarTwitch,
    tiktok: probarTikTok,
    ofertas: probarOfertas,
    musica: probarMusica
  };

  const elegidas = solo.length ? solo.filter(nombre => todas[nombre]) : Object.keys(todas);
  if (solo.length && !elegidas.length) {
    console.log(`Grupos disponibles: ${Object.keys(todas).join(', ')}`);
    process.exit(1);
  }

  console.log('🔎 Diagnóstico de Vesper — probando contra los servicios reales\n');
  for (const nombre of elegidas) await todas[nombre]().catch(error => anotar(nombre, nombre, 'fallo', error.message.slice(0, 100)));

  encabezado('Resumen');
  const cuenta = estado => resultados.filter(r => r.estado === estado).length;
  console.log(`✅ ${cuenta('ok')} correctos · ⚠️  ${cuenta('aviso')} con avisos · ❌ ${cuenta('fallo')} fallidos · ⏭️  ${cuenta('salto')} omitidos`);

  const fallos = resultados.filter(r => r.estado === 'fallo');
  if (fallos.length) {
    console.log('\nLo que hay que mirar:');
    for (const fallo of fallos) console.log(`  · ${fallo.nombre}: ${fallo.detalle}`);
  }
  process.exit(fallos.length ? 1 : 0);
}

main().catch(error => {
  console.error('El diagnóstico se interrumpió:', error.message);
  process.exit(1);
});
