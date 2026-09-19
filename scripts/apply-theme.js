#!/usr/bin/env node
// scripts/apply-theme.js
//
// Deja los 38 mensajes de un servidor escritos de una vez con el paquete que
// le corresponde, sin entrar al panel. Se ejecuta EN EL ALOJAMIENTO, donde
// están las credenciales:
//
//   npm run mensajes -- <idDelServidor> <paquete>
//   npm run mensajes -- 1124871897688055818 limones
//   npm run mensajes -- 1124871897688055818 limones --probar
//
// `--probar` enseña lo que haría y no guarda nada.
//
// Las IMÁGENES NO SE TOCAN: el paquete escribe título, cuerpo, pie y color, y
// deja intacta cualquier URL de imagen que ya estuviera configurada. Antes de
// guardar imprime cuáles hay, para que se vea que siguen ahí.

require('dotenv').config();

const { connectMongo, disconnectMongo, getGuildConfig, updateGuildSection } = require('../src/database/mongoManager');
const { applyTheme, getTheme, themeAllowed } = require('../src/core/MessageThemes');
const { guildTier } = require('../src/config/guildPolicy');
const { KINDS } = require('../src/core/EmbedCatalog');

function abortar(mensaje) {
  console.error(`\n❌ ${mensaje}\n`);
  process.exit(1);
}

async function main() {
  const [guildId, themeId] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const soloProbar = process.argv.includes('--probar') || process.argv.includes('--dry-run');

  if (!guildId || !themeId) {
    abortar('Uso: npm run mensajes -- <idDelServidor> <paquete>\n   Paquetes: estandar, void, limones');
  }

  const theme = getTheme(themeId);
  if (!theme) abortar(`No existe el paquete «${themeId}». Hay estandar, void y limones.`);

  const tier = guildTier(guildId);
  if (!themeAllowed(themeId, tier)) {
    abortar(`El paquete «${theme.name}» es de otro servidor. Este es «${tier}», y ahí solo entra «Estándar».`);
  }

  await connectMongo();
  const config = await getGuildConfig(guildId, { fresh: true });

  // Lo que ya había: imágenes y mensajes tocados a mano.
  const conImagen = KINDS.filter(kind => config.embeds?.[kind]?.image);
  const tocados = KINDS.filter(kind => ['title', 'message', 'footer', 'color'].some(campo => config.embeds?.[kind]?.[campo]));

  console.log(`\nServidor ${guildId} · tipo «${tier}»`);
  console.log(`Paquete: ${theme.name} — ${theme.tagline}\n`);
  console.log(`Mensajes ya personalizados que se van a reescribir: ${tocados.length}`);
  if (tocados.length) console.log(`  ${tocados.join(', ')}`);
  console.log(`\nImágenes configuradas que SE CONSERVAN: ${conImagen.length}`);
  for (const kind of conImagen) console.log(`  ${kind} → ${config.embeds[kind].image}`);

  const embeds = applyTheme(themeId);
  const plano = {};
  for (const [kind, campos] of Object.entries(embeds)) {
    for (const [campo, valor] of Object.entries(campos)) plano[`${kind}.${campo}`] = valor;
  }

  if (Object.keys(plano).some(clave => clave.endsWith('.image'))) {
    abortar('El paquete intentaría escribir una imagen. Esto no debería pasar nunca; revisa MessageThemes.js antes de seguir.');
  }

  if (soloProbar) {
    console.log(`\n(--probar) No se ha guardado nada. Se habrían escrito ${Object.keys(plano).length} campos en ${Object.keys(embeds).length} mensajes.\n`);
    return;
  }

  await updateGuildSection(guildId, 'embeds', plano);
  const despues = await getGuildConfig(guildId, { fresh: true });
  const siguenConImagen = conImagen.filter(kind => despues.embeds?.[kind]?.image === config.embeds[kind].image);

  console.log(`\n✅ ${Object.keys(embeds).length} mensajes escritos con el paquete «${theme.name}».`);
  console.log(`✅ Imágenes intactas: ${siguenConImagen.length} de ${conImagen.length}.`);
  if (siguenConImagen.length !== conImagen.length) {
    console.log('⚠️  Alguna imagen no coincide. Revísalo en el panel antes de dar esto por bueno.');
  }
  console.log('\nPuedes retocar cualquiera desde el panel, en «Mensajes».\n');
}

main()
  .catch(error => { console.error('\n❌', error.message); process.exitCode = 1; })
  .finally(() => disconnectMongo().catch(() => null));
