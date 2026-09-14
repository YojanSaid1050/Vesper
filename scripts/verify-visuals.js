const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Huellas del diseño protegido. memberAdd/memberRemove se actualizaron dos
// veces: al hacer configurables el texto, el color y la imagen, y al permitir
// elegir entre el contenedor V2 y el embed clásico. La estructura del
// contenedor no ha cambiado y, sin configuración guardada, el resultado
// publicado sigue siendo idéntico carácter a carácter (lo comprueban las
// pruebas de test/embedTemplates.test.js).
const expected = {
  'src/dashboard/mainPanel.js': '00cd1da3ee2b1532910ea49725cf6a67bf2065c334209e5597a541b9cbe6308f',
  'src/dashboard/panels.js': '942dc96ca37cb1b667d125bf49a535cf1df6601892e369eebcf9bf1f7d6edd14',
  'src/platforms/tiktok/embeds.js': '0a06d0a9e526446c4ca33475c6416bbe2d26313a6bb393faef834407ccdbb63e',
  'src/platforms/twitch/embeds.js': '988af1299227d0d4ae614a1ebf28a14b794b0017bccb934b0ad1c12958a1bb86',
  'src/platforms/youtube/embeds.js': 'dfa42f78860420dce60bc628104052014bbc892f8bfcc15dd0985c3aa0df455f',
  'src/events/guild/memberAdd.js': '32ec9bdf82d8e5f82fc9fb3fa80645b2442dc8c5dedf5f0edcdca521f4eeadba',
  'src/events/guild/memberRemove.js': '55d8629fd042aba4b0bd693b1faade1b689921643b9a3a0b5d70f301a5377f3f'
};

let failed = false;
for (const [relativePath, expectedHash] of Object.entries(expected)) {
  const filePath = path.join(__dirname, '..', relativePath);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  if (actual !== expectedHash) {
    failed = true;
    console.error(`❌ ${relativePath}: el diseño protegido cambió`);
  } else {
    console.log(`✅ ${relativePath}`);
  }
}

if (failed) process.exit(1);
console.log('✨ Todos los archivos visuales protegidos permanecen intactos');
