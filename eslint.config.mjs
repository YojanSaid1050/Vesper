// Configuración mínima de ESLint: solo reglas que señalan errores reales
// (variables inexistentes, claves duplicadas, código inalcanzable), no estilo.
// Varios de los fallos corregidos en 2.8.1 los habría detectado esto.
const nodeGlobals = {
  require: 'readonly', module: 'writable', exports: 'writable', process: 'readonly',
  console: 'readonly', __dirname: 'readonly', __filename: 'readonly', Buffer: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  setImmediate: 'readonly', queueMicrotask: 'readonly', structuredClone: 'readonly',
  URL: 'readonly', URLSearchParams: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly',
  fetch: 'readonly', AbortController: 'readonly', AbortSignal: 'readonly', global: 'readonly'
};

const browserGlobals = {
  document: 'readonly', window: 'readonly', location: 'readonly', history: 'readonly',
  navigator: 'readonly', fetch: 'readonly', FormData: 'readonly', Intl: 'readonly',
  confirm: 'readonly', prompt: 'readonly', alert: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly',
  clearInterval: 'readonly', URLSearchParams: 'readonly', FormData: 'readonly',
  localStorage: 'readonly', console: 'readonly'
};

const rules = {
  'no-undef': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-dupe-else-if': 'error',
  'no-duplicate-case': 'error',
  'no-unreachable': 'error',
  'no-const-assign': 'error',
  'no-self-assign': 'error',
  'no-self-compare': 'error',
  'no-fallthrough': 'error',
  'no-async-promise-executor': 'error',
  'no-unsafe-optional-chaining': 'error',
  'no-unsafe-negation': 'error',
  'no-cond-assign': 'error',
  'valid-typeof': 'error',
  'use-isnan': 'error',
  'no-compare-neg-zero': 'error',
  'no-sparse-arrays': 'error',
  'require-yield': 'error',
  'getter-return': 'error'
};

export default [
  {
    // Código de servidor (Node).
    files: ['src/**/*.js', 'scripts/**/*.js', 'test/**/*.js'],
    ignores: ['src/web/public/**'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'commonjs', globals: nodeGlobals },
    rules
  },
  {
    // El cliente del panel se ejecuta en el navegador.
    files: ['src/web/public/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'script', globals: browserGlobals },
    rules
  },
  {
    // Los page.evaluate de Playwright corren dentro de Chromium.
    files: ['src/platforms/tiktok/freeClient.js'],
    languageOptions: { globals: { ...nodeGlobals, document: 'readonly', navigator: 'readonly', window: 'readonly' } },
    rules
  }
];
