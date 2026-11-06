'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const WEB = path.join(ROOT, 'src', 'web');
const PUB = path.join(WEB, 'public');
const read = name => fs.readFileSync(path.join(PUB, name), 'utf8');

test('La portada usa español y evita ejemplos de servidores particulares', () => {
  const home = read('landing.html');
  assert.match(home, /Bot de Discord · en español/);
  assert.doesNotMatch(home, /en castellano|Ankerie Dimension|Embers Void|@nuevo-miembro|@usuario|Bienvenid@|Reclama tu limón/i);
  assert.doesNotMatch(home, /@\w[\w-]+/);
});
test('La muestra de bienvenida no suplanta ni menciona cuentas', () => {
  const home = read('landing.html');
  assert.match(home, /¡Bienvenido al servidor!/);
  assert.match(home, /Nos alegra que formes parte de esta comunidad\./);
  assert.doesNotMatch(home, /class="chat-embed lemon"/);
  assert.doesNotMatch(home, /hoy a las 21:0[47]/);
});
test('Identidad Aetheris visible en cabecera, pie y avatar de muestra', () => {
  const home = read('landing.html');
  assert.equal((home.match(/aetheris-logo\.webp/g) || []).length, 4);
  assert.ok(fs.statSync(path.join(PUB,'img','aetheris-logo.webp')).size > 1000);
  assert.ok(fs.statSync(path.join(PUB,'img','aetheris-favicon.png')).size > 1000);
  assert.match(home, /aetheris-favicon\.png/);
});
test('Portada y acceso ofrecen enlaces a privacidad, condiciones y eliminación', () => {
  for (const page of ['landing.html','index.html']) {
    const s=read(page);
    for (const route of ['/privacidad','/terminos','/eliminacion-datos']) assert.ok(s.includes('href="'+route+'"'),page+' carece de '+route);
  }
});
test('Las políticas y solicitud de eliminación son públicas, sin login', () => {
  const routes=fs.readFileSync(path.join(WEB,'health.js'),'utf8');
  for (const route of ['/privacidad','/terminos','/eliminacion-datos']) assert.ok(routes.includes(route));
  assert.doesNotMatch(routes, /['"]\/privacidad['"]\s*,\s*requireSession/);
});
test('Documentos públicos identifican responsable, contacto y derechos', () => {
  for (const doc of ['privacy.html','terms.html','data-removal.html']) {
    const s=read(doc);
    assert.match(s, /Yojan Said Salazar Poveda/);
    assert.match(s, /xvesper\.botx@gmail\.com/);
    assert.match(s, /<html lang="es">/);
    assert.match(s, /aetheris-logo\.webp/);
    assert.doesNotMatch(s,/\[PENDIENTE DE DEFINIR\]/i);
  }
  assert.match(read('privacy.html'),/supresi[oó]n|eliminaci[oó]n/i);
  assert.match(read('data-removal.html'),/No envíes contraseñas/i);
});
test('Guía operativa interna no se expone como ruta pública', () => {
  const routes=fs.readFileSync(path.join(WEB,'health.js'),'utf8');
  assert.doesNotMatch(routes, /procedure\.html|\/procedimiento-interno/i);
});
test('La modificación no cambia módulos internos del bot', () => {
  const base=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
  assert.ok(base.scripts.test);
  assert.ok(base.scripts.lint);
});
