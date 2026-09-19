// Vesper habla español de Colombia. Se trata de tú o de usted en singular y de
// «ustedes» en plural: nunca «vosotros». Y el vocabulario es el de allá.
//
// Esta prueba mira TODO lo que lee una persona —los mensajes del bot, los
// paquetes y los textos del panel— y falla si se cuela una forma de España.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.MAIN_GUILD_ID = process.env.MAIN_GUILD_ID || '1506580021232406540';
process.env.THEMED_MAIN_GUILD_IDS = process.env.THEMED_MAIN_GUILD_IDS || '1124871897688055818';

const { KINDS, factoryDefaults } = require('../src/core/EmbedCatalog');
const { THEMES } = require('../src/core/MessageThemes');

const DE_ESPAÑA = [
  // Conjugaciones de «vosotros»
  [/\b(sois|estáis|tenéis|habéis|podéis|queréis|sabéis|hacéis|quedáis|veréis|debéis|vais|ibais)\b/i, 'forma de «vosotros»'],
  [/\bvosotros\b/i, '«vosotros»'],
  [/\bvuestr[oa]s?\b/i, '«vuestro»'],
  // Vocabulario
  [/\bvídeos?\b/i, '«vídeo» con tilde (en Colombia es «video»)'],
  [/\bordenador(es)?\b/i, '«ordenador» (en Colombia es «computador»)'],
  [/\bzumos?\b/i, '«zumo» (en Colombia es «jugo»)'],
  [/\bmóvil(es)?\b(?!\s*:)/i, '«móvil» como teléfono (en Colombia es «celular»)'],
  [/\bcoche(s)?\b/i, '«coche» (en Colombia es «carro»)'],
  [/\bchaval|\bguay\b|\bmola\b/i, 'jerga de España']
];

function revisar(texto, donde, problemas) {
  if (!texto) return;
  for (const [patron, motivo] of DE_ESPAÑA) {
    const encontrado = String(texto).match(patron);
    if (encontrado) problemas.push(`${donde}: ${motivo} → «${encontrado[0]}»`);
  }
}

test('los mensajes del bot están en español de Colombia', () => {
  const problemas = [];
  for (const kind of KINDS) {
    const f = factoryDefaults(kind);
    for (const campo of ['author', 'title', 'message', 'footer']) revisar(f[campo], `${kind}.${campo}`, problemas);
  }
  assert.deepEqual(problemas, []);
});

test('los paquetes de mensajes están en español de Colombia', () => {
  const problemas = [];
  for (const theme of Object.values(THEMES)) {
    for (const [kind, entry] of Object.entries(theme.messages)) {
      for (const campo of ['author', 'title', 'message', 'footer']) {
        revisar(entry[campo], `${theme.id}/${kind}.${campo}`, problemas);
      }
    }
  }
  assert.deepEqual(problemas, []);
});

// Los textos del panel van dentro del código, así que se leen los archivos
// enteros. Los comentarios también: los escribe la misma mano.
test('el panel y la portada están en español de Colombia', () => {
  const base = path.join(__dirname, '..', 'src', 'web', 'public');
  const archivos = fs.readdirSync(base)
    .filter(nombre => /\.(js|html)$/.test(nombre))
    .map(nombre => path.join(base, nombre));

  const problemas = [];
  for (const archivo of archivos) {
    const lineas = fs.readFileSync(archivo, 'utf8').split('\n');
    lineas.forEach((linea, i) => revisar(linea, `${path.basename(archivo)}:${i + 1}`, problemas));
  }
  assert.deepEqual(problemas, []);
});

// Lo que el bot contesta en Discord: comandos, errores y avisos del reproductor.
test('los comandos y el reproductor están en español de Colombia', () => {
  const problemas = [];
  const carpetas = ['src/commands', 'src/core', 'src/events', 'src/platforms', 'src/utils'];
  const recorrer = dir => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(completo);
      else if (entrada.name.endsWith('.js')) {
        fs.readFileSync(completo, 'utf8').split('\n')
          .forEach((linea, i) => revisar(linea, `${completo}:${i + 1}`, problemas));
      }
    }
  };
  for (const carpeta of carpetas) {
    const completo = path.join(__dirname, '..', carpeta);
    if (fs.existsSync(completo)) recorrer(completo);
  }
  assert.deepEqual(problemas, []);
});
