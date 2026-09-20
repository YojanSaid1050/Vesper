const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('Render apunta al Dockerfile que existe con la misma capitalización', () => {
  const render = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  const match = render.match(/dockerfilePath:\s*\.\/(\S+)/);
  assert.ok(match, 'render.yaml debe declarar dockerfilePath');
  assert.equal(match[1], 'Dockerfile');
  assert.equal(fs.existsSync(path.join(root, match[1])), true);
  assert.equal(fs.existsSync(path.join(root, 'dockerfile')), false, 'no debe quedar una copia con otro uso de mayúsculas');
});

test('la construcción tiene una plantilla de entorno sin secretos reales', () => {
  const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
  const examplePath = path.join(root, '.env.example');
  assert.match(dockerfile, /COPY --chown=node:node \.env\.example/);
  assert.equal(fs.existsSync(examplePath), true);

  const example = fs.readFileSync(examplePath, 'utf8');
  for (const key of ['TOKEN', 'MONGODB_URI', 'DISCORD_OAUTH_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET']) {
    assert.match(example, new RegExp(`^${key}=$`, 'm'), `${key} debe estar vacío`);
  }
  assert.doesNotMatch(example, /mongodb\+srv:\/\/[^\s]+:[^\s]+@/i);
  assert.doesNotMatch(example, /GOCSPX-[A-Za-z0-9_-]+/);
  assert.doesNotMatch(example, /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{20,}/);
});

test('package.json y package-lock.json declaran la misma versión', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
});
