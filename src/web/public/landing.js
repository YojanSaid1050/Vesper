// src/web/public/landing.js
//
// Lo único que necesita la portada: recordar si prefieres claro u oscuro, la
// misma preferencia que usa el panel, para que pasar de una a otro no cambie
// de fondo a mitad de camino.

const THEME_KEY = 'vesper.tema';
const THEMES = ['auto', 'claro', 'oscuro'];

let theme = 'auto';

function storedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return THEMES.includes(value) ? value : 'auto';
  } catch {
    // Navegación privada o almacenamiento bloqueado: se usa el del sistema.
    return 'auto';
  }
}

function systemPrefersLight() {
  return window.matchMedia?.('(prefers-color-scheme: light)')?.matches ?? false;
}

function applyTheme() {
  const mode = theme === 'claro' ? 'light'
    : theme === 'oscuro' ? 'dark'
      : (systemPrefersLight() ? 'light' : 'dark');

  document.body.dataset.mode = mode;
  document.body.dataset.theme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', mode === 'light' ? '#fbfbfc' : '#0d0d11');

  document.querySelectorAll('[data-theme-option]').forEach(button => {
    const active = button.dataset.themeOption === theme;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function saveTheme(value) {
  theme = THEMES.includes(value) ? value : 'auto';
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Que no se pueda recordar no impide aplicarlo ahora.
  }
  applyTheme();
}

theme = storedTheme();
applyTheme();

document.addEventListener('click', event => {
  const button = event.target.closest('[data-theme-option]');
  if (button) saveTheme(button.dataset.themeOption);
});

window.matchMedia?.('(prefers-color-scheme: light)')?.addEventListener?.('change', () => {
  if (theme === 'auto') applyTheme();
});

// Los enlaces internos se desplazan con suavidad, salvo que el sistema pida
// lo contrario por accesibilidad.
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
});
