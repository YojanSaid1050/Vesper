const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Huellas del diseño protegido. memberAdd/memberRemove se actualizaron al
// hacer configurables el texto, el color y la imagen: la estructura del embed
// (contenedor V2, separador y tipografía) es la misma y, sin configuración
// guardada, el resultado publicado es idéntico carácter a carácter.
const expected = {
  'src/dashboard/mainPanel.js': '00cd1da3ee2b1532910ea49725cf6a67bf2065c334209e5597a541b9cbe6308f',
  'src/dashboard/panels.js': '942dc96ca37cb1b667d125bf49a535cf1df6601892e369eebcf9bf1f7d6edd14',
  'src/platforms/tiktok/embeds.js': '0a06d0a9e526446c4ca33475c6416bbe2d26313a6bb393faef834407ccdbb63e',
  'src/platforms/twitch/embeds.js': '988af1299227d0d4ae614a1ebf28a14b794b0017bccb934b0ad1c12958a1bb86',
  'src/platforms/youtube/embeds.js': 'dfa42f78860420dce60bc628104052014bbc892f8bfcc15dd0985c3aa0df455f',
  'src/events/guild/memberAdd.js': 'c7299edc8948b5b9a7fd81282d60df9d2bd7fc4434cc1eb26341b22dd76ea28d',
  'src/events/guild/memberRemove.js': 'b401a6cc05ed7184a4c1f30cfc1b85abfe140994b98b22fabf0d374c38c51f3e'
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
