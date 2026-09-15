/* ============================================================
   Vesper · Panel de control
   ------------------------------------------------------------
   Interfaz del panel. Principios que sigue este archivo:

   1. Todo se pinta desde los datos que devuelve la API. No hay
      textos ni colores de servidor escritos a mano aquí: el
      acento, el nombre, el avatar y los valores por defecto de
      cada embed llegan del backend y cambian con la configuración.
   2. Cada pantalla es una sección independiente con su propio
      render y su propio bind, en vez de una pestaña gigante.
   3. Nada de HTML con atributos style: la CSP del panel es
      `style-src 'self'` y los bloquearía. El color se aplica
      siempre por CSSOM.
   ============================================================ */

'use strict';

const state = {
  publicConfig: null,
  bootError: null,
  session: null,
  guilds: [],
  guildId: null,
  data: null,
  section: 'inicio',
  health: null,
  loading: false,
  dirty: new Set(),
  searchResults: [],
  searchIndex: 0,
  theme: 'auto'
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

/* ---------------------------------------------------------------- */
/* Utilidades                                                        */
/* ---------------------------------------------------------------- */

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return '—';
  }
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('es-CO') : '—';
}

function toast(message, kind = 'ok') {
  const element = $('#toast');
  element.textContent = message;
  element.className = `toast ${kind}`;
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.hidden = true; }, 4800);
}

// --------------------------------------------------------------------
// Diálogos propios
//
// El navegador muestra sus confirm() y prompt() con el dominio del
// alojamiento y sin ningún estilo. Estos usan <dialog>, que es accesible
// de serie (foco atrapado, Escape cierra) y se ve como el resto del panel.
// --------------------------------------------------------------------

function closeDialog(dialog, value) {
  dialog.close(value);
}

function openDialog({ title, message, confirmLabel = 'Aceptar', cancelLabel = 'Cancelar', danger = false, input = null }) {
  const dialog = $('#app-dialog');
  const field = $('#app-dialog-field');
  const control = $('#app-dialog-input');

  $('#app-dialog-title').textContent = title;
  $('#app-dialog-message').textContent = message || '';
  $('#app-dialog-message').hidden = !message;
  $('#app-dialog-confirm').textContent = confirmLabel;
  $('#app-dialog-cancel').textContent = cancelLabel;
  dialog.classList.toggle('danger', danger);

  if (input) {
    field.hidden = false;
    $('#app-dialog-label').textContent = input.label || '';
    control.value = input.value || '';
    control.placeholder = input.placeholder || '';
  } else {
    field.hidden = true;
    control.value = '';
  }

  return new Promise(resolve => {
    const onClose = () => {
      dialog.removeEventListener('close', onClose);
      const accepted = dialog.returnValue === 'confirm';
      resolve(input ? (accepted ? control.value.trim() : null) : accepted);
    };
    dialog.addEventListener('close', onClose);
    dialog.returnValue = 'cancel';
    dialog.showModal();
    (input ? control : $('#app-dialog-confirm')).focus();
  });
}

// Sustitutos directos de confirm() y prompt().
const confirmDialog = options => openDialog({ confirmLabel: 'Sí, continuar', ...options });
const promptDialog = options => openDialog({ confirmLabel: 'Guardar', ...options, input: options.input || { label: options.label || '' } });

async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const method = options.method || 'GET';
  if (state.session?.csrfToken && !['GET', 'HEAD'].includes(method)) {
    headers['X-CSRF-Token'] = state.session.csrfToken;
  }

  let response;
  try {
    response = await fetch(`/api/web${path}`, { ...options, headers });
  } catch {
    throw new Error('No se pudo contactar con Vesper. Puede estar reiniciando.');
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) showLogin();
    throw new Error(payload?.error || `El servidor respondió ${response.status}.`);
  }
  return payload;
}

/* ---------------------------------------------------------------- */
/* Color: el panel toma el acento del servidor que estás editando    */
/* ---------------------------------------------------------------- */

function parseHex(value) {
  const hex = String(value || '').trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

// Luminancia relativa (WCAG). Decide si el texto sobre el acento debe ser
// blanco o negro, en lugar de asumir siempre blanco y acabar con botones
// ilegibles cuando alguien elige un color claro.
function luminance({ r, g, b }) {
  const channel = value => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// El tema es una preferencia TUYA, no del servidor. Antes el panel se ponía
// claro u oscuro según el color del servidor que estuvieras configurando: al
// saltar entre uno y otro la pantalla cambiaba de blanco a negro, y con más
// servidores eso sería insoportable. Ahora eliges claro, oscuro o «el del
// sistema», y se queda así en todos.
const THEME_KEY = 'vesper.tema';
const THEMES = ['auto', 'claro', 'oscuro'];

function storedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return THEMES.includes(value) ? value : 'auto';
  } catch {
    // Navegación privada o almacenamiento bloqueado: se usa el del sistema.
    return 'auto';
  }
}

function saveTheme(theme) {
  state.theme = THEMES.includes(theme) ? theme : 'auto';
  try {
    localStorage.setItem(THEME_KEY, state.theme);
  } catch {
    // Que no se pueda recordar no impide aplicarlo ahora.
  }
  applyTheme();
}

function systemPrefersLight() {
  return window.matchMedia?.('(prefers-color-scheme: light)')?.matches ?? false;
}

function effectiveMode() {
  if (state.theme === 'claro') return 'light';
  if (state.theme === 'oscuro') return 'dark';
  return systemPrefersLight() ? 'light' : 'dark';
}

function applyTheme() {
  const root = document.documentElement;
  const profile = state.data?.config?.profile || {};

  // El color del servidor sigue tiñendo el panel: es lo que hace que se
  // reconozca de un vistazo dónde estás. Lo que ya no decide es si el fondo
  // es blanco o negro.
  const accentHex = profile.primaryColor || '#9D63FF';
  const rgb = parseHex(accentHex) || parseHex('#9D63FF');

  root.style.setProperty('--accent', accentHex);
  root.style.setProperty('--accent-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .16)`);
  root.style.setProperty('--accent-line', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .34)`);
  root.style.setProperty('--accent-ink', luminance(rgb) > 0.55 ? '#14101c' : '#ffffff');

  const mode = effectiveMode();
  document.body.dataset.mode = mode;
  document.body.dataset.theme = state.theme;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', mode === 'light' ? '#f6f6f8' : '#0d0d11');

  document.querySelectorAll('[data-theme-option]').forEach(button => {
    const active = button.dataset.themeOption === state.theme;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function bindTheme() {
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-theme-option]');
    if (button) saveTheme(button.dataset.themeOption);
  });
  // Si está en «auto» y el sistema cambia de claro a oscuro, el panel sigue.
  window.matchMedia?.('(prefers-color-scheme: light)')?.addEventListener?.('change', () => {
    if (state.theme === 'auto') applyTheme();
  });
}

/* ---------------------------------------------------------------- */
/* Piezas de interfaz reutilizables                                  */
/* ---------------------------------------------------------------- */

function avatarMarkup(url, fallbackText = 'V', className = 'avatar') {
  const initial = escapeHtml(String(fallbackText || 'V').trim().slice(0, 1).toUpperCase());
  return url
    ? `<span class="${className}"><img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`
    : `<span class="${className}">${initial}</span>`;
}

function selectOptions(items, selected, emptyLabel = 'Sin configurar') {
  const current = String(selected ?? '');
  const options = (items || []).map(item => {
    const label = item.parent ? `${item.parent} / ${item.name}` : item.name;
    return `<option value="${escapeHtml(item.id)}"${String(item.id) === current ? ' selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
  return `<option value="">${escapeHtml(emptyLabel)}</option>${options}`;
}

function multiOptions(items, selected = []) {
  const chosen = new Set((selected || []).map(String));
  return (items || [])
    .map(item => `<option value="${escapeHtml(item.id)}"${chosen.has(String(item.id)) ? ' selected' : ''}>${escapeHtml(item.name)}</option>`)
    .join('');
}

function selectedValues(select) {
  return select ? [...select.selectedOptions].map(option => option.value).filter(Boolean) : [];
}

function card({ eyebrow, title, description, actions = '', body, id = '' }) {
  return `
    <section class="card"${id ? ` id="${id}"` : ''}>
      <div class="card-head">
        <div>
          ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
          <h2>${escapeHtml(title)}</h2>
          ${description ? `<p>${escapeHtml(description)}</p>` : ''}
        </div>
        ${actions ? `<div class="card-actions">${actions}</div>` : ''}
      </div>
      ${body}
    </section>`;
}

function emptyBlock(title, detail) {
  return `<div class="empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`;
}

function formActions(label, extra = '') {
  return `<div class="form-actions"><button class="button" type="submit">${escapeHtml(label)}</button>${extra}<span class="dirty-flag" hidden>Cambios sin guardar</span></div>`;
}

/* ---------------------------------------------------------------- */
/* Etiquetas de dominio                                              */
/* ---------------------------------------------------------------- */

const MODULES = {
  tiktok: ['Avisos de TikTok', 'Publica cuando una cuenta empieza directo o sube un video.'],
  twitch: ['Avisos de Twitch', 'Publica cuando un streamer empieza directo.'],
  youtube: ['Avisos de YouTube', 'Publica directos, videos y Shorts de los canales seguidos.'],
  welcome: ['Mensaje de bienvenida', 'Envía el embed de bienvenida cuando alguien entra.'],
  goodbye: ['Mensaje de despedida', 'Envía el embed de despedida cuando alguien sale.'],
  logs: ['Registro de eventos', 'Anota entradas, salidas, ediciones, baneos y cambios de canal.'],
  boosts: ['Agradecimiento por boosts', 'Publica un mensaje cuando alguien mejora el servidor con Nitro.'],
  deals: ['Ofertas de juegos', 'Avisa de juegos gratis de Epic, rebajas de Steam y sorteos de llaves.'],
  music: ['Reproductor de música', 'Habilita /musica y la reproducción en canales de voz.'],
  moderation: ['Moderación automática', 'Filtra enlaces, invitaciones, menciones y mensajes repetidos.'],
  tickets: ['Tickets de soporte', 'Panel de tickets con categoría y transcripciones.'],
  suggestions: ['Buzón de sugerencias', 'Habilita /sugerir y su revisión desde el panel.'],
  selfroles: ['Autorroles', 'Panel donde los miembros eligen sus propios roles.'],
  starboard: ['Mensajes destacados', 'Destaca mensajes que superan un número de reacciones.']
};

const moduleLabel = key => MODULES[key]?.[0] || key;
const moduleHint = key => MODULES[key]?.[1] || '';

const EMBED_KINDS = { welcome: 'Bienvenida', goodbye: 'Despedida' };

const VARIABLES = [
  ['{user}', 'menciona al miembro'],
  ['{username}', 'su nombre de usuario'],
  ['{displayName}', 'su apodo en el servidor'],
  ['{server}', 'nombre del servidor'],
  ['{memberCount}', 'total de miembros'],
  ['{userId}', 'su ID']
];

const TIER_LABELS = {
  primary_main: 'Main principal',
  themed_main: 'Main temático',
  satellite: 'Satélite',
  external: 'No aprobado'
};

const STATUS_LABELS = { active: 'Activo', resolved: 'Resuelto', revoked: 'Revocado' };
const ACTION_LABELS = { warning: 'Advertencia', timeout: 'Aislamiento', filter: 'Filtro automático' };
const SUGGESTION_LABELS = { open: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' };

/* ---------------------------------------------------------------- */
/* Vista previa estilo Discord                                       */
/* ---------------------------------------------------------------- */

// Render mínimo de Markdown para la vista previa. Se escapa PRIMERO y luego se
// aplican las marcas, así nada de lo que escriba el usuario puede inyectar HTML.
function renderMarkdown(value) {
  return escapeHtml(value ?? '')
    .split('\n')
    .map(line => {
      if (line.startsWith('-# ')) return `<span class="md-small">${line.slice(3)}</span>`;
      if (line.startsWith('### ')) return `<span class="md-h3">${line.slice(4)}</span>`;
      if (line.startsWith('## ')) return `<span class="md-h2">${line.slice(3)}</span>`;
      if (line.startsWith('# ')) return `<span class="md-h1">${line.slice(2)}</span>`;
      if (line.startsWith('&gt;&gt;&gt; ')) return `<span class="md-quote">${line.slice(12)}</span>`;
      if (line.startsWith('&gt; ')) return `<span class="md-quote">${line.slice(5)}</span>`;
      if (/^[-*] /.test(line)) return `<span class="md-bullet">${line.slice(2)}</span>`;
      if (/^\d+\. /.test(line)) return `<span class="md-bullet ordered">${line}</span>`;
      return line;
    })
    .join('<br>')
    .replace(/```([\s\S]+?)```/g, '<code class="md-block">$1</code>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<u>$1</u>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\|\|([^|]+)\|\|/g, '<span class="md-spoiler">$1</span>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<span class="md-link">$1</span>')
    .replace(/(@[\w-]+)/g, '<span class="md-mention">$1</span>');
}

// Valores de ejemplo para la vista previa. Cubren todas las variables del
// catálogo para que ningún marcador se quede sin sustituir en pantalla.
const SAMPLE = {
  user: '@nuevo-miembro',
  username: 'nuevo-miembro',
  userTag: 'nuevo-miembro#0001',
  displayName: 'Nuevo miembro',
  userId: '123456789012345678',
  executor: 'Yojan',
  channel: '#general',
  channelName: 'general',
  role: '@Miembro',
  roleName: 'Miembro',
  roles: '@Miembro, @Avisos',
  before: 'texto anterior',
  after: 'texto nuevo',
  content: 'contenido del mensaje',
  reason: 'enlace no permitido',
  case: 'A1B2C3',
  until: '12 de enero a las 18:00',
  from: '#voz-1',
  to: '#voz-2',
  creator: 'AnkerieDimension',
  title: 'Título de la publicación',
  url: 'https://ejemplo.com/publicacion',
  game: 'Just Chatting',
  viewers: '128',
  views: '4.320'
};

function sampleValues(text) {
  const guild = state.data?.guild;
  return String(text ?? '').replace(/\{(\w+)\}/g, (match, name) => {
    if (name === 'server') return guild?.name || 'tu servidor';
    if (name === 'memberCount') return formatNumber(guild?.memberCount ?? 0);
    return Object.hasOwn(SAMPLE, name) ? SAMPLE[name] : match;
  });
}

// Cabecera del mensaje: el autor que verá un miembro. Usa la identidad efectiva
// que calcula el backend (perfil → branding → cuenta del bot).
function messageHeaderMarkup({ name, avatar }) {
  return `
    ${avatarMarkup(avatar, name, 'discord-avatar')}
    <div class="discord-body">
      <div class="discord-author">
        <strong>${escapeHtml(name)}</strong>
        <span class="discord-tag">Bot</span>
        <span class="discord-time">hoy a las 14:32</span>
      </div>`;
}

function embedPreviewMarkup(values, options) {
  const { componentsV2 = false, memberAvatar = null } = options;
  const title = sampleValues(values.title);
  const message = sampleValues(values.message);
  const footer = sampleValues(values.footer);

  const thumb = !componentsV2 && values.thumbnail
    ? `<div class="embed-thumb">${memberAvatar ? `<img src="${escapeHtml(memberAvatar)}" alt="">` : '👤'}</div>`
    : '';

  const image = values.image
    ? `<img class="embed-image" src="${escapeHtml(values.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"
         data-fallback="La imagen no se pudo cargar. Comprueba que la URL sea pública y HTTPS.">`
    : '';

  // En el contenedor V2 el pie no es una pieza propia: se publica como texto
  // pequeño dentro del bloque, que es su equivalente exacto en Discord.
  const footerRow = footer
    ? (componentsV2
      ? `<div class="embed-subtext">${escapeHtml(footer)}</div>`
      : `<div class="embed-footer">${escapeHtml(footer)} · hoy a las 14:32</div>`)
    : '';

  return `
    <div class="embed-preview${componentsV2 ? ' v2' : ''}">
      <div class="embed-top">
        <div class="embed-text">
          <div class="embed-title">${renderMarkdown(title)}</div>
          ${componentsV2 ? '<div class="embed-divider"></div>' : ''}
          <div class="embed-desc">${renderMarkdown(message)}</div>
        </div>
        ${thumb}
      </div>
      ${image}
      ${footerRow}
    </div>`;
}

// Si una imagen remota falla, se sustituye por una nota explicativa en vez de
// dejar el icono roto del navegador, que no dice nada al usuario.
function wireImageFallbacks(root) {
  root.querySelectorAll('img[data-fallback]').forEach(image => {
    image.addEventListener('error', () => {
      const note = document.createElement('div');
      note.className = 'embed-image-fallback';
      note.textContent = image.dataset.fallback;
      image.replaceWith(note);
    }, { once: true });
  });
}

/* ---------------------------------------------------------------- */
/* Secciones                                                         */
/* ---------------------------------------------------------------- */

// La navegación está ordenada por LO QUE QUIERES HACER, no por cómo está
// hecho el bot por dentro. Nadie entra al panel pensando «voy a configurar el
// módulo de logs»: entra pensando «quiero saber quién borra mensajes».
const SECTIONS = [
  {
    id: 'inicio', group: 'Tu servidor', icon: '◉', label: 'Estado',
    title: 'Estado del servidor',
    hint: 'Qué está funcionando, qué falta y qué hay que arreglar.'
  },
  {
    id: 'apariencia', group: 'Tu servidor', icon: '✦', label: 'Apariencia',
    title: 'Cómo se ve Vesper',
    hint: 'Nombre, avatar y color con los que publica en este servidor.',
    needs: 'configure',
    feature: 'profile',
    keywords: ['identidad', 'nombre', 'avatar', 'color', 'marca', 'branding', 'apodo', 'tema']
  },

  {
    id: 'bienvenidas', group: 'Cuando pasa algo', icon: '✉', label: 'Entradas y salidas',
    title: 'Cuando alguien entra o sale',
    hint: 'Bienvenida, despedida y agradecimiento por los boosts.',
    needs: 'configure',
    keywords: ['bienvenida', 'despedida', 'boost', 'nitro', 'entrar', 'salir', 'saludo']
  },
  {
    id: 'registros', group: 'Cuando pasa algo', icon: '☰', label: 'Registros',
    title: 'Qué se anota y dónde',
    hint: 'Cada aviso por separado: se enciende, se apaga, se le cambia el canal y a quién menciona.',
    needs: 'configure',
    keywords: ['logs', 'registro', 'auditoría', 'canal', 'avisos', 'apagar', 'encender', 'mención', 'ping']
  },
  {
    id: 'avisos', group: 'Cuando pasa algo', icon: '◎', label: 'Avisos de redes',
    title: 'TikTok, Twitch y YouTube',
    hint: 'Cuentas vigiladas, canales de destino y rol al que avisar.',
    needs: 'social',
    feature: 'youtube',
    keywords: ['twitch', 'youtube', 'tiktok', 'directo', 'stream', 'video', 'short', 'notificación']
  },
  {
    id: 'ofertas', group: 'Cuando pasa algo', icon: '◈', label: 'Ofertas y juegos',
    title: 'Ofertas y juegos gratis',
    hint: 'Avisa cuando Epic regale un juego, Steam rebaje algo o aparezca un sorteo.',
    needs: 'configure',
    feature: 'deals',
    keywords: ['epic', 'steam', 'gratis', 'oferta', 'rebaja', 'sorteo', 'giveaway', 'juego']
  },

  {
    id: 'mensajes', group: 'Lo que dice', icon: '✎', label: 'Todos los mensajes',
    title: 'Todos los mensajes del bot',
    hint: 'Cada aviso, editable: texto, color, imagen, formato y tamaño de letra.',
    needs: 'configure',
    keywords: ['embed', 'texto', 'editar', 'plantilla', 'formato', 'letra', 'símbolos', 'markdown', 'título']
  },

  {
    id: 'moderacion', group: 'Comunidad', icon: '⚖', label: 'Moderación',
    title: 'Moderación',
    hint: 'Filtros automáticos, casos abiertos y sanciones.',
    keywords: ['filtro', 'baneo', 'aislar', 'sanción', 'caso', 'automod', 'enlaces', 'palabras']
  },
  {
    id: 'comunidad', group: 'Comunidad', icon: '☺', label: 'Comunidad',
    title: 'Tickets, sugerencias y roles',
    hint: 'Soporte, buzón de sugerencias, autorroles y mensajes destacados.',
    needs: 'configure',
    keywords: ['ticket', 'soporte', 'sugerencia', 'autorrol', 'selfrole', 'destacado', 'starboard']
  },
  {
    id: 'musica', group: 'Comunidad', icon: '♪', label: 'Música',
    title: 'Reproductor de música',
    hint: 'Canales permitidos, límites de la cola y estado del motor de audio.',
    needs: 'configure',
    feature: 'music',
    keywords: ['música', 'canción', 'voz', 'cola', 'volumen', 'dj', 'reproducir']
  },

  {
    id: 'modulos', group: 'Ajustes', icon: '⚙', label: 'Módulos y permisos',
    title: 'Módulos y permisos',
    hint: 'Qué funciones están activas y qué roles pueden usarlas.',
    needs: 'configure',
    keywords: ['módulo', 'activar', 'desactivar', 'permiso', 'rol', 'moderador', 'dj']
  },
  {
    id: 'resumen', group: 'Ajustes', icon: '≡', label: 'Configuración',
    title: 'Configuración completa',
    hint: 'Todo lo que Vesper tiene guardado de este servidor.',
    needs: 'configure',
    keywords: ['todo', 'exportar', 'copia', 'json', 'resumen']
  },
  {
    id: 'auditoria', group: 'Ajustes', icon: '⏱', label: 'Historial',
    title: 'Historial de cambios',
    hint: 'Quién cambió qué desde la web.',
    needs: 'configure',
    keywords: ['auditoría', 'historial', 'quién', 'cambio']
  }
];

function sectionAllowed(section) {
  if (!section.needs) return true;
  return Boolean(state.data?.permissions?.[section.needs]);
}

// Las funciones de plan NO se esconden: se enseñan bloqueadas y explicadas.
// Esconderlas dejaría al administrador preguntándose por qué a él le falta una
// pantalla que otro sí tiene.
function sectionLocked(section) {
  const feature = section.feature;
  if (!feature) return null;
  const plan = state.data?.plan;
  if (!plan || !plan.locked?.includes(feature)) return null;
  return plan.mainOnlyFeatures?.includes(feature) ? 'main' : 'premium';
}

const FEATURE_LABELS = {
  tiktok: 'los avisos de TikTok',
  twitch: 'los avisos de Twitch',
  youtube: 'los avisos de redes',
  deals: 'las ofertas y juegos gratis',
  music: 'la música',
  profile: 'la identidad propia del bot',
  discordPanel: 'el panel dentro de Discord',
  brandingCommands: 'los comandos de identidad'
};

function lockedScreen(section, kind) {
  const nombre = FEATURE_LABELS[section.feature] || 'esta función';
  return kind === 'main'
    ? card({
      eyebrow: 'Solo en los servidores principales',
      title: `Aquí no está ${nombre}`,
      description: 'Esto cambia el nombre y el avatar con los que el bot publica, o le ocupa un canal permanente. Se reserva a Embers Void y Ankerie Dimension.',
      body: `<p class="hint">En este servidor Vesper publica con el nombre y el avatar de su cuenta de Discord. Todo lo demás —mensajes, registros, moderación y comunidad— funciona igual que en cualquier otro sitio.</p>`
    })
    : card({
      eyebrow: 'Plan premium',
      title: `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} necesita plan`,
      description: 'No es un muro para sacar dinero: vigilar redes, reproducir música y consultar tiendas obligan a estar preguntando a todas horas, y eso consume procesador y cuota de verdad.',
      body: `
        <div class="locked-body">
          <p>Con el plan gratis sigues teniendo, sin límite:</p>
          <ul class="locked-list">
            <li>Bienvenidas, despedidas y agradecimiento por boosts</li>
            <li>Los 27 registros, cada uno con su canal y su mención</li>
            <li>Los 38 mensajes editables y los paquetes completos</li>
            <li>Moderación automática, tickets, sugerencias y autorroles</li>
          </ul>
          <p class="hint">Para pedir el plan, habla con el propietario del bot: puede concedértelo desde su panel en un clic.</p>
        </div>`
    });
}

function currentSection() {
  return SECTIONS.find(section => section.id === state.section) || SECTIONS[0];
}

/* ---------------------------------------------------------------- */
/* Inicio                                                            */
/* ---------------------------------------------------------------- */

// Un servidor recién añadido no necesita trece pantallas: necesita que
// alguien le pregunte qué quiere y lo deje funcionando. Esto aparece solo
// mientras falte lo básico, y desaparece cuando ya está montado.
const PRIMEROS_PASOS = [
  {
    id: 'saludar',
    titulo: 'Saludar a quien entra',
    detalle: 'Un mensaje de bienvenida en el canal que elijas.',
    icono: '✉',
    section: 'bienvenidas',
    listo: config => Boolean(config.general?.welcomeChannel),
    modulo: 'welcome'
  },
  {
    id: 'anotar',
    titulo: 'Llevar un registro',
    detalle: 'Quién entra, quién sale, qué se borra y quién modera.',
    icono: '☰',
    section: 'registros',
    listo: config => Boolean(config.general?.logChannel),
    modulo: 'logs'
  },
  {
    id: 'avisar',
    titulo: 'Avisar de directos y vídeos',
    detalle: 'TikTok, Twitch y YouTube, en el canal que quieras.',
    icono: '◎',
    section: 'avisos',
    listo: config => ['tiktok', 'twitch', 'youtube'].some(red => (config[red]?.users?.length || 0) > 0)
  },
  {
    id: 'voz',
    titulo: 'Darle una voz propia',
    detalle: 'Elige un paquete de mensajes o escribe los tuyos.',
    icono: '✎',
    section: 'mensajes',
    listo: config => Object.keys(config.embeds || {}).length > 0
  },
  {
    id: 'moderar',
    titulo: 'Moderar solo',
    detalle: 'Filtros de enlaces, palabras y menciones.',
    icono: '⚖',
    section: 'moderacion',
    listo: config => Boolean(config.features?.moderation)
  }
];

function primerosPasos() {
  const config = state.data.config || {};
  return PRIMEROS_PASOS.map(paso => ({ ...paso, hecho: paso.listo(config) }))
    .filter(paso => SECTIONS.some(section => section.id === paso.section && sectionAllowed(section)));
}

function guiaInicioCard() {
  const pasos = primerosPasos();
  const hechos = pasos.filter(paso => paso.hecho).length;
  // Cuando ya está casi todo montado, esto estorba más que ayuda.
  if (!pasos.length || hechos >= pasos.length - 1) return '';

  return card({
    eyebrow: 'Empieza por aquí',
    title: `Pon Vesper en marcha · ${hechos} de ${pasos.length}`,
    description: 'Elige lo que quieras que haga. No hace falta configurarlo todo, ni hacerlo en orden.',
    body: `
      <div class="steps">
        ${pasos.map(paso => `
          <button type="button" class="step${paso.hecho ? ' done' : ''}" data-goto="${escapeHtml(paso.section)}">
            <span class="step-icon" aria-hidden="true">${paso.hecho ? '✓' : paso.icono}</span>
            <span class="step-body">
              <strong>${escapeHtml(paso.titulo)}</strong>
              <small>${escapeHtml(paso.hecho ? 'Ya está listo. Puedes entrar a afinarlo.' : paso.detalle)}</small>
            </span>
            <span class="step-go" aria-hidden="true">→</span>
          </button>`).join('')}
      </div>`
  });
}

// El inicio ya no es una vitrina de cifras: es una lista de cosas que hacer.
// Cada problema dice qué pasa, qué consecuencia tiene y lleva de un clic a la
// pantalla donde se arregla.
function healthIssues() {
  const data = state.data;
  const health = state.health || data.health || {};
  const config = data.config || {};
  const general = config.general || {};
  const features = config.features || {};
  const issues = [];

  if (!state.session.user.discord) {
    issues.push({
      level: 'warn',
      title: 'Tu cuenta de Discord no está vinculada',
      detail: 'Con solo Google puedes configurar, pero no moderar ni gestionar cuentas de redes.',
      action: null
    });
  }

  if (health.database && !health.database.connected) {
    issues.push({
      level: 'bad',
      title: 'La base de datos está desconectada',
      detail: 'Vesper no puede guardar ni leer la configuración mientras siga así. Suele arreglarse solo en unos minutos.',
      action: null
    });
  }

  for (const monitor of health.monitors || []) {
    if (!monitor.disabledUntil) continue;
    issues.push({
      level: 'warn',
      title: `El monitor «${monitor.name}» está en pausa`,
      detail: `Falló varias veces seguidas. Se reanuda solo${formatDate(monitor.disabledUntil) ? ` el ${formatDate(monitor.disabledUntil)}` : ' en unos minutos'}.`,
      action: { section: 'avisos', label: 'Ver avisos de redes' }
    });
  }

  if (features.music && health.music && health.music.available === false) {
    issues.push({
      level: 'warn',
      title: 'El reproductor de música no está disponible',
      detail: health.music.reason || 'Faltan las herramientas de audio en el alojamiento.',
      action: { section: 'musica', label: 'Ver música' }
    });
  }

  // Módulos encendidos que no llegan a ninguna parte: es el error de
  // configuración más habitual y el más difícil de detectar desde Discord.
  const sinCanal = [
    [features.welcome, general.welcomeChannel, 'La bienvenida está activa pero no hay canal elegido', 'bienvenidas'],
    [features.goodbye, general.goodbyeChannel, 'La despedida está activa pero no hay canal elegido', 'bienvenidas'],
    [features.logs, general.logChannel, 'Los registros están activos pero no hay canal elegido', 'registros'],
    [features.deals, config.deals?.channel, 'Las ofertas están activas pero no hay canal elegido', 'ofertas']
  ];
  for (const [enabled, channel, title, section] of sinCanal) {
    if (enabled && !channel) {
      issues.push({
        level: 'warn',
        title,
        detail: 'Está encendido, pero no se publica en ningún sitio.',
        action: { section, label: 'Elegir canal' }
      });
    }
  }

  const avisosSinCanal = (data.alerts || [])
    .flatMap(group => group.items)
    .filter(item => item.enabled && !item.effectiveChannelId).length;
  if (avisosSinCanal) {
    issues.push({
      level: 'warn',
      title: `${avisosSinCanal} ${avisosSinCanal === 1 ? 'aviso encendido no tiene' : 'avisos encendidos no tienen'} canal`,
      detail: 'Están activos pero no se ven en ninguna parte.',
      action: { section: 'registros', label: 'Revisar registros' }
    });
  }

  for (const platform of ['tiktok', 'twitch', 'youtube']) {
    const cuentas = config[platform]?.users?.length || 0;
    const canales = [config[platform]?.liveChannel, config[platform]?.videoChannel, config[platform]?.shortChannel].filter(Boolean).length;
    if (features[platform] && cuentas && !canales) {
      issues.push({
        level: 'warn',
        title: `Vigilas ${cuentas} ${cuentas === 1 ? 'cuenta' : 'cuentas'} de ${platform} sin canal de destino`,
        detail: 'Vesper comprueba si hay novedades, pero no tiene dónde anunciarlas.',
        action: { section: 'avisos', label: 'Elegir canal' }
      });
    }
  }

  const activeCases = (data.cases || []).filter(item => item.status === 'active').length;
  if (activeCases) {
    issues.push({
      level: 'info',
      title: `${activeCases} ${activeCases === 1 ? 'caso de moderación abierto' : 'casos de moderación abiertos'}`,
      detail: 'Sanciones que siguen activas y todavía nadie ha cerrado.',
      action: { section: 'moderacion', label: 'Ver casos' }
    });
  }

  for (const check of (data.setup?.checks || []).filter(item => !item.ready)) {
    issues.push({
      level: 'info',
      title: `Falta configurar: ${check.label}`,
      detail: 'Vesper funciona sin esto, pero le falta una pieza.',
      action: null
    });
  }

  return issues;
}

function issueMarkup(issue) {
  const icon = { bad: '✕', warn: '!', info: '·' }[issue.level] || '·';
  return `
    <div class="issue ${escapeHtml(issue.level)}">
      <span class="issue-icon" aria-hidden="true">${icon}</span>
      <div class="issue-body">
        <strong>${escapeHtml(issue.title)}</strong>
        <small>${escapeHtml(issue.detail)}</small>
      </div>
      ${issue.action ? `<button class="button quiet sm" type="button" data-goto="${escapeHtml(issue.action.section)}">${escapeHtml(issue.action.label)}</button>` : ''}
    </div>`;
}

function renderInicio() {
  const data = state.data;
  const health = state.health || data.health || {};
  const setup = data.setup || { checks: [], percentage: 0, ready: 0, total: 0 };
  const issues = healthIssues();
  const graves = issues.filter(issue => issue.level === 'bad').length;
  const avisos = issues.filter(issue => issue.level === 'warn').length;

  const accounts = ['tiktok', 'twitch', 'youtube']
    .reduce((total, platform) => total + (data.config?.[platform]?.users?.length || 0), 0);
  const registrosActivos = (data.alerts || []).flatMap(group => group.items).filter(item => item.enabled).length;
  const activeModules = Object.values(data.config?.features || {}).filter(Boolean).length;

  const titular = graves
    ? { kind: 'bad', text: 'Hay algo roto', detail: 'Revisa lo primero de la lista.' }
    : avisos
      ? { kind: 'warn', text: 'Funciona, con reservas', detail: `${avisos} ${avisos === 1 ? 'cosa no está haciendo nada' : 'cosas no están haciendo nada'}.` }
      : { kind: 'ok', text: 'Todo en orden', detail: 'No hay nada que requiera tu atención.' };

  return `
    ${guiaInicioCard()}

    <div class="headline ${titular.kind}">
      <div class="headline-main">
        <span class="headline-dot" aria-hidden="true"></span>
        <div>
          <strong>${escapeHtml(titular.text)}</strong>
          <small>${escapeHtml(titular.detail)} ${escapeHtml(healthSummary(health))}</small>
        </div>
      </div>
      <div class="headline-meter">
        <div class="meter"><span data-meter="${setup.percentage}"></span></div>
        <small>${setup.ready} de ${setup.total} ajustes listos</small>
      </div>
    </div>

    ${card({
      eyebrow: issues.length ? 'Qué hacer' : 'Nada pendiente',
      title: issues.length ? `${issues.length} ${issues.length === 1 ? 'cosa por revisar' : 'cosas por revisar'}` : 'No hay nada por revisar',
      description: issues.length
        ? 'Ordenadas por gravedad. Cada una lleva a la pantalla donde se arregla.'
        : 'Los módulos activos tienen su canal, los monitores funcionan y no quedan casos abiertos.',
      body: issues.length
        ? `<div class="issue-list">${issues.slice(0, 12).map(issueMarkup).join('')}</div>${issues.length > 12 ? `<p class="hint">…y ${issues.length - 12} más.</p>` : ''}`
        : emptyBlock('Todo listo', 'Vuelve por aquí si cambias algo y quieres comprobar que sigue en pie.')
    })}

    <div class="stat-row">
      <div class="stat"><span class="stat-value">${activeModules}</span><span class="stat-label">módulos activos</span></div>
      <div class="stat"><span class="stat-value">${registrosActivos}</span><span class="stat-label">registros encendidos</span></div>
      <div class="stat"><span class="stat-value">${accounts}</span><span class="stat-label">cuentas vigiladas</span></div>
      <div class="stat"><span class="stat-value">${(data.cases || []).filter(item => item.status === 'active').length}</span><span class="stat-label">casos abiertos</span></div>
    </div>

    ${card({
      eyebrow: 'Atajos',
      title: '¿Qué quieres hacer?',
      description: 'Lo que más se toca. También puedes buscar cualquier ajuste con Ctrl+K.',
      body: `
        <div class="shortcut-grid">
          ${[
            ['bienvenidas', '✉', 'Cambiar la bienvenida', 'El mensaje que ve alguien al entrar.'],
            ['registros', '☰', 'Elegir qué se anota', 'Enciende o apaga cada registro por separado.'],
            ['mensajes', '✎', 'Editar los textos', 'Todos los mensajes del bot, con vista previa.'],
            ['avisos', '◎', 'Avisar de directos', 'TikTok, Twitch y YouTube.'],
            ['apariencia', '✦', 'Cambiar su cara', 'Nombre, avatar y color.'],
            ['modulos', '⚙', 'Encender funciones', 'Qué hace y qué no hace Vesper aquí.']
          ].filter(([id]) => SECTIONS.some(section => section.id === id && sectionAllowed(section)))
            .map(([id, icon, title, detail]) => `
            <button class="shortcut" type="button" data-goto="${id}">
              <span class="shortcut-icon" aria-hidden="true">${icon}</span>
              <strong>${escapeHtml(title)}</strong>
              <small>${escapeHtml(detail)}</small>
            </button>`).join('')}
        </div>`
    })}`;
}

function healthSummary(health) {
  if (!health.botReady) return 'El bot no está conectado a Discord';
  if (health.database && !health.database.connected) return 'La base de datos está reconectando';
  const paused = (health.monitors || []).filter(monitor => monitor.disabledUntil);
  if (paused.length) return `${paused.length} ${paused.length === 1 ? 'monitor' : 'monitores'} en pausa`;
  if (health.musicRequired && !health.musicHealthy) return 'El servicio de música no responde';
  return 'Todo funcionando con normalidad';
}

/* ---------------------------------------------------------------- */
/* Identidad                                                         */
/* ---------------------------------------------------------------- */

function renderIdentidad() {
  const data = state.data;
  const config = data.config;
  const identity = data.identity || {};
  const profile = config.profile || {};
  const branding = config.branding || {};
  const isMain = data.guild.tier === 'primary_main' || data.guild.tier === 'themed_main';

  const themeOptions = data.guild.tier === 'primary_main'
    ? [['void', 'Void · morado profundo'], ['custom', 'Personalizado']]
    : [['cinnamoroll', 'Cinnamoroll · nubes pastel'], ['custom', 'Personalizado']];

  const identityForm = isMain ? `
    <form id="form-profile" class="form">
      <div class="form-row">
        <div class="field">
          <label for="profile-name">Nombre visible</label>
          <input id="profile-name" type="text" maxlength="80" value="${escapeHtml(profile.displayName || '')}"
                 placeholder="${escapeHtml(identity.account?.username || 'Vesper')}">
          <span class="hint">Se usa como apodo del bot y como autor de sus mensajes.</span>
        </div>
        <div class="field">
          <label for="profile-theme">Estilo del servidor</label>
          <select id="profile-theme">
            ${themeOptions.map(([value, label]) => `<option value="${value}"${profile.theme === value ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}
          </select>
          <span class="hint">Solo es una etiqueta para reconocer el servidor. El claro y el oscuro del panel se eligen abajo a la izquierda, y son tuyos.</span>
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label for="profile-primary">Color principal</label>
          <div class="color-field"><input id="profile-primary" type="color" value="${escapeHtml(profile.primaryColor || '#9D63FF')}"></div>
          <span class="hint">Tiñe este panel y los embeds de bienvenida.</span>
        </div>
        <div class="field">
          <label for="profile-secondary">Color secundario</label>
          <div class="color-field"><input id="profile-secondary" type="color" value="${escapeHtml(profile.secondaryColor || '#747F8D')}"></div>
          <span class="hint">Se usa en los embeds de despedida.</span>
        </div>
      </div>
      <div class="field wide">
        <label for="profile-avatar">Avatar de los mensajes (URL HTTPS)</label>
        <input id="profile-avatar" type="url" maxlength="500" placeholder="https://…" value="${escapeHtml(profile.avatar || '')}">
        <span class="hint">El avatar de la cuenta de Discord es global y no se cambia aquí; este solo afecta a este servidor.</span>
      </div>
      <div class="field wide">
        <label for="profile-member-role">Rol automático para miembros nuevos</label>
        <select id="profile-member-role">${selectOptions(data.assignableRoles || [], profile.memberRole, 'Sin rol automático')}</select>
        <span class="hint">Solo aparecen roles que Vesper puede asignar por jerarquía.</span>
      </div>
      ${formActions('Guardar identidad')}
    </form>` : `
    <div class="callout">
      <strong>Este servidor no tiene identidad propia.</strong>
      <span>Los satélites publican con el nombre y el avatar de la cuenta del bot. Puedes ajustar el branding de los webhooks más abajo.</span>
    </div>`;

  const brandingForm = `
    <form id="form-branding" class="form">
      <div class="form-row">
        <div class="field">
          <label for="branding-name">Nombre en webhooks</label>
          <input id="branding-name" type="text" maxlength="80" value="${escapeHtml(branding.name || '')}"
                 placeholder="${escapeHtml(identity.account?.username || 'Vesper')}">
          <span class="hint">Solo se usa si no hay nombre visible arriba.</span>
        </div>
        <div class="field">
          <label for="branding-avatar">Avatar en webhooks (URL HTTPS)</label>
          <input id="branding-avatar" type="url" maxlength="500" placeholder="https://…" value="${escapeHtml(branding.avatar || '')}">
          <span class="hint">Alternativa de reserva si no hay avatar de identidad.</span>
        </div>
      </div>
      ${formActions('Guardar branding')}
    </form>`;

  return `
    ${card({
      eyebrow: 'Vista previa',
      title: 'Así te ve un miembro',
      description: 'Se actualiza mientras escribes. El nombre y el avatar salen del primer valor que encuentres relleno: identidad, branding y, si no, la cuenta del bot.',
      body: `
        <div class="preview-shell">
          <div class="discord-message" id="identity-preview"></div>
        </div>
        <div class="grid-3" id="identity-sources"></div>`
    })}

    ${card({
      eyebrow: 'Identidad',
      title: `Identidad en ${data.guild.name}`,
      description: 'Estos valores solo afectan a este servidor. Cada Main mantiene la suya.',
      body: identityForm
    })}

    ${card({
      eyebrow: 'Branding',
      title: 'Valores de reserva',
      description: 'Lo que usaban los comandos /setbotname, /setbotavatar y /branding. Se aplican cuando la identidad de arriba está vacía.',
      body: brandingForm
    })}`;
}

function identityValues() {
  const data = state.data;
  const identity = data.identity || {};
  const profileName = $('#profile-name')?.value.trim() || '';
  const profileAvatar = $('#profile-avatar')?.value.trim() || '';
  const brandingName = $('#branding-name')?.value.trim() || '';
  const brandingAvatar = $('#branding-avatar')?.value.trim() || '';
  const account = identity.account || {};

  return {
    name: profileName || brandingName || account.username || 'Vesper',
    avatar: profileAvatar || brandingAvatar || account.avatar || null,
    nameSource: profileName ? 'Identidad' : brandingName ? 'Branding' : 'Cuenta del bot',
    avatarSource: profileAvatar ? 'Identidad' : brandingAvatar ? 'Branding' : 'Cuenta del bot',
    account
  };
}

function refreshIdentityPreview() {
  const preview = $('#identity-preview');
  if (!preview) return;
  const values = identityValues();

  preview.innerHTML = `
    ${messageHeaderMarkup(values)}
      <div class="embed-desc">Ejemplo de mensaje publicado por Vesper en este servidor.</div>
    </div>`;
  wireImageFallbacks(preview);

  const sources = $('#identity-sources');
  if (sources) {
    sources.innerHTML = `
      <div class="stat"><small>Nombre</small><strong>${escapeHtml(values.name)}</strong><span class="stat-note">Desde: ${escapeHtml(values.nameSource)}</span></div>
      <div class="stat"><small>Avatar</small><strong>${escapeHtml(values.avatarSource)}</strong><span class="stat-note">${values.avatar ? 'Imagen configurada' : 'Sin imagen'}</span></div>
      <div class="stat"><small>Cuenta real del bot</small><strong>${escapeHtml(values.account.username || 'Vesper')}</strong><span class="stat-note">Global, igual en todos los servidores</span></div>`;
  }

  // El acento del panel sigue al color que estés eligiendo ahora mismo.
  const primary = $('#profile-primary')?.value;
  if (primary && state.data?.config?.profile) {
    state.data.config.profile.primaryColor = primary;
    applyTheme();
  }
}

/* ---------------------------------------------------------------- */
/* Formato del texto: barra, símbolos y letras decorativas           */
/* ---------------------------------------------------------------- */

// Cada botón de la barra o mete un prefijo al principio de la línea (los
// títulos, las citas y las listas) o envuelve lo seleccionado (negrita,
// cursiva, spoiler…). Nada de esto es magia del panel: es el Markdown que
// entiende Discord, escrito por ti sin tener que acordarte de los símbolos.
const FORMAT_TOOLS = [
  {
    group: 'Tamaño de la letra',
    tools: [
      { label: 'H1', prefix: '# ', title: 'Título muy grande — el tamaño más alto que permite Discord' },
      { label: 'H2', prefix: '## ', title: 'Título grande' },
      { label: 'H3', prefix: '### ', title: 'Título mediano, algo mayor que el texto normal' },
      { label: 'a', prefix: '-# ', title: 'Texto diminuto, ideal para notas al pie' }
    ]
  },
  {
    group: 'Estilo',
    tools: [
      { label: 'B', wrap: '**', title: 'Negrita' },
      { label: 'I', wrap: '*', title: 'Cursiva' },
      { label: 'U', wrap: '__', title: 'Subrayado' },
      { label: 'S', wrap: '~~', title: 'Tachado' },
      { label: '◼', wrap: '||', title: 'Spoiler: hay que pulsar para verlo' }
    ]
  },
  {
    group: 'Bloques',
    tools: [
      { label: '❝', prefix: '> ', title: 'Cita de una línea' },
      { label: '❞', prefix: '>>> ', title: 'Cita que sigue hasta el final del mensaje' },
      { label: '•', prefix: '- ', title: 'Lista con puntos' },
      { label: '1.', prefix: '1. ', title: 'Lista numerada' },
      { label: '‹›', wrap: '`', title: 'Código en línea' },
      { label: '⌗', wrap: '```\n', title: 'Bloque de código' }
    ]
  },
  {
    group: 'Insertar',
    tools: [
      { label: '🔗', insert: '[texto visible](https://ejemplo.com)', title: 'Enlace con texto propio' },
      { label: '—', insert: '\n', title: 'Salto de línea' }
    ]
  }
];

// Símbolos ornamentales, agrupados por el aire que dan. Son los que usan los
// diseños del servidor: se pulsan y se pegan donde esté el cursor.
const SYMBOL_SETS = [
  { name: 'Marcos y cierres', items: ['༺', '༻', '꒰', '꒱', '⟢', '⟣', '「', '」', '『', '』', '〔', '〕', '⦇', '⦈', '⌈', '⌉', '⌊', '⌋', '❪', '❫', '❲', '❳'] },
  { name: 'Estrellas y destellos', items: ['✦', '✧', '⋆', '✩', '✪', '★', '☆', '⁺', '˖', '࿔', '༉', '⊹', '✶', '✷', '✸', '❈', '❉', '✺'] },
  { name: 'Oscuro y gótico', items: ['⛧', '⸸', '✝', '☠', '⚰', '🕯', '𓆩', '𓆪', '𖤐', '☾', '☽', '☯', '⚔', '⛥', '☾°', '.⋆'] },
  { name: 'Corazones y suaves', items: ['♡', '❥', '❤', '♥', '˚', '୨', '୧', '⑅', '𓂃', '𓈒', '໒', '꒱', '♡̷̸', '❀', '✿', '❁', '⚘', '☁'] },
  { name: 'Líneas y separadores', items: ['─', '━', '┄', '┈', '╌', '═', '⎯', '▬', '▭', '▰', '▱', '⌗', '⌁', '⌇', '∿', '⋯', '⸻', '❖'] },
  { name: 'Flechas y punteros', items: ['➤', '➣', '➢', '⇾', '⟶', '↝', '⤷', '↳', '↴', '⌁', '⟡', '◈', '◆', '◇', '▸', '▹', '▪', '▫'] },
  { name: 'Sellos y avisos', items: ['⚠', '✔', '✖', '✧', '⌛', '⏳', '⏱', '🔔', '📌', '📎', '🔒', '🔓', '⚑', '✉', '❗', '❕'] }
];

// Alfabetos decorativos de Unicode. No son una fuente distinta: son letras de
// verdad, así que se ven igual en móvil y en ordenador y se pueden copiar.
const FANCY_EXCEPTIONS = {
  italic: { h: 'ℎ' },
  script: {
    B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ',
    M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ'
  },
  fraktur: { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' },
  outline: { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' }
};

const FANCY_FONTS = [
  { id: 'bold', label: 'Negrita sólida', upper: 0x1D400, lower: 0x1D41A, digits: 0x1D7CE },
  { id: 'italic', label: 'Cursiva fina', upper: 0x1D434, lower: 0x1D44E },
  { id: 'boldItalic', label: 'Cursiva gruesa', upper: 0x1D468, lower: 0x1D482 },
  { id: 'script', label: 'Caligrafía', upper: 0x1D49C, lower: 0x1D4B6 },
  { id: 'boldScript', label: 'Caligrafía gruesa', upper: 0x1D4D0, lower: 0x1D4EA },
  { id: 'fraktur', label: 'Gótica', upper: 0x1D504, lower: 0x1D51E },
  { id: 'boldFraktur', label: 'Gótica gruesa', upper: 0x1D56C, lower: 0x1D586 },
  { id: 'outline', label: 'Hueca', upper: 0x1D538, lower: 0x1D552, digits: 0x1D7D8 },
  { id: 'mono', label: 'Máquina de escribir', upper: 0x1D670, lower: 0x1D68A, digits: 0x1D7F6 },
  { id: 'wide', label: 'Ancha', upper: 0xFF21, lower: 0xFF41, digits: 0xFF10 },
  { id: 'smallCaps', label: 'Versalitas', table: 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ' }
];

function fancyText(font, text) {
  const chars = [...String(text ?? '')];
  return chars.map(char => {
    const exception = FANCY_EXCEPTIONS[font.id]?.[char];
    if (exception) return exception;
    const code = char.codePointAt(0);
    if (font.table) {
      const lower = char.toLowerCase();
      const index = lower.charCodeAt(0) - 97;
      return index >= 0 && index < 26 ? [...font.table][index] : char;
    }
    if (code >= 65 && code <= 90 && font.upper) return String.fromCodePoint(font.upper + code - 65);
    if (code >= 97 && code <= 122 && font.lower) return String.fromCodePoint(font.lower + code - 97);
    if (code >= 48 && code <= 57 && font.digits) return String.fromCodePoint(font.digits + code - 48);
    return char;
  }).join('');
}

// Barra de formato que se pinta encima de cada caja de texto.
function formatToolbar(targetId) {
  const groups = FORMAT_TOOLS.map(group => `
    <div class="format-group" role="group" aria-label="${escapeHtml(group.group)}">
      <span class="format-group-name">${escapeHtml(group.group)}</span>
      <div class="format-buttons">
        ${group.tools.map(tool => `
          <button type="button" class="format-button" title="${escapeHtml(tool.title)}"
                  data-format-target="${escapeHtml(targetId)}"
                  ${tool.prefix ? `data-prefix="${escapeHtml(tool.prefix)}"` : ''}
                  ${tool.wrap ? `data-wrap="${escapeHtml(tool.wrap)}"` : ''}
                  ${tool.insert ? `data-insert="${escapeHtml(tool.insert)}"` : ''}>${escapeHtml(tool.label)}</button>`).join('')}
      </div>
    </div>`).join('');

  return `<div class="format-toolbar" data-toolbar-for="${escapeHtml(targetId)}">
    ${groups}
    <div class="format-group">
      <span class="format-group-name">Adornos</span>
      <div class="format-buttons">
        <button type="button" class="format-button wide" data-symbols-for="${escapeHtml(targetId)}">Símbolos y letras…</button>
      </div>
    </div>
  </div>`;
}

// Aplica el formato sobre la caja de texto, respetando lo que haya
// seleccionado. Si no hay selección, deja el cursor listo para escribir dentro.
function applyFormat(field, { prefix, wrap, insert }) {
  if (!field) return;
  const value = field.value;
  const start = field.selectionStart ?? value.length;
  const end = field.selectionEnd ?? start;
  let next = value;
  let cursor = end;

  if (prefix) {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const line = value.slice(lineStart);
    const already = line.startsWith(prefix);
    next = already
      ? value.slice(0, lineStart) + line.slice(prefix.length)
      : value.slice(0, lineStart) + prefix + value.slice(lineStart);
    cursor = already ? Math.max(lineStart, start - prefix.length) : start + prefix.length;
  } else if (wrap) {
    const closing = wrap === '```\n' ? '\n```' : wrap;
    const selected = value.slice(start, end);
    next = `${value.slice(0, start)}${wrap}${selected || 'texto'}${closing}${value.slice(end)}`;
    cursor = start + wrap.length + (selected || 'texto').length;
  } else if (insert) {
    next = value.slice(0, start) + insert + value.slice(end);
    cursor = start + insert.length;
  }

  field.value = next;
  field.focus();
  field.setSelectionRange(cursor, cursor);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

// Panel de símbolos y alfabetos. Se abre desde la barra y escribe en la misma
// caja desde la que se abrió.
function openSymbolPicker(targetId) {
  const field = document.getElementById(targetId);
  if (!field) return;

  const dialog = $('#symbol-dialog');
  const grid = $('#symbol-grid');
  const sample = $('#symbol-sample');
  const fancy = $('#symbol-fancy');
  if (!dialog || !grid) return;

  grid.innerHTML = SYMBOL_SETS.map(set => `
    <div class="symbol-set">
      <h4>${escapeHtml(set.name)}</h4>
      <div class="symbol-row">
        ${set.items.map(symbol => `<button type="button" class="symbol" data-symbol="${escapeHtml(symbol)}">${escapeHtml(symbol)}</button>`).join('')}
      </div>
    </div>`).join('');

  const paintFancy = () => {
    const text = sample.value.trim() || 'Bienvenido';
    fancy.innerHTML = FANCY_FONTS.map(font => `
      <li>
        <span class="fancy-label">${escapeHtml(font.label)}</span>
        <code class="fancy-sample">${escapeHtml(fancyText(font, text))}</code>
        <button type="button" class="button ghost sm" data-fancy="${escapeHtml(font.id)}">Insertar</button>
      </li>`).join('');
  };
  paintFancy();

  const onInput = () => paintFancy();
  const onClick = event => {
    const symbol = event.target.closest('[data-symbol]');
    if (symbol) {
      applyFormat(field, { insert: symbol.dataset.symbol });
      return;
    }
    const fancyButton = event.target.closest('[data-fancy]');
    if (fancyButton) {
      const font = FANCY_FONTS.find(item => item.id === fancyButton.dataset.fancy);
      if (font) applyFormat(field, { insert: fancyText(font, sample.value.trim() || 'Bienvenido') });
    }
  };

  sample.addEventListener('input', onInput);
  dialog.addEventListener('click', onClick);
  dialog.addEventListener('close', () => {
    sample.removeEventListener('input', onInput);
    dialog.removeEventListener('click', onClick);
  }, { once: true });

  dialog.showModal();
}

// Enlaza la barra de formato de una pantalla entera.
function wireFormatting(root) {
  root.querySelectorAll('[data-format-target]').forEach(button => {
    button.addEventListener('click', () => {
      applyFormat(document.getElementById(button.dataset.formatTarget), {
        prefix: button.dataset.prefix,
        wrap: button.dataset.wrap,
        insert: button.dataset.insert
      });
    });
  });
  root.querySelectorAll('[data-symbols-for]').forEach(button => {
    button.addEventListener('click', () => openSymbolPicker(button.dataset.symbolsFor));
  });
}

// Marca visualmente qué formato está elegido.
function wireLayoutChoice(root) {
  root.querySelectorAll('.layout-choice').forEach(choice => {
    choice.addEventListener('change', () => {
      choice.querySelectorAll('.layout-option').forEach(option => {
        option.classList.toggle('selected', Boolean(option.querySelector('input')?.checked));
      });
    });
  });
}

// La guía: qué símbolo hace qué, con el resultado al lado.
const FORMAT_GUIDE = [
  { group: 'Hacer la letra más grande', rows: [
    ['# Texto', 'El tamaño más grande. Tiene que ir al principio de la línea, con un espacio después de la almohadilla.'],
    ['## Texto', 'Un escalón por debajo.'],
    ['### Texto', 'El más discreto de los tres, pero se sigue notando frente al texto normal.'],
    ['-# Texto', 'Al revés: hace la letra diminuta y gris. Es lo que se usa para notas y pies.']
  ] },
  { group: 'Estilo de la letra', rows: [
    ['**Texto**', 'Negrita.'],
    ['*Texto*', 'Cursiva.'],
    ['***Texto***', 'Negrita y cursiva a la vez.'],
    ['__Texto__', 'Subrayado.'],
    ['~~Texto~~', 'Tachado.'],
    ['||Texto||', 'Spoiler: sale tapado hasta que alguien lo pulsa.']
  ] },
  { group: 'Bloques y listas', rows: [
    ['> Texto', 'Cita: una barra vertical a la izquierda.'],
    ['>>> Texto', 'Cita larga: todo lo que venga después queda dentro.'],
    ['- Texto', 'Punto de lista. Con dos espacios delante se anida.'],
    ['1. Texto', 'Lista numerada.'],
    ['`Texto`', 'Código en línea, con fondo oscuro.'],
    ['``` … ```', 'Bloque de código de varias líneas: tres acentos graves en su propia línea, arriba y abajo del texto.']
  ] },
  { group: 'Enlaces y menciones', rows: [
    ['[Visítanos](https://…)', 'Enlace con el texto que tú quieras. Solo funciona dentro de un embed, no en un mensaje normal.'],
    ['{user}', 'Menciona a la persona del evento; Discord la pinta en azul.'],
    ['<@&ID>', 'Menciona un rol concreto por su identificador.'],
    ['<#ID>', 'Enlaza a un canal.'],
    ['<t:1700000000:R>', 'Fecha que se actualiza sola («hace 3 minutos»).']
  ] },
  { group: 'Trucos de maquetación', rows: [
    ['Línea en blanco', 'Separa párrafos. Dentro de un embed se respetan todas las que dejes.'],
    ['⠀ (espacio Braille)', 'Un espacio que Discord no recorta, útil para centrar a ojo.'],
    ['─────────', 'Una línea de guiones largos hace de separador dentro del texto.'],
    ['Emojis del servidor', 'Escribe <:nombre:ID> y sale el emoji personalizado, también en los embeds.']
  ] }
];

function formatGuideCard() {
  const blocks = FORMAT_GUIDE.map(section => `
    <div class="guide-block">
      <h4>${escapeHtml(section.group)}</h4>
      <table class="guide-table">
        <tbody>
          ${section.rows.map(([symbol, meaning]) => `
            <tr>
              <td><code>${escapeHtml(symbol)}</code></td>
              <td>${escapeHtml(meaning)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`).join('');

  const sampleText = '# ⛧°. ⋆༺ Título grande ༻⋆. °⛧\n### Un subtítulo\n\n**Negrita**, *cursiva*, __subrayado__ y ~~tachado~~.\n> Una cita.\n-# Y una nota pequeña al final.';

  return card({
    eyebrow: 'Cómo escribir',
    title: 'Guía de formato',
    description: 'Discord no tiene botones de tamaño: el tamaño se pide con símbolos al principio de la línea. Aquí están todos, con lo que hace cada uno.',
    body: `
      <details class="guide" open>
        <summary>Ver la tabla completa de símbolos</summary>
        <div class="guide-body">
          ${blocks}
          <div class="guide-block">
            <h4>Cómo se ve todo junto</h4>
            <div class="guide-demo">
              <pre class="guide-source">${escapeHtml(sampleText)}</pre>
              <div class="guide-result">${renderMarkdown(sampleText)}</div>
            </div>
            <p class="hint">Lo de la izquierda es lo que escribes; lo de la derecha, lo que ve la gente en Discord.</p>
          </div>
          <div class="guide-block">
            <h4>Adornos y letras decorativas</h4>
            <p class="hint">Las letras raras de los diseños del servidor (𝐴 𝑛𝑒𝑤 𝑤𝑎𝑛𝑑𝑒𝑟𝑒𝑟, 𝑾𝒆𝒍𝒄𝒐𝒎𝒆…) no son una fuente: son caracteres de Unicode. Pulsa «Símbolos y letras…» encima de cualquier caja de texto para elegirlos e insertarlos donde tengas el cursor.</p>
          </div>
        </div>
      </details>`
  });
}

/* ---------------------------------------------------------------- */
/* Bienvenidas                                                       */
/* ---------------------------------------------------------------- */

// Selector de formato. Las dos versiones están disponibles en todos los
// servidores y en todos los mensajes: la que viene marcada al abrir es la que
// ese mensaje trae de fábrica aquí, así que no cambia nada hasta que se toca.
function layoutChooser(idPrefix, dataAttr, kind, saved, factoryLayout) {
  const current = saved === 'classic' || saved === 'components_v2' ? saved : 'auto';
  const name = `${idPrefix}-${kind}-layout`;
  const option = (value, title, description) => `
    <label class="layout-option${current === value ? ' selected' : ''}">
      <input type="radio" name="${name}" value="${value}" ${dataAttr}="${kind}" ${current === value ? 'checked' : ''}>
      <span class="layout-figure layout-${value === 'auto' ? (factoryLayout === 'components_v2' ? 'components_v2' : 'classic') : value}" aria-hidden="true"></span>
      <span class="layout-text">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(description)}</small>
      </span>
    </label>`;

  const factoryName = factoryLayout === 'components_v2' ? 'contenedor V2' : 'embed clásico';

  return `
    <div class="field wide">
      <span class="field-label">Formato del mensaje</span>
      <div class="layout-choice" role="radiogroup" aria-label="Formato del mensaje">
        ${option('auto', 'El de siempre', `Lo que trae de fábrica aquí: ${factoryName}.`)}
        ${option('classic', 'Embed clásico', 'Barra de color al lado, miniatura, campos y pie con la hora.')}
        ${option('components_v2', 'Contenedor V2', 'Bloque con borde de color y títulos grandes. El estilo de Embers Void.')}
      </div>
      <span class="hint">Puedes cambiar de formato sin perder el texto: el mismo contenido se pinta de las dos maneras. El contenedor V2 no tiene miniatura y muestra el pie como texto pequeño.</span>
    </div>`;
}

function embedEditorCard(kind) {
  const data = state.data;
  const defaults = data.embedDefaults || {};
  const fallback = defaults[kind] || {};
  const saved = data.config.embeds?.[kind] || {};
  const label = EMBED_KINDS[kind];
  const hasColor = Boolean(saved.color);

  const footerField = defaults.supportsFooter ? `
    <div class="field wide">
      <label for="embed-${kind}-footer">Pie de página</label>
      <input id="embed-${kind}-footer" type="text" maxlength="200" data-embed="${kind}"
             value="${escapeHtml(saved.footer || '')}" placeholder="${escapeHtml(`${data.identity?.webhook?.name || 'Vesper'} • ${data.guild.name}`)}">
    </div>` : '';

  const thumbnailField = defaults.supportsThumbnail ? `
    <label class="inline-check">
      <input id="embed-${kind}-thumbnail" type="checkbox" data-embed="${kind}" ${saved.thumbnail === false ? '' : 'checked'}>
      <span>Mostrar el avatar del miembro</span>
    </label>` : '';

  return card({
    eyebrow: `Embed de ${label.toLowerCase()}`,
    title: label,
    description: 'Deja un campo vacío para conservar el texto original del servidor.',
    actions: `<button class="button ghost sm" type="button" data-embed-reset="${kind}">Restablecer</button>`,
    body: `
      <div class="editor-layout">
        <form id="form-embed-${kind}" class="form">
          ${layoutChooser('embed', 'data-embed', kind, saved.layout, defaults.layout)}
          <div class="field wide">
            <label for="embed-${kind}-title">Título</label>
            ${formatToolbar(`embed-${kind}-title`)}
            <input id="embed-${kind}-title" type="text" maxlength="240" data-embed="${kind}"
                   value="${escapeHtml(saved.title || '')}" placeholder="${escapeHtml(fallback.title || '')}">
          </div>
          <div class="field wide">
            <label for="embed-${kind}-message">Mensaje</label>
            ${formatToolbar(`embed-${kind}-message`)}
            <textarea id="embed-${kind}-message" maxlength="3000" data-embed="${kind}"
                      placeholder="${escapeHtml(fallback.message || '')}">${escapeHtml(saved.message || '')}</textarea>
          </div>
          ${footerField}
          <div class="field wide">
            <label for="embed-${kind}-image">Imagen o GIF (URL HTTPS)</label>
            <input id="embed-${kind}-image" type="url" maxlength="500" data-embed="${kind}"
                   value="${escapeHtml(saved.image || '')}" placeholder="${escapeHtml(fallback.image || 'https://…')}">
          </div>
          <div class="form-row">
            <div class="field">
              <span class="field-label">Color</span>
              <div class="color-field">
                <input id="embed-${kind}-color" type="color" data-embed="${kind}"
                       value="${escapeHtml(saved.color || fallback.color || '#5865F2')}" ${hasColor ? '' : 'disabled'}>
                <label class="inline-check">
                  <input id="embed-${kind}-usecolor" type="checkbox" data-embed="${kind}" ${hasColor ? 'checked' : ''}>
                  <span>Usar color propio</span>
                </label>
              </div>
            </div>
            <div class="field">${thumbnailField}</div>
          </div>
          ${formActions(`Guardar ${label.toLowerCase()}`)}
        </form>

        <div class="editor-preview">
          <p class="eyebrow">Vista previa</p>
          <div class="preview-shell">
            <div class="discord-message" id="preview-${kind}"></div>
          </div>
          <p class="preview-caption">Aproximación. Discord ajusta el espaciado y el tamaño de la imagen.</p>
        </div>
      </div>`
  });
}

function chosenLayout(name) {
  const picked = document.querySelector(`input[name="${name}"]:checked`);
  return picked && picked.value !== 'auto' ? picked.value : null;
}

function embedValues(kind) {
  const read = suffix => $(`#embed-${kind}-${suffix}`)?.value ?? '';
  const useColor = $(`#embed-${kind}-usecolor`)?.checked;
  const thumbnail = $(`#embed-${kind}-thumbnail`);
  return {
    layout: chosenLayout(`embed-${kind}-layout`),
    title: read('title').trim() || null,
    message: read('message').trim() || null,
    footer: read('footer').trim() || null,
    image: read('image').trim() || null,
    color: useColor ? read('color') : null,
    thumbnail: thumbnail ? thumbnail.checked : true
  };
}

function refreshEmbedPreview(kind) {
  const container = $(`#preview-${kind}`);
  if (!container) return;
  const data = state.data;
  const defaults = data.embedDefaults || {};
  const fallback = defaults[kind] || {};
  const values = embedValues(kind);
  const componentsV2 = (values.layout || defaults.layout) === 'components_v2';

  const resolved = {
    title: values.title ?? fallback.title,
    message: values.message ?? fallback.message,
    footer: values.footer ?? (componentsV2 ? null : `${data.identity?.webhook?.name || 'Vesper'} • ${data.guild.name}`),
    image: values.image ?? fallback.image ?? null,
    thumbnail: values.thumbnail
  };
  const color = values.color || fallback.color || '#5865F2';
  const author = identityValues();

  container.innerHTML = `
    ${messageHeaderMarkup(author)}
      ${embedPreviewMarkup(resolved, { componentsV2, memberAvatar: state.session.user.discord?.avatar || null })}
    </div>`;

  const embed = container.querySelector('.embed-preview');
  if (embed) embed.style.setProperty('--embed-accent', color);
  wireImageFallbacks(container);
}

function renderBienvenidas() {
  const data = state.data;
  const config = data.config;
  const defaults = data.embedDefaults || {};
  const features = config.features || {};

  const variables = VARIABLES.map(([token, description]) =>
    `<li><button type="button" data-variable="${escapeHtml(token)}"><code>${escapeHtml(token)}</code></button> · ${escapeHtml(description)}</li>`).join('');

  const channelWarnings = [];
  if (features.welcome && !config.general?.welcomeChannel) channelWarnings.push('El módulo de bienvenida está activo pero no hay canal elegido: el mensaje no se publica en ningún sitio.');
  if (features.goodbye && !config.general?.goodbyeChannel) channelWarnings.push('El módulo de despedida está activo pero no hay canal elegido.');

  return `
    ${channelWarnings.length ? `<div class="callout warn"><strong>Revisa los canales.</strong><span>${escapeHtml(channelWarnings.join(' '))}</span></div>` : ''}

    ${card({
      eyebrow: 'Dónde se publican',
      title: 'Canales de bienvenida y despedida',
      description: 'Solo aparecen canales de texto donde Vesper puede escribir e insertar enlaces.',
      body: `
        <form id="form-welcome-channels" class="form">
          <div class="form-row">
            <div class="field">
              <label for="channel-welcome">Canal de bienvenida</label>
              <select id="channel-welcome">${selectOptions(data.channels, config.general?.welcomeChannel)}</select>
            </div>
            <div class="field">
              <label for="channel-goodbye">Canal de despedida</label>
              <select id="channel-goodbye">${selectOptions(data.channels, config.general?.goodbyeChannel)}</select>
            </div>
            <div class="field">
              <label for="channel-boost">Canal de agradecimiento por boosts</label>
              <select id="channel-boost">${selectOptions(data.channels, config.general?.boostChannel, 'Usar el de bienvenida')}</select>
              <span class="hint">Donde Vesper da las gracias cuando alguien mejora el servidor.</span>
            </div>
          </div>
          ${formActions('Guardar canales')}
        </form>`
    })}

    ${formatGuideCard()}

    ${card({
      eyebrow: 'Variables',
      title: 'Variables disponibles',
      description: `${defaults.note || ''} Pulsa una variable para copiarla.`,
      body: `<ul class="var-list">${variables}</ul>`
    })}

    ${embedEditorCard('welcome')}
    ${embedEditorCard('goodbye')}`;
}

/* ---------------------------------------------------------------- */
/* Todos los mensajes del bot                                        */
/* ---------------------------------------------------------------- */

// Valores con los que sale un mensaje si no se toca nada. Para bienvenida y
// despedida los calcula el backend a partir del diseño real del servidor; para
// el resto vienen del catálogo.
function messageFactoryDefaults(item) {
  const embedDefaults = state.data.embedDefaults || {};
  if (item.id === 'welcome' || item.id === 'goodbye') return embedDefaults[item.id] || {};
  return item.factory || {};
}

function messageEditorMarkup(item) {
  const saved = state.data.config.embeds?.[item.id] || {};
  const factory = messageFactoryDefaults(item);
  const hasColor = Boolean(saved.color);
  const customised = ['title', 'message', 'footer', 'image', 'color', 'layout'].some(field => saved[field]);

  const layoutField = item.plainText
    ? ''
    : layoutChooser('msg', 'data-msg', item.id, saved.layout, item.defaultLayout);

  const titleField = item.plainText ? '' : `
    <div class="field wide">
      <label for="msg-${item.id}-title">Título</label>
      ${formatToolbar(`msg-${item.id}-title`)}
      <input id="msg-${item.id}-title" type="text" maxlength="240" data-msg="${item.id}"
             value="${escapeHtml(saved.title || '')}" placeholder="${escapeHtml(factory.title || 'Sin título')}">
    </div>`;

  const footerField = item.supports.footer ? `
    <div class="field">
      <label for="msg-${item.id}-footer">Pie de página</label>
      <input id="msg-${item.id}-footer" type="text" maxlength="200" data-msg="${item.id}" value="${escapeHtml(saved.footer || '')}">
    </div>` : '';

  const imageField = item.supports.image ? `
    <div class="field">
      <label for="msg-${item.id}-image">Imagen (URL HTTPS)</label>
      <input id="msg-${item.id}-image" type="url" maxlength="500" data-msg="${item.id}"
             value="${escapeHtml(saved.image || '')}" placeholder="${escapeHtml(factory.image || 'https://…')}">
    </div>` : '';

  const colorField = item.plainText ? '' : `
    <div class="field">
      <span class="field-label">Color</span>
      <div class="color-field">
        <input id="msg-${item.id}-color" type="color" data-msg="${item.id}"
               value="${escapeHtml(saved.color || factory.color || '#5865F2')}" ${hasColor ? '' : 'disabled'}>
        <label class="inline-check">
          <input id="msg-${item.id}-usecolor" type="checkbox" data-msg="${item.id}" ${hasColor ? 'checked' : ''}>
          <span>Usar color propio</span>
        </label>
      </div>
    </div>`;

  const thumbField = item.supports.thumbnail ? `
    <label class="inline-check">
      <input id="msg-${item.id}-thumbnail" type="checkbox" data-msg="${item.id}" ${saved.thumbnail === false ? '' : 'checked'}>
      <span>Mostrar la imagen de perfil</span>
    </label>` : '';

  const variables = (item.variables || []).map(([token, description]) =>
    `<li><button type="button" data-variable="${escapeHtml(token)}"><code>${escapeHtml(token)}</code></button> · ${escapeHtml(description)}</li>`).join('');

  const bodyHint = item.plainText
    ? 'Este mensaje es texto normal, no un embed.'
    : 'Si lo dejas vacío se conservan los campos originales del aviso. Si escribes algo, sustituye el cuerpo entero.';

  return `
    <details class="message-item"${customised ? ' open' : ''} data-message="${item.id}">
      <summary>
        <span class="message-summary">
          <strong>${escapeHtml(item.label)}</strong>
          <small>${escapeHtml(item.description)}</small>
        </span>
        <span class="tag ${customised ? 'accent' : ''}">${customised ? 'Personalizado' : 'Original'}</span>
      </summary>
      <div class="editor-layout">
        <form id="form-msg-${item.id}" class="form">
          ${layoutField}
          ${titleField}
          <div class="field wide">
            <label for="msg-${item.id}-message">${item.plainText ? 'Mensaje' : 'Cuerpo del mensaje'}</label>
            ${formatToolbar(`msg-${item.id}-message`)}
            <textarea id="msg-${item.id}-message" maxlength="3000" data-msg="${item.id}"
                      placeholder="${escapeHtml(factory.message || '')}">${escapeHtml(saved.message || '')}</textarea>
            <span class="hint">${escapeHtml(bodyHint)}</span>
          </div>
          <div class="form-row">
            ${colorField}
            ${footerField}
            ${imageField}
            ${thumbField ? `<div class="field">${thumbField}</div>` : ''}
          </div>
          <ul class="var-list">${variables}</ul>
          <div class="form-actions">
            <button class="button" type="submit">Guardar</button>
            <button class="button ghost" type="button" data-msg-reset="${item.id}" ${customised ? '' : 'disabled'}>Restablecer</button>
            <span class="dirty-flag" hidden>Cambios sin guardar</span>
          </div>
        </form>
        <div class="editor-preview">
          <p class="eyebrow">Vista previa</p>
          <div class="preview-shell"><div class="discord-message" id="msg-preview-${item.id}"></div></div>
        </div>
      </div>
    </details>`;
}

function messageValues(id) {
  const read = suffix => document.querySelector(`#msg-${id}-${suffix}`)?.value ?? '';
  const useColor = document.querySelector(`#msg-${id}-usecolor`)?.checked;
  const thumbnail = document.querySelector(`#msg-${id}-thumbnail`);
  const colorInput = document.querySelector(`#msg-${id}-color`);
  const values = {
    title: read('title').trim() || null,
    message: read('message').trim() || null,
    footer: read('footer').trim() || null,
    image: read('image').trim() || null
  };
  if (document.querySelector(`input[name="msg-${id}-layout"]`)) values.layout = chosenLayout(`msg-${id}-layout`);
  if (colorInput) values.color = useColor ? read('color') : null;
  if (thumbnail) values.thumbnail = thumbnail.checked;
  return values;
}

function refreshMessagePreview(item) {
  const container = document.querySelector(`#msg-preview-${item.id}`);
  if (!container) return;
  const factory = messageFactoryDefaults(item);
  const values = messageValues(item.id);
  const author = identityValues();

  if (item.plainText) {
    const text = sampleValues(values.message ?? factory.message ?? '');
    container.innerHTML = `${messageHeaderMarkup(author)}<div class="embed-desc">${renderMarkdown(text)}</div></div>`;
    return;
  }

  const resolved = {
    title: values.title ?? factory.title,
    message: values.message ?? factory.message ?? '(campos originales del aviso)',
    footer: values.footer,
    image: values.image ?? factory.image ?? null,
    thumbnail: values.thumbnail !== false && item.supports.thumbnail
  };
  const color = values.color || factory.color || '#5865F2';

  container.innerHTML = `${messageHeaderMarkup(author)}${embedPreviewMarkup(resolved, {
    componentsV2: (values.layout || item.defaultLayout) === 'components_v2',
    memberAvatar: state.session.user.discord?.avatar || null
  })}</div>`;

  const embed = container.querySelector('.embed-preview');
  if (embed) embed.style.setProperty('--embed-accent', color);
  wireImageFallbacks(container);
}

/* ---------------------------------------------------------------- */
/* Paquetes de mensajes                                              */
/* ---------------------------------------------------------------- */

// Personalizar 38 mensajes a mano es una tarde entera. Un paquete los escribe
// todos de golpe en una misma voz, y luego se retoca lo que haga falta.
function themeCardMarkup(theme) {
  const sample = theme.sample?.welcome || {};
  return `
    <button type="button" class="theme-card" data-apply-theme="${escapeHtml(theme.id)}">
      <span class="theme-swatches" aria-hidden="true">
        ${(theme.swatches || []).map(color => `<span data-swatch="${escapeHtml(color)}"></span>`).join('')}
      </span>
      <strong>${escapeHtml(theme.name)}</strong>
      <small>${escapeHtml(theme.tagline)}</small>
      <span class="theme-sample">${renderMarkdown(sampleValues(sample.title || ''))}</span>
      <span class="theme-count">${theme.count} mensajes</span>
    </button>`;
}

function themePickerCard() {
  const themes = state.data.messageThemes || [];
  if (!themes.length) return '';

  return card({
    eyebrow: 'De una vez',
    title: 'Paquetes de mensajes',
    description: 'Escriben los 38 avisos de golpe, en un mismo tono y con una misma paleta. Luego puedes retocar los que quieras uno a uno.',
    body: `
      <div class="theme-grid">
        ${themes.map(themeCardMarkup).join('')}
        <button type="button" class="theme-card plain" data-apply-theme="ninguno">
          <span class="theme-swatches" aria-hidden="true">${['#5865F2', '#57F287', '#ED4245', '#FAA61A'].map(color => `<span data-swatch="${color}"></span>`).join('')}</span>
          <strong>Sin paquete</strong>
          <small>Los textos originales de Vesper, sin ninguna personalización.</small>
          <span class="theme-sample">📥 Miembro entró</span>
          <span class="theme-count">vuelve a lo de fábrica</span>
        </button>
      </div>
      <p class="hint">Aplicar un paquete sobrescribe lo que hayas escrito en los 38 mensajes. Se puede deshacer eligiendo otro, o volviendo a «Sin paquete».</p>`
  });
}

function bindThemePicker(root) {
  // El panel prohíbe los atributos `style` en línea por su propia política de
  // seguridad, así que las muestras de color se pintan desde JavaScript.
  root.querySelectorAll('[data-swatch]').forEach(swatch => {
    swatch.style.setProperty('--c', swatch.dataset.swatch);
  });

  root.querySelectorAll('[data-apply-theme]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset.applyTheme;
      const theme = (state.data.messageThemes || []).find(item => item.id === id);
      const nombre = theme?.name || 'los textos originales';

      if (!await confirmDialog({
        title: id === 'ninguno' ? 'Quitar la personalización' : `Aplicar el paquete «${nombre}»`,
        message: id === 'ninguno'
          ? 'Los 38 mensajes volverán a su texto original y se perderá lo que hayas escrito.'
          : `Se reescribirán los 38 mensajes con el tono de «${nombre}». Se perderá lo que hayas escrito en ellos.`,
        confirmLabel: id === 'ninguno' ? 'Quitar' : 'Aplicar',
        danger: true
      })) return;

      button.disabled = true;
      try {
        const result = await api(`/guilds/${state.guildId}/message-theme`, {
          method: 'POST',
          body: JSON.stringify({ theme: id })
        });
        state.data.config = result.config;
        toast(id === 'ninguno' ? 'Mensajes devueltos a su texto original.' : `Paquete «${nombre}» aplicado.`, 'ok');
        await selectGuild(state.guildId, { keepSection: true, silent: true });
      } catch (error) {
        toast(error.message, 'bad');
      } finally {
        button.disabled = false;
      }
    });
  });
}

function renderMensajes() {
  const catalog = state.data.messageCatalog || [];
  if (!catalog.length) {
    return card({ eyebrow: 'Mensajes', title: 'No hay catálogo disponible', description: 'Actualiza la página para volver a cargarlo.', body: '' });
  }

  const total = catalog.reduce((sum, group) => sum + group.items.length, 0);
  const customised = catalog.reduce((sum, group) =>
    sum + group.items.filter(item => ['title', 'message', 'footer', 'image', 'color', 'layout']
      .some(field => state.data.config.embeds?.[item.id]?.[field])).length, 0);

  const groups = catalog.map(group => card({
    eyebrow: group.group,
    title: `${group.items.length} ${group.items.length === 1 ? 'mensaje' : 'mensajes'}`,
    description: 'Despliega cualquiera para editarlo. La vista previa se actualiza mientras escribes.',
    body: `<div class="message-list">${group.items.map(messageEditorMarkup).join('')}</div>`
  })).join('');

  return `
    <div class="callout info">
      <strong>${customised} de ${total} mensajes personalizados.</strong>
      <span>Los que no toques salen exactamente como siempre. Vaciar un campo lo devuelve a su valor original, y cada mensaje puede publicarse como embed clásico o como contenedor V2.</span>
    </div>
    ${themePickerCard()}
    ${formatGuideCard()}
    ${groups}`;
}

function bindMensajes(root) {
  const items = (state.data.messageCatalog || []).flatMap(group => group.items);
  wireFormatting(root);
  wireLayoutChoice(root);
  bindThemePicker(root);

  for (const item of items) {
    const form = root.querySelector(`#form-msg-${item.id}`);
    if (!form) continue;

    const update = () => refreshMessagePreview(item);
    form.addEventListener('input', event => {
      if (event.target.id === `msg-${item.id}-usecolor`) {
        const picker = document.querySelector(`#msg-${item.id}-color`);
        if (picker) picker.disabled = !event.target.checked;
      }
      update();
    });
    form.addEventListener('change', update);

    form.addEventListener('submit', event => {
      event.preventDefault();
      saveConfig({ embeds: { [item.id]: messageValues(item.id) } }, `«${item.label}» guardado.`, event.submitter);
    });

    root.querySelector(`[data-msg-reset="${item.id}"]`)?.addEventListener('click', async event => {
      if (!await confirmDialog({
        title: `Restablecer «${item.label}»`,
        message: 'Volverá al formato original y se perderá tu texto.',
        confirmLabel: 'Restablecer',
        danger: true
      })) return;
      saveConfig(
        { embeds: { [item.id]: { title: null, message: null, footer: null, image: null, color: null, layout: null, thumbnail: true } } },
        `«${item.label}» restablecido.`,
        event.currentTarget
      );
    });

    // La vista previa solo se pinta al desplegar, para no montar 30 a la vez.
    const details = root.querySelector(`[data-message="${item.id}"]`);
    details?.addEventListener('toggle', () => { if (details.open) update(); });
    if (details?.open) update();
  }

  root.querySelectorAll('[data-variable]').forEach(button => {
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.variable);
        toast(`${button.dataset.variable} copiado.`, 'ok');
      } catch {
        toast(`Copia manualmente: ${button.dataset.variable}`, 'bad');
      }
    });
  });
}

/* ---------------------------------------------------------------- */
/* Avisos de redes                                                   */
/* ---------------------------------------------------------------- */

const PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', placeholder: '@usuario o enlace del perfil',
    channels: [['liveChannel', 'Canal de directos'], ['videoChannel', 'Canal de videos']] },
  { id: 'twitch', name: 'Twitch', placeholder: 'nombre del streamer',
    channels: [['liveChannel', 'Canal de directos']] },
  { id: 'youtube', name: 'YouTube', placeholder: 'URL, @handle o nombre del canal',
    channels: [['liveChannel', 'Canal de directos'], ['videoChannel', 'Canal de videos'], ['shortChannel', 'Canal de Shorts']] }
];

function renderAvisos() {
  const data = state.data;
  const config = data.config;
  const canEdit = data.permissions.social;

  const cards = PLATFORMS.map(platform => {
    const section = config[platform.id] || {};
    const accounts = section.users || [];
    const enabled = config.features?.[platform.id];
    const noChannel = accounts.length > 0 && !platform.channels.some(([field]) => section[field]);

    const chips = accounts.length
      ? accounts.map(account => `
          <span class="chip">
            <span>${escapeHtml(account)}</span>
            ${canEdit ? `<button type="button" data-remove-account="${escapeHtml(account)}" data-platform="${platform.id}" aria-label="Dejar de seguir a ${escapeHtml(account)}">×</button>` : ''}
          </span>`).join('')
      : '<span class="hint">Todavía no sigues ninguna cuenta.</span>';

    return card({
      eyebrow: platform.name,
      title: `${accounts.length} ${accounts.length === 1 ? 'cuenta vigilada' : 'cuentas vigiladas'}`,
      description: `Vesper comprueba estas cuentas periódicamente y avisa en el canal que elijas.`,
      actions: `<span class="tag ${enabled ? 'ok' : 'warn'}">${enabled ? 'Módulo activo' : 'Módulo apagado'}</span>`,
      body: `
        ${noChannel ? '<div class="callout warn"><strong>Falta el canal de destino.</strong><span>Tienes cuentas vigiladas pero los avisos no tienen dónde publicarse.</span></div>' : ''}
        ${canEdit ? `
        <form class="form" data-add-account="${platform.id}">
          <div class="form-row">
            <div class="field wide">
              <label for="add-${platform.id}">Añadir cuenta</label>
              <div class="color-field">
                <input id="add-${platform.id}" type="text" name="account" maxlength="200" placeholder="${escapeHtml(platform.placeholder)}" required>
                <button class="button" type="submit">Añadir</button>
              </div>
              <span class="hint">Vesper verifica que la cuenta existe antes de guardarla.</span>
            </div>
          </div>
        </form>` : ''}
        <div class="chips watched-accounts">${chips}</div>
        <form class="form" data-platform-channels="${platform.id}">
          <div class="form-row">
            ${platform.channels.map(([field, label]) => `
              <div class="field">
                <label for="${platform.id}-${field}">${escapeHtml(label)}</label>
                <select id="${platform.id}-${field}" data-field="${field}">${selectOptions(data.channels, section[field])}</select>
              </div>`).join('')}
            <div class="field">
              <label for="${platform.id}-pingRole">Rol al que avisar</label>
              <select id="${platform.id}-pingRole" data-field="pingRole">${selectOptions(data.roles, section.pingRole, 'Sin mención')}</select>
            </div>
          </div>
          ${data.permissions.configure ? formActions(`Guardar ${platform.name}`) : ''}
        </form>`
    });
  }).join('');

  const notice = !canEdit
    ? '<div class="callout warn"><strong>Solo lectura.</strong><span>Necesitas el permiso de gestión de redes, o vincular tu cuenta de Discord, para añadir o quitar cuentas.</span></div>'
    : '';

  return `${notice}${cards}`;
}

/* ---------------------------------------------------------------- */
/* Ofertas y juegos gratis                                           */
/* ---------------------------------------------------------------- */

const GIVEAWAY_PLATFORMS = [
  ['steam', 'Steam'], ['epic-games-store', 'Epic Games'], ['gog', 'GOG'],
  ['ubisoft', 'Ubisoft'], ['origin', 'EA'], ['itchio', 'itch.io'],
  ['battlenet', 'Battle.net'], ['drm-free', 'Sin DRM'],
  ['xbox-one', 'Xbox'], ['ps4', 'PlayStation'], ['switch', 'Switch'],
  ['android', 'Android'], ['ios', 'iOS'], ['vr', 'VR']
];

function renderOfertas() {
  const data = state.data;
  const deals = data.config.deals || {};
  const enabled = data.config.features?.deals;
  const chosen = new Set(deals.giveawayPlatforms || ['steam', 'epic-games-store', 'gog']);

  return `
    ${!enabled ? '<div class="callout warn"><strong>El módulo de ofertas está apagado.</strong><span>Actívalo en «Módulos y permisos» para que Vesper empiece a publicar.</span></div>' : ''}

    ${card({
      eyebrow: 'Cómo funciona',
      title: 'Tres fuentes, ninguna de pago',
      description: 'Vesper consulta cada media hora y publica solo lo que no haya publicado antes en este servidor.',
      body: `
        <div class="grid-3">
          <div class="stat"><small>Epic Games</small><strong>Juegos gratis</strong><span class="stat-note">El regalo semanal y el de la semana siguiente. Endpoint público de su tienda.</span></div>
          <div class="stat"><small>Sorteos</small><strong>Llaves y DLC</strong><span class="stat-note">Steam, GOG, Ubisoft, itch.io y más, vía GamerPower. Sin clave.</span></div>
          <div class="stat"><small>Steam</small><strong>Rebajas</strong><span class="stat-note">Ofertas de la portada por encima del descuento que elijas.</span></div>
        </div>`
    })}

    ${card({
      eyebrow: 'Dónde y a quién',
      title: 'Canal de publicación',
      description: 'Sin canal elegido, el módulo no publica nada aunque esté activo.',
      body: `
        <form id="form-deals" class="form">
          <div class="form-row">
            <div class="field">
              <label for="deals-channel">Canal de ofertas</label>
              <select id="deals-channel">${selectOptions(data.channels, deals.channel)}</select>
            </div>
            <div class="field">
              <label for="deals-ping">Rol al que avisar</label>
              <select id="deals-ping">${selectOptions(data.roles, deals.pingRole, 'Sin mención')}</select>
            </div>
            <div class="field">
              <label for="deals-max">Máximo de avisos por ronda</label>
              <input id="deals-max" type="number" min="1" max="10" value="${Number(deals.maxPerCycle ?? 5)}">
              <span class="hint">Evita una avalancha si aparecen muchas ofertas de golpe.</span>
            </div>
          </div>

          <div class="switch-list">
            <label class="switch">
              <input id="deals-epic" type="checkbox" ${deals.epicFree !== false ? 'checked' : ''}>
              <span class="switch-copy"><strong>Juegos gratis de Epic Games</strong><small>El regalo semanal y el anuncio del siguiente.</small></span>
            </label>
            <label class="switch">
              <input id="deals-giveaways" type="checkbox" ${deals.giveaways !== false ? 'checked' : ''}>
              <span class="switch-copy"><strong>Sorteos y llaves gratis</strong><small>Juegos, DLC y llaves de varias tiendas.</small></span>
            </label>
            <label class="switch">
              <input id="deals-steam" type="checkbox" ${deals.steamSpecials === true ? 'checked' : ''}>
              <span class="switch-copy"><strong>Rebajas de Steam</strong><small>Puede ser ruidoso: ajusta el descuento mínimo.</small></span>
            </label>
          </div>

          <div class="form-row">
            <div class="field">
              <label for="deals-discount">Descuento mínimo de Steam (%)</label>
              <input id="deals-discount" type="number" min="10" max="95" value="${Number(deals.minDiscount ?? 50)}">
            </div>
            <div class="field wide">
              <label for="deals-platforms">Tiendas de los sorteos</label>
              <select id="deals-platforms" multiple>
                ${GIVEAWAY_PLATFORMS.map(([value, label]) => `<option value="${value}"${chosen.has(value) ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}
              </select>
              <span class="hint">Mantén Ctrl o Cmd para elegir varias.</span>
            </div>
          </div>
          ${formActions('Guardar ofertas')}
        </form>`
    })}

    <div class="callout info">
      <strong>Los textos de estos avisos también se editan.</strong>
      <span>Están en «Todos los mensajes», grupo «Ofertas y juegos gratis».</span>
    </div>`;
}

function bindOfertas(root) {
  root.querySelector('#form-deals')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ deals: {
      channel: $('#deals-channel').value || null,
      pingRole: $('#deals-ping').value || null,
      epicFree: $('#deals-epic').checked,
      giveaways: $('#deals-giveaways').checked,
      steamSpecials: $('#deals-steam').checked,
      minDiscount: Number($('#deals-discount').value),
      maxPerCycle: Number($('#deals-max').value),
      giveawayPlatforms: selectedValues($('#deals-platforms'))
    } }, 'Ofertas actualizadas.', event.submitter);
  });
}

/* ---------------------------------------------------------------- */
/* Moderación                                                        */
/* ---------------------------------------------------------------- */

function caseRowsMarkup() {
  const data = state.data;
  const canModerate = data.permissions.moderate;
  if (!data.cases?.length) return `<tr><td colspan="${canModerate ? 7 : 6}">${escapeHtml('No hay casos registrados.')}</td></tr>`;

  return data.cases.map(item => `
    <tr>
      <td class="mono">#${escapeHtml(item.id)}</td>
      <td class="mono">${escapeHtml(item.userId)}</td>
      <td>${escapeHtml(ACTION_LABELS[item.action] || item.action)}</td>
      <td><span class="tag ${item.status === 'active' ? 'warn' : item.status === 'revoked' ? '' : 'ok'}">${escapeHtml(STATUS_LABELS[item.status] || item.status)}</span></td>
      <td class="wrap">${escapeHtml(item.reason)}</td>
      <td>${escapeHtml(formatDate(item.createdAt))}</td>
      ${canModerate ? `<td><div class="row-actions">
        <button class="button ghost sm" type="button" data-case-note="${escapeHtml(item.id)}">Nota</button>
        ${item.status === 'active'
          ? `<button class="button quiet sm" type="button" data-case-status="${escapeHtml(item.id)}" data-status="resolved">Resolver</button>`
          : `<button class="button quiet sm" type="button" data-case-status="${escapeHtml(item.id)}" data-status="active">Reabrir</button>`}
        ${item.status !== 'revoked' ? `<button class="button danger sm" type="button" data-case-status="${escapeHtml(item.id)}" data-status="revoked">Revocar</button>` : ''}
      </div></td>` : ''}
    </tr>`).join('');
}

function renderModeracion() {
  const data = state.data;
  const config = data.config;
  const canModerate = data.permissions.moderate;
  const canConfigure = data.permissions.configure;
  const moderationOn = data.modules?.moderation;

  const automod = canConfigure ? card({
    eyebrow: 'Automático',
    title: 'Filtros de mensajes',
    description: 'Vesper revisa cada mensaje y actúa solo cuando se cumple una de estas reglas. Los administradores y los roles excluidos nunca se filtran.',
    actions: `<span class="tag ${moderationOn ? 'ok' : 'warn'}">${moderationOn ? 'Módulo activo' : 'Módulo apagado'}</span>`,
    body: `
      <form id="form-automod" class="form">
        <div class="switch-list">
          <label class="switch">
            <input id="automod-links" type="checkbox" ${config.moderation?.filterLinks ? 'checked' : ''}>
            <span class="switch-copy"><strong>Filtrar enlaces</strong><small>Borra mensajes con enlaces a dominios que no estén en la lista permitida.</small></span>
          </label>
          <label class="switch">
            <input id="automod-invites" type="checkbox" ${config.moderation?.blockInvites ? 'checked' : ''}>
            <span class="switch-copy"><strong>Bloquear invitaciones de Discord</strong><small>Borra los enlaces discord.gg y similares.</small></span>
          </label>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="automod-mentions">Máximo de menciones por mensaje</label>
            <input id="automod-mentions" type="number" min="1" max="25" value="${Number(config.moderation?.maxMentions ?? 5)}">
          </div>
          <div class="field">
            <label for="automod-repeat">Repeticiones permitidas</label>
            <input id="automod-repeat" type="number" min="2" max="15" value="${Number(config.moderation?.repeatLimit ?? 4)}">
            <span class="hint">Mismo mensaje repetido en menos de 30 segundos.</span>
          </div>
          <div class="field">
            <label for="automod-action">Qué hacer al detectar</label>
            <select id="automod-action">
              ${[['delete', 'Solo borrar el mensaje'], ['warn', 'Borrar y advertir'], ['timeout', 'Borrar y aislar 5 minutos']]
                .map(([value, label]) => `<option value="${value}"${config.moderation?.action === value ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field wide">
          <label for="automod-domains">Dominios permitidos</label>
          <textarea id="automod-domains" placeholder="youtube.com&#10;twitch.tv">${escapeHtml((config.moderation?.allowedDomains || []).join('\n'))}</textarea>
          <span class="hint">Uno por línea, sin rutas. Solo se aplica si «Filtrar enlaces» está activo.</span>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="automod-exempt-channels">Canales excluidos</label>
            <select id="automod-exempt-channels" multiple>${multiOptions(data.channels, config.moderation?.exemptChannels)}</select>
          </div>
          <div class="field">
            <label for="automod-exempt-roles">Roles excluidos</label>
            <select id="automod-exempt-roles" multiple>${multiOptions(data.roles, config.moderation?.exemptRoles)}</select>
            <span class="hint">Mantén Ctrl o Cmd para elegir varios.</span>
          </div>
        </div>
        ${formActions('Guardar filtros')}
      </form>`
  }) : '';

  const newCase = canModerate ? card({
    eyebrow: 'Manual',
    title: 'Registrar una sanción',
    description: 'Busca al miembro por su nombre; no hace falta copiar IDs.',
    body: `
      ${!moderationOn ? '<div class="callout warn"><strong>El módulo de moderación está apagado.</strong><span>Actívalo en «Módulos y permisos» para poder registrar casos.</span></div>' : ''}
      <form id="form-case" class="form">
        <div class="field wide">
          <label for="case-search">Buscar miembro</label>
          <input id="case-search" type="search" autocomplete="off" placeholder="Escribe al menos dos letras de su nombre">
          <span class="hint" id="case-search-status">Escribe al menos dos caracteres.</span>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="case-user">Miembro</label>
            <select id="case-user" name="userId" required><option value="">Busca y selecciona</option></select>
          </div>
          <div class="field">
            <label for="case-action">Acción</label>
            <select id="case-action" name="action">
              <option value="warning">Advertencia</option>
              <option value="timeout">Aislamiento temporal</option>
            </select>
          </div>
          <div class="field" id="case-minutes-field" hidden>
            <label for="case-minutes">Duración en minutos</label>
            <input id="case-minutes" name="minutes" type="number" min="1" max="40320" value="10">
          </div>
        </div>
        <div class="field wide">
          <label for="case-reason">Motivo</label>
          <textarea id="case-reason" name="reason" maxlength="1000" required placeholder="Queda registrado en el caso y se envía al miembro si es una advertencia."></textarea>
        </div>
        <div class="form-actions">
          <button class="button" type="submit" ${moderationOn ? '' : 'disabled'}>Registrar sanción</button>
        </div>
      </form>`
  }) : '';

  const history = card({
    eyebrow: 'Historial',
    title: canModerate ? 'Casos recientes' : 'Mis casos',
    description: canModerate
      ? 'Los 25 casos más recientes del servidor.'
      : 'Solo tú puedes ver esta lista. Ningún otro miembro tiene acceso a tus casos.',
    actions: '<button class="button quiet sm" type="button" id="reload-cases">Recargar</button>',
    body: `
      <div class="table-scroll">
        <table>
          <thead><tr><th>Caso</th><th>Usuario</th><th>Acción</th><th>Estado</th><th>Motivo</th><th>Fecha</th>${canModerate ? '<th>Acciones</th>' : ''}</tr></thead>
          <tbody id="case-rows">${caseRowsMarkup()}</tbody>
        </table>
      </div>`
  });

  return `${automod}${newCase}${history}`;
}

/* ---------------------------------------------------------------- */
/* Comunidad                                                         */
/* ---------------------------------------------------------------- */

function renderComunidad() {
  const data = state.data;
  const config = data.config;
  const community = config.community || {};
  const features = config.features || {};

  const suggestions = (data.suggestions || []).map(item => `
    <tr>
      <td class="mono">${escapeHtml(item.userId)}</td>
      <td class="wrap">${escapeHtml(item.text)}${item.reviewNote ? `<br><small>Nota: ${escapeHtml(item.reviewNote)}</small>` : ''}</td>
      <td><span class="tag ${item.status === 'approved' ? 'ok' : item.status === 'rejected' ? 'bad' : 'warn'}">${escapeHtml(SUGGESTION_LABELS[item.status] || item.status)}</span></td>
      <td>${escapeHtml(formatDate(item.createdAt))}</td>
      <td><div class="row-actions">
        <button class="button ghost sm" type="button" data-suggestion="${escapeHtml(item.messageId)}" data-status="open" ${item.status === 'open' ? 'disabled' : ''}>Pendiente</button>
        <button class="button quiet sm" type="button" data-suggestion="${escapeHtml(item.messageId)}" data-status="approved" ${item.status === 'approved' ? 'disabled' : ''}>Aprobar</button>
        <button class="button danger sm" type="button" data-suggestion="${escapeHtml(item.messageId)}" data-status="rejected" ${item.status === 'rejected' ? 'disabled' : ''}>Rechazar</button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="5">Todavía no hay sugerencias.</td></tr>';

  return `
    ${card({
      eyebrow: 'Tickets',
      title: 'Soporte por tickets',
      description: 'Los miembros abren un ticket desde un panel y Vesper crea un canal privado con el equipo.',
      actions: `<span class="tag ${features.tickets ? 'ok' : 'warn'}">${features.tickets ? 'Activo' : 'Apagado'}</span>
                <button class="button quiet sm" type="button" id="publish-tickets">Publicar panel</button>`,
      body: `
        <form id="form-tickets" class="form">
          <div class="form-row">
            <div class="field">
              <label for="ticket-panel">Canal del panel</label>
              <select id="ticket-panel">${selectOptions(data.channels, community.tickets?.panelChannel)}</select>
            </div>
            <div class="field">
              <label for="ticket-category">Categoría para los tickets</label>
              <select id="ticket-category">${selectOptions(data.categories || [], community.tickets?.category, 'Sin categoría')}</select>
            </div>
            <div class="field">
              <label for="ticket-transcripts">Canal de transcripciones</label>
              <select id="ticket-transcripts">${selectOptions(data.channels, community.tickets?.transcriptChannel)}</select>
            </div>
            <div class="field">
              <label for="ticket-limit">Tickets abiertos por usuario</label>
              <input id="ticket-limit" type="number" min="1" max="5" value="${Number(community.tickets?.maxOpenPerUser ?? 1)}">
            </div>
            <div class="field wide">
              <label for="ticket-staff">Roles de soporte</label>
              <select id="ticket-staff" multiple>${multiOptions(data.roles, community.tickets?.staffRoles)}</select>
            </div>
          </div>
          ${formActions('Guardar tickets')}
        </form>`
    })}

    ${card({
      eyebrow: 'Sugerencias',
      title: 'Buzón de sugerencias',
      description: 'Los miembros usan /sugerir y tú apruebas o rechazas desde aquí.',
      actions: `<span class="tag ${features.suggestions ? 'ok' : 'warn'}">${features.suggestions ? 'Activo' : 'Apagado'}</span>`,
      body: `
        <form id="form-suggestions" class="form">
          <div class="field wide">
            <label for="suggestions-channel">Canal de sugerencias</label>
            <select id="suggestions-channel">${selectOptions(data.channels, community.suggestions?.channel)}</select>
          </div>
          ${formActions('Guardar canal')}
        </form>
        <div class="table-scroll">
          <table>
            <thead><tr><th>Usuario</th><th>Sugerencia</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
            <tbody>${suggestions}</tbody>
          </table>
        </div>`
    })}

    ${card({
      eyebrow: 'Autorroles',
      title: 'Roles que los miembros eligen',
      description: 'Solo se ofrecen roles que Vesper puede asignar por jerarquía.',
      actions: `<span class="tag ${features.selfroles ? 'ok' : 'warn'}">${features.selfroles ? 'Activo' : 'Apagado'}</span>
                <button class="button quiet sm" type="button" id="publish-selfroles">Publicar panel</button>`,
      body: `
        <form id="form-selfroles" class="form">
          <div class="form-row">
            <div class="field">
              <label for="selfroles-channel">Canal del panel</label>
              <select id="selfroles-channel">${selectOptions(data.channels, community.selfRoles?.panelChannel)}</select>
            </div>
            <div class="field">
              <label for="selfroles-roles">Roles disponibles</label>
              <select id="selfroles-roles" multiple>${multiOptions(data.assignableRoles || [], (community.selfRoles?.roles || []).map(item => item.roleId))}</select>
            </div>
          </div>
          ${formActions('Guardar autorroles')}
        </form>`
    })}

    ${card({
      eyebrow: 'Destacados',
      title: 'Mensajes destacados',
      description: 'Cuando un mensaje supera el número de reacciones, Vesper lo copia al canal de destacados.',
      actions: `<span class="tag ${features.starboard ? 'ok' : 'warn'}">${features.starboard ? 'Activo' : 'Apagado'}</span>`,
      body: `
        <form id="form-starboard" class="form">
          <div class="form-row">
            <div class="field">
              <label for="starboard-channel">Canal de destacados</label>
              <select id="starboard-channel">${selectOptions(data.channels, community.starboard?.channel)}</select>
            </div>
            <div class="field">
              <label for="starboard-threshold">Reacciones necesarias</label>
              <input id="starboard-threshold" type="number" min="2" max="50" value="${Number(community.starboard?.threshold ?? 3)}">
            </div>
            <div class="field">
              <label for="starboard-emoji">Emoji</label>
              <input id="starboard-emoji" type="text" maxlength="100" value="${escapeHtml(community.starboard?.emoji || '⭐')}">
            </div>
            <div class="field">
              <label for="starboard-ignored">Canales ignorados</label>
              <select id="starboard-ignored" multiple>${multiOptions(data.channels, community.starboard?.ignoredChannels)}</select>
            </div>
          </div>
          ${formActions('Guardar destacados')}
        </form>`
    })}`;
}

/* ---------------------------------------------------------------- */
/* Música                                                            */
/* ---------------------------------------------------------------- */

function renderMusica() {
  const data = state.data;
  const config = data.config;
  const music = config.music || {};
  const health = state.health || {};
  const limits = [
    ['defaultVolume', 'Volumen por defecto', 1, 100, 'Con el que empieza cada sesión.'],
    ['maxQueue', 'Máximo de canciones en cola', 1, 500, ''],
    ['maxPerUser', 'Canciones pendientes por usuario', 1, 25, 'Evita que una persona ocupe toda la cola.'],
    ['maxTrackMinutes', 'Duración máxima por pista', 1, 180, ''],
    ['idleSeconds', 'Segundos de inactividad antes de salir', 30, 3600, 'Vesper abandona el canal si se queda solo.']
  ];

  return `
    ${!config.features?.music ? '<div class="callout warn"><strong>El módulo de música está apagado.</strong><span>Actívalo en «Módulos y permisos» para que /musica funcione.</span></div>' : ''}
    ${health.music?.available === false
      ? `<div class="callout warn"><strong>El reproductor no está disponible.</strong><span>${escapeHtml(health.music.reason || 'Faltan las herramientas de audio en el alojamiento.')}</span></div>`
      : '<div class="callout ok"><strong>El reproductor está listo.</strong><span>Vesper busca y reproduce por su cuenta, dentro del mismo proceso. No hace falta ningún servidor de música aparte ni pagar nada.</span></div>'}

    ${card({
      eyebrow: 'Música',
      title: 'Dónde se puede pedir música',
      description: 'Deja los campos vacíos para permitir cualquier canal.',
      body: `
        <form id="form-music" class="form">
          <div class="form-row">
            <div class="field">
              <label for="music-request">Canal de solicitudes</label>
              <select id="music-request">${selectOptions(data.channels, music.requestChannel, 'Cualquier canal de texto')}</select>
            </div>
            <div class="field">
              <label for="music-voice">Canal de voz preferido</label>
              <select id="music-voice">${selectOptions(data.voiceChannels || [], music.preferredVoiceChannel, 'Cualquier canal de voz')}</select>
            </div>
          </div>
          <div class="form-row">
            ${limits.map(([field, label, min, max, hint]) => `
              <div class="field">
                <label for="music-${field}">${escapeHtml(label)}</label>
                <input id="music-${field}" type="number" min="${min}" max="${max}" value="${Number(music[field] ?? min)}">
                ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ''}
              </div>`).join('')}
          </div>
          ${formActions('Guardar música')}
        </form>`
    })}`;
}

/* ---------------------------------------------------------------- */
/* Módulos y permisos                                                */
/* ---------------------------------------------------------------- */

function renderModulos() {
  const data = state.data;
  const config = data.config;

  const plan = data.plan || { id: 'free', locked: [], premiumFeatures: [] };
  const switches = Object.entries(config.features || {}).map(([key, value]) => {
    // Un módulo de pago en un servidor sin plan se enseña apagado y sin poder
    // tocarlo, con el motivo al lado. Esconderlo confundiría más.
    const bloqueado = plan.locked.includes(key);
    return `
    <label class="switch${bloqueado ? ' locked' : ''}">
      <input type="checkbox" name="${escapeHtml(key)}" ${value && !bloqueado ? 'checked' : ''} ${bloqueado ? 'disabled' : ''}>
      <span class="switch-copy">
        <strong>${escapeHtml(moduleLabel(key))}${bloqueado ? ' <span class="plan-badge premium">Premium</span>' : ''}</strong>
        <small>${escapeHtml(bloqueado ? 'Necesita plan premium: consume recursos a todas horas.' : moduleHint(key))}</small>
      </span>
    </label>`;
  }).join('');

  const PLAN_COPY = {
    main: { badge: 'Principal', title: 'Servidor principal', detail: 'Lo tiene todo, incluida la identidad propia del bot y el panel dentro de Discord.' },
    premium: { badge: 'Premium', title: 'Plan premium', detail: 'Además de lo gratis: avisos de TikTok, Twitch y YouTube, música y ofertas.' },
    free: { badge: 'Gratis', title: 'Plan gratis', detail: 'Mensajes, registros, bienvenidas, moderación y comunidad, sin límite ni caducidad.' }
  };
  const copy = PLAN_COPY[plan.id] || PLAN_COPY.free;

  const planCard = card({
    eyebrow: 'Plan',
    title: copy.title,
    description: copy.detail,
    body: `
      <div class="plan-state">
        <span class="plan-badge ${escapeHtml(plan.id)}">${escapeHtml(copy.badge)}</span>
        ${plan.locked.length
    ? `<p class="hint">Sin plan quedan fuera: ${escapeHtml(plan.locked.map(key => moduleLabel(key)).join(', '))}. Todo lo demás funciona igual.</p>`
    : '<p class="hint">No hay nada bloqueado en este servidor.</p>'}
      </div>
      ${state.session.user.globalOwner && plan.id !== 'main' ? `
        <div class="button-row">
          <button class="button${plan.id === 'premium' ? ' ghost' : ''}" type="button" data-set-plan="${plan.id === 'premium' ? 'free' : 'premium'}">
            ${plan.id === 'premium' ? 'Quitar el plan premium' : 'Conceder plan premium'}
          </button>
        </div>
        <p class="hint">Solo tú ves este botón: el plan decide cuánto trabaja el bot por este servidor.</p>` : ''}`
  });

  return `
    ${planCard}

    ${card({
      eyebrow: 'Módulos',
      title: 'Qué hace Vesper en este servidor',
      description: 'Apagar un módulo detiene su función al instante, sin perder la configuración.',
      body: `<form id="form-features" class="form"><div class="switch-list">${switches}</div>${formActions('Guardar módulos')}</form>`
    })}

    ${card({
      eyebrow: 'Permisos',
      title: 'Roles autorizados',
      description: 'Los permisos nativos de Discord (Administrador, Moderar miembros, Gestionar canales) siguen funcionando además de estos roles.',
      body: `
        <form id="form-permissions" class="form">
          <div class="form-row">
            <div class="field">
              <label for="roles-social">Gestión de redes</label>
              <select id="roles-social" multiple>${multiOptions(data.roles, config.permissions?.socialManagerRoles)}</select>
              <span class="hint">Pueden añadir y quitar cuentas vigiladas.</span>
            </div>
            <div class="field">
              <label for="roles-moderator">Moderación</label>
              <select id="roles-moderator" multiple>${multiOptions(data.roles, config.permissions?.moderatorRoles)}</select>
              <span class="hint">Pueden advertir, aislar y gestionar casos.</span>
            </div>
            <div class="field">
              <label for="roles-dj">DJ de música</label>
              <select id="roles-dj" multiple>${multiOptions(data.roles, config.permissions?.musicDjRoles)}</select>
              <span class="hint">Pueden saltar, parar y cambiar el volumen.</span>
            </div>
          </div>
          ${formActions('Guardar permisos')}
        </form>`
    })}

    ${card({
      eyebrow: 'Canales generales',
      title: 'Registros y rol de bots',
      description: 'Dónde deja Vesper el rastro de lo que pasa en el servidor.',
      body: `
        <form id="form-general" class="form">
          <div class="form-row">
            <div class="field">
              <label for="general-log">Registro general</label>
              <select id="general-log">${selectOptions(data.channels, config.general?.logChannel)}</select>
            </div>
            <div class="field">
              <label for="general-botlog">Registro de bots</label>
              <select id="general-botlog">${selectOptions(data.channels, config.general?.botLogChannel)}</select>
            </div>
            <div class="field">
              <label for="general-botrole">Rol automático para bots</label>
              <select id="general-botrole">${selectOptions(data.assignableRoles || [], config.general?.botRole, 'Sin rol')}</select>
            </div>
          </div>
          ${formActions('Guardar canales')}
        </form>`
    })}`;
}

/* ---------------------------------------------------------------- */
/* Configuración completa                                            */
/* ---------------------------------------------------------------- */

function nameOf(collection, id, empty = 'Sin configurar') {
  if (!id) return empty;
  const found = (collection || []).find(item => String(item.id) === String(id));
  if (!found) return `ID ${id} (ya no existe)`;
  return found.parent ? `${found.parent} / ${found.name}` : found.name;
}

function namesOf(collection, ids, empty = 'Ninguno') {
  const list = (ids || []).map(id => nameOf(collection, id, null)).filter(Boolean);
  return list.length ? list.join(', ') : empty;
}

function renderResumen() {
  const data = state.data;
  const config = data.config;
  const channels = data.channels || [];
  const roles = data.roles || [];
  const voice = data.voiceChannels || [];
  const categories = data.categories || [];
  const yesNo = value => (value ? 'Sí' : 'No');

  const embedSummary = kind => {
    const saved = config.embeds?.[kind] || {};
    const custom = ['title', 'message', 'footer', 'image', 'color'].filter(field => saved[field]);
    return custom.length ? `Personalizado (${custom.join(', ')})` : 'Diseño original del servidor';
  };

  const blocks = [
    ['Identidad', [
      ['Nombre visible', config.profile?.displayName || `El de la cuenta (${data.identity?.account?.username || 'Vesper'})`],
      ['Autor de los mensajes', data.identity?.webhook?.name || '—'],
      ['Apodo en el servidor', data.identity?.nickname || 'Sin apodo'],
      ['Tema', config.profile?.theme || 'neutral'],
      ['Color principal', config.profile?.primaryColor || '—'],
      ['Color secundario', config.profile?.secondaryColor || '—'],
      ['Rol automático de miembros', nameOf(roles, config.profile?.memberRole, 'Sin rol')]
    ]],
    ['Canales', [
      ['Bienvenida', nameOf(channels, config.general?.welcomeChannel)],
      ['Despedida', nameOf(channels, config.general?.goodbyeChannel)],
      ['Agradecimiento por boosts', nameOf(channels, config.general?.boostChannel, 'El de bienvenida')],
      ['Registro general', nameOf(channels, config.general?.logChannel)],
      ['Registro de bots', nameOf(channels, config.general?.botLogChannel)],
      ['Rol automático de bots', nameOf(roles, config.general?.botRole, 'Sin rol')]
    ]],
    ['Embeds', [
      ['Bienvenida', embedSummary('welcome')],
      ['Despedida', embedSummary('goodbye')],
      ['Formato', data.embedDefaults?.layout === 'components_v2' ? 'Components V2 (diseño propio)' : 'Embed clásico']
    ]],
    ['TikTok', [
      ['Directos', nameOf(channels, config.tiktok?.liveChannel)],
      ['Videos', nameOf(channels, config.tiktok?.videoChannel)],
      ['Cuentas', (config.tiktok?.users || []).join(', ') || 'Ninguna'],
      ['Rol de aviso', nameOf(roles, config.tiktok?.pingRole, 'Sin mención')]
    ]],
    ['Twitch', [
      ['Directos', nameOf(channels, config.twitch?.liveChannel)],
      ['Cuentas', (config.twitch?.users || []).join(', ') || 'Ninguna'],
      ['Rol de aviso', nameOf(roles, config.twitch?.pingRole, 'Sin mención')]
    ]],
    ['YouTube', [
      ['Directos', nameOf(channels, config.youtube?.liveChannel)],
      ['Videos', nameOf(channels, config.youtube?.videoChannel)],
      ['Shorts', nameOf(channels, config.youtube?.shortChannel)],
      ['Canales', (config.youtube?.users || []).join(', ') || 'Ninguno'],
      ['Rol de aviso', nameOf(roles, config.youtube?.pingRole, 'Sin mención')]
    ]],
    ['Ofertas de juegos', [
      ['Canal', nameOf(channels, config.deals?.channel)],
      ['Rol de aviso', nameOf(roles, config.deals?.pingRole, 'Sin mención')],
      ['Epic gratis', config.deals?.epicFree === false ? 'No' : 'Sí'],
      ['Sorteos', config.deals?.giveaways === false ? 'No' : 'Sí'],
      ['Rebajas de Steam', config.deals?.steamSpecials === true ? `Sí (desde ${config.deals?.minDiscount ?? 50}%)` : 'No'],
      ['Tiendas de sorteos', (config.deals?.giveawayPlatforms || []).join(', ') || 'Todas']
    ]],
    ['Permisos', [
      ['Gestión de redes', namesOf(roles, config.permissions?.socialManagerRoles)],
      ['Moderación', namesOf(roles, config.permissions?.moderatorRoles)],
      ['DJ de música', namesOf(roles, config.permissions?.musicDjRoles)]
    ]],
    ['Moderación', [
      ['Filtrar enlaces', yesNo(config.moderation?.filterLinks)],
      ['Bloquear invitaciones', yesNo(config.moderation?.blockInvites)],
      ['Máximo de menciones', config.moderation?.maxMentions ?? 5],
      ['Repeticiones permitidas', config.moderation?.repeatLimit ?? 4],
      ['Acción', config.moderation?.action || 'warn'],
      ['Dominios permitidos', (config.moderation?.allowedDomains || []).join(', ') || 'Ninguno'],
      ['Canales excluidos', namesOf(channels, config.moderation?.exemptChannels)],
      ['Roles excluidos', namesOf(roles, config.moderation?.exemptRoles)]
    ]],
    ['Música', [
      ['Canal de solicitudes', nameOf(channels, config.music?.requestChannel, 'Cualquiera')],
      ['Canal de voz preferido', nameOf(voice, config.music?.preferredVoiceChannel, 'Cualquiera')],
      ['Volumen', config.music?.defaultVolume ?? 50],
      ['Cola máxima', config.music?.maxQueue ?? 100],
      ['Por usuario', config.music?.maxPerUser ?? 3],
      ['Minutos por pista', config.music?.maxTrackMinutes ?? 15],
      ['Inactividad (s)', config.music?.idleSeconds ?? 180]
    ]],
    ['Comunidad', [
      ['Panel de tickets', nameOf(channels, config.community?.tickets?.panelChannel)],
      ['Categoría', nameOf(categories, config.community?.tickets?.category, 'Sin categoría')],
      ['Transcripciones', nameOf(channels, config.community?.tickets?.transcriptChannel)],
      ['Roles de soporte', namesOf(roles, config.community?.tickets?.staffRoles)],
      ['Tickets por usuario', config.community?.tickets?.maxOpenPerUser ?? 1],
      ['Sugerencias', nameOf(channels, config.community?.suggestions?.channel)],
      ['Panel de autorroles', nameOf(channels, config.community?.selfRoles?.panelChannel)],
      ['Autorroles', namesOf(roles, (config.community?.selfRoles?.roles || []).map(item => item.roleId))],
      ['Destacados', nameOf(channels, config.community?.starboard?.channel)],
      ['Reacciones', config.community?.starboard?.threshold ?? 3],
      ['Emoji', config.community?.starboard?.emoji || '⭐']
    ]]
  ];

  return card({
    eyebrow: 'Resumen',
    title: `Todo lo guardado de ${data.guild.name}`,
    description: 'Vista de solo lectura con los identificadores ya traducidos a nombres.',
    actions: '<button class="button quiet sm" type="button" id="copy-config">Copiar como JSON</button>',
    body: `
      <div class="chips">
        <span class="tag accent">${escapeHtml(TIER_LABELS[data.guild.tier] || data.guild.tier)}</span>
        <span class="tag">${formatNumber(data.guild.memberCount)} miembros</span>
        ${Object.entries(config.features || {}).map(([key, value]) => `<span class="tag ${value ? 'ok' : ''}">${escapeHtml(moduleLabel(key))}</span>`).join('')}
      </div>
      <div class="def-grid">
        ${blocks.map(([title, rows]) => `
          <div class="def-block">
            <h3>${escapeHtml(title)}</h3>
            <dl>${rows.map(([label, value]) => `<div class="def-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('')}</dl>
          </div>`).join('')}
      </div>`
  });
}

/* ---------------------------------------------------------------- */
/* Auditoría                                                         */
/* ---------------------------------------------------------------- */

function renderAuditoria() {
  return card({
    eyebrow: 'Trazabilidad',
    title: 'Cambios hechos desde el panel',
    description: 'Los últimos 100 movimientos. Se conservan según WEB_AUDIT_DAYS.',
    body: '<div id="audit-body"><div class="skeleton block"></div></div>'
  });
}

async function loadAudit() {
  const body = $('#audit-body');
  if (!body) return;
  try {
    const result = await api(`/guilds/${state.guildId}/audit`);
    const rows = (result.audit || []).map(item => `
      <tr>
        <td>${escapeHtml(formatDate(item.createdAt))}</td>
        <td class="mono">${escapeHtml(item.actorDiscordId || item.actorGoogleEmail || 'Desconocido')}</td>
        <td>${escapeHtml(item.action)}</td>
        <td class="wrap">${escapeHtml(item.target || '—')}</td>
        <td class="wrap">${escapeHtml((item.metadata?.fields || []).join(', ') || '—')}</td>
      </tr>`).join('');

    body.innerHTML = rows
      ? `<div class="table-scroll"><table><thead><tr><th>Fecha</th><th>Responsable</th><th>Acción</th><th>Objetivo</th><th>Campos</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyBlock('Sin movimientos', 'Todavía nadie ha cambiado nada desde el panel.');
  } catch (error) {
    body.innerHTML = `<div class="callout danger"><strong>No se pudo cargar la auditoría.</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
}

/* ---------------------------------------------------------------- */
/* Guardado                                                          */
/* ---------------------------------------------------------------- */

/**
 * Guarda y refresca. `options.rerender: false` deja la pantalla como está —
 * lo usan los interruptores sueltos, porque volver a pintar la lista entera
 * al marcar una casilla te manda el scroll al principio y pierdes de vista
 * justo la fila que acabas de tocar.
 */
async function saveConfig(body, successMessage, submitter = null, options = {}) {
  const { rerender = true } = options;
  const button = submitter?.tagName === 'BUTTON' ? submitter : null;
  const previousLabel = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Guardando…'; }

  try {
    const result = await api(`/guilds/${state.guildId}/config`, { method: 'PATCH', body: JSON.stringify(body) });
    state.data.config = result.config;
    state.data.setup = result.setup;
    state.dirty.clear();
    updateSaveBar();
    if (result.warning) toast(result.warning, 'bad');
    else if (successMessage) toast(successMessage, 'ok');

    if (rerender) {
      // Se recarga el servidor para que la identidad efectiva, los avisos y el
      // resumen reflejen lo recién guardado sin tener que refrescar a mano.
      await selectGuild(state.guildId, { keepSection: true, silent: true });
    } else {
      await refreshGuildData();
    }
    return result;
  } catch (error) {
    toast(error.message, 'bad');
    return null;
  } finally {
    if (button) { button.disabled = false; button.textContent = previousLabel; }
  }
}

// Trae los datos del servidor sin volver a pintar la pantalla.
async function refreshGuildData() {
  try {
    const data = await api(`/guilds/${state.guildId}`);
    state.data = data;
    applyTheme();
  } catch {
    // Si falla, lo que hay en pantalla sigue siendo lo último confirmado.
  }
}

function markDirty(form) {
  if (!form || !form.id) return;
  state.dirty.add(form.id);
  const flag = form.querySelector('.dirty-flag');
  if (flag) flag.hidden = false;
  updateSaveBar();
}

function watchDirty(root) {
  root.querySelectorAll('form').forEach(form => {
    form.addEventListener('input', () => markDirty(form));
    form.addEventListener('change', () => markDirty(form));
  });
}

/* ---------------------------------------------------------------- */
/* Enlaces de comportamiento por sección                             */
/* ---------------------------------------------------------------- */

function bindCommon(root) {
  watchDirty(root);
  wireImageFallbacks(root);

  root.querySelectorAll('[data-goto]').forEach(button => {
    button.addEventListener('click', () => showSection(button.dataset.goto));
  });

  root.querySelectorAll('[data-meter]').forEach(meter => {
    meter.style.setProperty('width', `${Math.max(0, Math.min(100, Number(meter.dataset.meter) || 0))}%`);
  });
}

function bindIdentidad(root) {
  refreshIdentityPreview();
  ['#profile-name', '#profile-avatar', '#branding-name', '#branding-avatar', '#profile-primary']
    .forEach(selector => root.querySelector(selector)?.addEventListener('input', refreshIdentityPreview));

  root.querySelector('#form-profile')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ profile: {
      theme: $('#profile-theme').value,
      displayName: $('#profile-name').value.trim() || null,
      avatar: $('#profile-avatar').value.trim() || null,
      primaryColor: $('#profile-primary').value,
      secondaryColor: $('#profile-secondary').value,
      memberRole: $('#profile-member-role').value || null
    } }, 'Identidad actualizada.', event.submitter);
  });

  root.querySelector('#form-branding')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ branding: {
      name: $('#branding-name').value.trim() || null,
      avatar: $('#branding-avatar').value.trim() || null
    } }, 'Branding actualizado.', event.submitter);
  });
}

function bindBienvenidas(root) {
  wireFormatting(root);
  wireLayoutChoice(root);

  root.querySelector('#form-welcome-channels')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ general: {
      welcomeChannel: $('#channel-welcome').value || null,
      goodbyeChannel: $('#channel-goodbye').value || null,
      boostChannel: $('#channel-boost').value || null
    } }, 'Canales actualizados.', event.submitter);
  });

  root.querySelectorAll('[data-variable]').forEach(button => {
    button.addEventListener('click', async () => {
      const token = button.dataset.variable;
      try {
        await navigator.clipboard.writeText(token);
        toast(`${token} copiado.`, 'ok');
      } catch {
        toast(`Copia manualmente: ${token}`, 'bad');
      }
    });
  });

  for (const kind of Object.keys(EMBED_KINDS)) {
    const form = root.querySelector(`#form-embed-${kind}`);
    if (!form) continue;

    const update = () => refreshEmbedPreview(kind);
    form.addEventListener('input', event => {
      if (event.target.id === `embed-${kind}-usecolor`) {
        const picker = $(`#embed-${kind}-color`);
        if (picker) picker.disabled = !event.target.checked;
      }
      update();
    });
    form.addEventListener('change', update);

    form.addEventListener('submit', event => {
      event.preventDefault();
      saveConfig({ embeds: { [kind]: embedValues(kind) } }, `Embed de ${EMBED_KINDS[kind].toLowerCase()} guardado.`, event.submitter);
    });

    root.querySelector(`[data-embed-reset="${kind}"]`)?.addEventListener('click', async event => {
      const label = EMBED_KINDS[kind].toLowerCase();
      if (!await confirmDialog({
        title: `Restablecer ${label}`,
        message: `El embed de ${label} volverá al diseño original del servidor y se perderá lo que hayas escrito.`,
        confirmLabel: 'Restablecer',
        danger: true
      })) return;
      saveConfig(
        { embeds: { [kind]: { title: null, message: null, footer: null, image: null, color: null, layout: null, thumbnail: true } } },
        `Embed de ${EMBED_KINDS[kind].toLowerCase()} restablecido.`,
        event.currentTarget
      );
    });

    update();
  }
}

function bindAvisos(root) {
  root.querySelectorAll('[data-add-account]').forEach(form => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const platform = form.dataset.addAccount;
      const input = form.querySelector('input[name="account"]');
      const button = form.querySelector('button[type="submit"]');
      const account = input.value.trim();
      if (!account) return;

      button.disabled = true;
      const label = button.textContent;
      button.textContent = 'Verificando…';
      try {
        await api(`/guilds/${state.guildId}/social/${platform}`, { method: 'POST', body: JSON.stringify({ account }) });
        input.value = '';
        toast('Cuenta verificada y añadida.', 'ok');
        await selectGuild(state.guildId, { keepSection: true, silent: true });
      } catch (error) {
        toast(error.message, 'bad');
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    });
  });

  root.querySelectorAll('[data-remove-account]').forEach(button => {
    button.addEventListener('click', async () => {
      const account = button.dataset.removeAccount;
      if (!await confirmDialog({
        title: 'Dejar de vigilar la cuenta',
        message: `Vesper dejará de avisar cuando ${account} publique o empiece directo.`,
        confirmLabel: 'Dejar de vigilar',
        danger: true
      })) return;
      button.disabled = true;
      try {
        await api(`/guilds/${state.guildId}/social/${button.dataset.platform}/${encodeURIComponent(account)}`, { method: 'DELETE' });
        toast('Cuenta retirada.', 'ok');
        await selectGuild(state.guildId, { keepSection: true, silent: true });
      } catch (error) {
        toast(error.message, 'bad');
        button.disabled = false;
      }
    });
  });

  root.querySelectorAll('[data-platform-channels]').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const platform = form.dataset.platformChannels;
      const body = { [platform]: {} };
      form.querySelectorAll('select[data-field]').forEach(select => {
        body[platform][select.dataset.field] = select.value || null;
      });
      saveConfig(body, `Canales de ${platform} actualizados.`, event.submitter);
    });
  });
}

function bindModeracion(root) {
  root.querySelector('#form-automod')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ moderation: {
      filterLinks: $('#automod-links').checked,
      blockInvites: $('#automod-invites').checked,
      maxMentions: Number($('#automod-mentions').value),
      repeatLimit: Number($('#automod-repeat').value),
      action: $('#automod-action').value,
      allowedDomains: $('#automod-domains').value.split(/\n|,/).map(value => value.trim()).filter(Boolean),
      exemptChannels: selectedValues($('#automod-exempt-channels')),
      exemptRoles: selectedValues($('#automod-exempt-roles'))
    } }, 'Filtros actualizados.', event.submitter);
  });

  const actionSelect = root.querySelector('#case-action');
  actionSelect?.addEventListener('change', () => {
    $('#case-minutes-field').hidden = actionSelect.value !== 'timeout';
  });

  let searchTimer = null;
  root.querySelector('#case-search')?.addEventListener('input', event => {
    clearTimeout(searchTimer);
    const query = event.target.value.trim();
    const status = $('#case-search-status');
    const select = $('#case-user');
    if (query.length < 2) {
      select.innerHTML = '<option value="">Busca y selecciona</option>';
      status.textContent = 'Escribe al menos dos caracteres.';
      return;
    }
    status.textContent = 'Buscando en Discord…';
    searchTimer = setTimeout(async () => {
      try {
        const result = await api(`/guilds/${state.guildId}/members?q=${encodeURIComponent(query)}`);
        select.innerHTML = `<option value="">Selecciona un miembro</option>${(result.members || [])
          .map(member => `<option value="${escapeHtml(member.id)}">${escapeHtml(member.displayName)} · @${escapeHtml(member.username)}</option>`).join('')}`;
        status.textContent = result.members?.length
          ? `${result.members.length} ${result.members.length === 1 ? 'resultado' : 'resultados'}.`
          : 'No se encontró a nadie con ese nombre.';
      } catch (error) {
        status.textContent = error.message;
      }
    }, 350);
  });

  root.querySelector('#form-case')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api(`/guilds/${state.guildId}/cases`, {
        method: 'POST',
        body: JSON.stringify({ ...values, minutes: Number(values.minutes || 0) })
      });
      form.reset();
      $('#case-minutes-field').hidden = true;
      toast('Sanción registrada.', 'ok');
      await reloadCases();
    } catch (error) {
      toast(error.message, 'bad');
    } finally {
      button.disabled = false;
    }
  });

  root.querySelector('#reload-cases')?.addEventListener('click', reloadCases);
  bindCaseRowActions();
}

function bindCaseRowActions() {
  $$('[data-case-note]').forEach(button => button.addEventListener('click', async () => {
    const note = await promptDialog({
      title: `Nota del caso #${button.dataset.caseNote}`,
      message: 'Solo la ve el equipo de moderación.',
      label: 'Nota interna'
    });
    if (!note) return;
    await updateCase(button.dataset.caseNote, { note });
  }));

  $$('[data-case-status]').forEach(button => button.addEventListener('click', async () => {
    const labels = { active: 'Reabrir', resolved: 'Resolver', revoked: 'Revocar' };
    const action = labels[button.dataset.status];
    const note = await promptDialog({
      title: `${action} el caso #${button.dataset.caseStatus}`,
      message: 'Puedes dejar constancia del motivo. La nota es opcional.',
      label: 'Nota (opcional)',
      confirmLabel: action,
      danger: button.dataset.status === 'revoked'
    });
    if (note === null) return;
    await updateCase(button.dataset.caseStatus, { status: button.dataset.status, note });
  }));
}

async function updateCase(caseId, body) {
  try {
    await api(`/guilds/${state.guildId}/cases/${caseId}`, { method: 'PATCH', body: JSON.stringify(body) });
    toast(`Caso #${caseId} actualizado.`, 'ok');
    await reloadCases();
  } catch (error) {
    toast(error.message, 'bad');
  }
}

async function reloadCases() {
  try {
    const result = await api(`/guilds/${state.guildId}/cases`);
    state.data.cases = result.cases || [];
    const body = $('#case-rows');
    if (body) {
      body.innerHTML = caseRowsMarkup();
      bindCaseRowActions();
    }
  } catch (error) {
    toast(error.message, 'bad');
  }
}

function communityBody() {
  return { community: {
    tickets: {
      panelChannel: $('#ticket-panel').value || null,
      category: $('#ticket-category').value || null,
      transcriptChannel: $('#ticket-transcripts').value || null,
      staffRoles: selectedValues($('#ticket-staff')),
      maxOpenPerUser: Number($('#ticket-limit').value)
    },
    suggestions: { channel: $('#suggestions-channel').value || null },
    selfRoles: { panelChannel: $('#selfroles-channel').value || null, roles: selectedValues($('#selfroles-roles')) },
    starboard: {
      channel: $('#starboard-channel').value || null,
      threshold: Number($('#starboard-threshold').value),
      emoji: $('#starboard-emoji').value,
      ignoredChannels: selectedValues($('#starboard-ignored'))
    }
  } };
}

function bindComunidad(root) {
  ['#form-tickets', '#form-suggestions', '#form-selfroles', '#form-starboard'].forEach(selector => {
    root.querySelector(selector)?.addEventListener('submit', event => {
      event.preventDefault();
      saveConfig(communityBody(), 'Configuración de comunidad guardada.', event.submitter);
    });
  });

  const publish = async (kind, button) => {
    button.disabled = true;
    try {
      const saved = await saveConfig(communityBody(), 'Configuración guardada.', null);
      if (!saved) return;
      await api(`/guilds/${state.guildId}/community/publish`, { method: 'POST', body: JSON.stringify({ kind }) });
      toast(kind === 'tickets' ? 'Panel de tickets publicado.' : 'Panel de autorroles publicado.', 'ok');
      await selectGuild(state.guildId, { keepSection: true, silent: true });
    } catch (error) {
      toast(error.message, 'bad');
    } finally {
      button.disabled = false;
    }
  };

  root.querySelector('#publish-tickets')?.addEventListener('click', event => publish('tickets', event.currentTarget));
  root.querySelector('#publish-selfroles')?.addEventListener('click', event => publish('selfroles', event.currentTarget));

  root.querySelectorAll('[data-suggestion]').forEach(button => {
    button.addEventListener('click', async () => {
      const labels = { open: 'Devolver a pendiente', approved: 'Aprobar', rejected: 'Rechazar' };
      const action = labels[button.dataset.status];
      const note = await promptDialog({
        title: `${action} la sugerencia`,
        message: 'La nota se le muestra a quien la propuso.',
        label: 'Nota (opcional)',
        confirmLabel: action,
        danger: button.dataset.status === 'rejected'
      });
      if (note === null) return;
      button.disabled = true;
      try {
        await api(`/guilds/${state.guildId}/suggestions/${button.dataset.suggestion}`, {
          method: 'PATCH', body: JSON.stringify({ status: button.dataset.status, note })
        });
        toast('Sugerencia actualizada.', 'ok');
        await selectGuild(state.guildId, { keepSection: true, silent: true });
      } catch (error) {
        toast(error.message, 'bad');
        button.disabled = false;
      }
    });
  });
}

function bindMusica(root) {
  root.querySelector('#form-music')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ music: {
      requestChannel: $('#music-request').value || null,
      preferredVoiceChannel: $('#music-voice').value || null,
      defaultVolume: Number($('#music-defaultVolume').value),
      maxQueue: Number($('#music-maxQueue').value),
      maxPerUser: Number($('#music-maxPerUser').value),
      maxTrackMinutes: Number($('#music-maxTrackMinutes').value),
      idleSeconds: Number($('#music-idleSeconds').value)
    } }, 'Ajustes de música guardados.', event.submitter);
  });
}

function bindModulos(root) {
  root.querySelector('#form-features')?.addEventListener('submit', event => {
    event.preventDefault();
    // Los módulos bloqueados salen deshabilitados; no se mandan para no
    // sobrescribir con `false` algo que el servidor sí tenía guardado.
    const features = Object.fromEntries(
      [...event.currentTarget.querySelectorAll('input[type="checkbox"]:not(:disabled)')].map(input => [input.name, input.checked])
    );
    saveConfig({ features }, 'Módulos actualizados.', event.submitter);
  });

  root.querySelector('[data-set-plan]')?.addEventListener('click', async event => {
    const nuevo = event.currentTarget.dataset.setPlan;
    const conceder = nuevo === 'premium';
    if (!await confirmDialog({
      title: conceder ? 'Conceder el plan premium' : 'Quitar el plan premium',
      message: conceder
        ? 'Este servidor podrá vigilar TikTok, Twitch y YouTube, poner música y avisar de ofertas. Todo eso consulta a todas horas y consume recursos de la máquina.'
        : 'Se detendrán los monitores, la música y las ofertas de este servidor. La configuración se conserva por si vuelves a concederlo.',
      confirmLabel: conceder ? 'Conceder' : 'Quitar',
      danger: !conceder
    })) return;

    const button = event.currentTarget;
    button.disabled = true;
    try {
      await api(`/guilds/${state.guildId}/plan`, { method: 'POST', body: JSON.stringify({ plan: nuevo }) });
      toast(conceder ? 'Plan premium concedido.' : 'Plan premium retirado.', 'ok');
      await selectGuild(state.guildId, { keepSection: true, silent: true });
    } catch (error) {
      toast(error.message, 'bad');
      button.disabled = false;
    }
  });

  root.querySelector('#form-permissions')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ permissions: {
      socialManagerRoles: selectedValues($('#roles-social')),
      moderatorRoles: selectedValues($('#roles-moderator')),
      musicDjRoles: selectedValues($('#roles-dj'))
    } }, 'Permisos actualizados.', event.submitter);
  });

  root.querySelector('#form-general')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ general: {
      logChannel: $('#general-log').value || null,
      botLogChannel: $('#general-botlog').value || null,
      botRole: $('#general-botrole').value || null
    } }, 'Canales actualizados.', event.submitter);
  });
}

function bindResumen(root) {
  root.querySelector('#copy-config')?.addEventListener('click', async () => {
    const json = JSON.stringify(state.data.config, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      toast('Configuración copiada al portapapeles.', 'ok');
    } catch {
      const view = window.open('', '_blank');
      if (!view) return toast('El navegador bloqueó la copia y la ventana emergente.', 'bad');
      view.document.title = 'Configuración de Vesper';
      const pre = view.document.createElement('pre');
      pre.textContent = json;
      view.document.body.appendChild(pre);
    }
  });
}

/* ---------------------------------------------------------------- */
/* Registros: qué se anota, dónde y a quién se avisa                 */
/* ---------------------------------------------------------------- */

// Cada aviso que Vesper puede publicar, con tres decisiones por separado:
// si se publica, en qué canal y a quién se menciona. Antes esto solo se podía
// encender o apagar por módulos enteros, y todo caía en el mismo canal.

function alertGroups() {
  return state.data.alerts || [];
}

function alertSaved(kind) {
  return state.data.config.alerts?.[kind] || {};
}

function alertRowMarkup(item) {
  const saved = alertSaved(item.kind);
  const channelLabel = item.effectiveChannelId
    ? nameOf(state.data.channels, item.effectiveChannelId, 'canal desconocido')
    : null;

  // Estado real, en una palabra, para poder escanear la lista de un vistazo.
  const estado = item.blockedByModule
    ? { tag: 'Bloqueado', kind: 'warn', why: `El módulo «${item.module}» está apagado, así que este aviso no sale aunque lo enciendas aquí.` }
    : !item.enabled
      ? { tag: 'Apagado', kind: '', why: 'No se publica en ningún sitio.' }
      : !item.effectiveChannelId
        ? { tag: 'Sin canal', kind: 'warn', why: 'Está encendido pero no hay ningún canal elegido, así que no se ve en ninguna parte.' }
        : { tag: 'Activo', kind: 'ok', why: `Se publica en #${channelLabel}.` };

  return `
    <div class="alert-row${item.enabled ? ' on' : ''}" data-alert="${escapeHtml(item.kind)}">
      <label class="switch" title="${item.enabled ? 'Apagar este aviso' : 'Encender este aviso'}">
        <input type="checkbox" data-alert-toggle="${escapeHtml(item.kind)}" ${item.enabled ? 'checked' : ''}>
        <span class="switch-track" aria-hidden="true"></span>
        <span class="sr-only">${escapeHtml(item.label)}</span>
      </label>

      <div class="alert-main">
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(estado.why)}</small>
      </div>

      <div class="alert-target">
        <label class="sr-only" for="alert-${item.kind}-channel">Canal de ${escapeHtml(item.label)}</label>
        <select id="alert-${item.kind}-channel" data-alert-channel="${escapeHtml(item.kind)}">
          ${selectOptions(state.data.channels, saved.channel, channelLabel ? 'El de siempre' : 'Sin canal elegido')}
        </select>
        <label class="sr-only" for="alert-${item.kind}-ping">Mención de ${escapeHtml(item.label)}</label>
        <select id="alert-${item.kind}-ping" data-alert-ping="${escapeHtml(item.kind)}">
          ${selectOptions(state.data.roles, saved.ping, 'Sin mención')}
        </select>
      </div>

      <span class="tag ${estado.kind}">${estado.tag}</span>
    </div>`;
}

function renderRegistros() {
  const groups = alertGroups();
  if (!groups.length) {
    return card({
      eyebrow: 'Registros',
      title: 'No hay avisos que configurar',
      description: 'Actualiza la página para volver a cargarlos.',
      body: ''
    });
  }

  const general = state.data.config.general || {};
  const todos = groups.flatMap(group => group.items);
  const activos = todos.filter(item => item.enabled).length;
  const sinCanal = todos.filter(item => item.enabled && !item.effectiveChannelId).length;
  const bloqueados = todos.filter(item => item.blockedByModule).length;

  const avisos = [];
  if (!general.logChannel) {
    avisos.push('No hay canal general de registros. Elígelo abajo: es donde caen todos los avisos que no tengan uno propio.');
  }
  if (sinCanal) avisos.push(`${sinCanal} ${sinCanal === 1 ? 'aviso está encendido' : 'avisos están encendidos'} pero sin canal, así que no se publican en ningún sitio.`);
  if (bloqueados) avisos.push(`${bloqueados} ${bloqueados === 1 ? 'aviso tiene' : 'avisos tienen'} su módulo apagado y no salen aunque estén encendidos aquí.`);

  const bloques = groups.map(group => card({
    eyebrow: group.group,
    title: `${group.items.filter(item => item.enabled).length} de ${group.items.length} activos`,
    description: 'Cada fila se enciende o se apaga por su cuenta. El canal vacío significa «el de siempre».',
    body: `<div class="alert-list">${group.items.map(alertRowMarkup).join('')}</div>`
  })).join('');

  return `
    ${avisos.length ? `<div class="callout warn"><strong>Revisa esto.</strong><span>${escapeHtml(avisos.join(' '))}</span></div>` : ''}

    <div class="stat-row">
      <div class="stat"><span class="stat-value">${activos}</span><span class="stat-label">avisos activos</span></div>
      <div class="stat"><span class="stat-value">${todos.length - activos}</span><span class="stat-label">apagados</span></div>
      <div class="stat"><span class="stat-value">${new Set(todos.filter(i => i.enabled).map(i => i.effectiveChannelId).filter(Boolean)).size}</span><span class="stat-label">canales en uso</span></div>
    </div>

    ${card({
      eyebrow: 'Dónde caen por defecto',
      title: 'Canales generales',
      description: 'Un aviso sin canal propio se publica aquí. Es lo más cómodo: eliges estos dos y te olvidas.',
      body: `
        <form id="form-log-channels" class="form">
          <div class="form-row">
            <div class="field">
              <label for="channel-log">Canal de registros</label>
              <select id="channel-log">${selectOptions(state.data.channels, general.logChannel)}</select>
              <span class="hint">Entradas, salidas, moderación, cambios del servidor…</span>
            </div>
            <div class="field">
              <label for="channel-botlog">Canal de registros de bots</label>
              <select id="channel-botlog">${selectOptions(state.data.channels, general.botLogChannel, 'Usar el de registros')}</select>
              <span class="hint">Cuando se añade o se retira un bot.</span>
            </div>
          </div>
          ${formActions('Guardar canales')}
        </form>`
    })}

    ${card({
      eyebrow: 'De golpe',
      title: 'Encender o apagar todo',
      description: 'Útil para empezar de cero: apágalo todo y enciende solo lo que te interese.',
      body: `
        <div class="button-row">
          <button class="button ghost" type="button" data-alerts-all="on">Encender todos</button>
          <button class="button ghost" type="button" data-alerts-all="off">Apagar todos</button>
          <button class="button ghost" type="button" data-alerts-all="reset">Volver a lo de fábrica</button>
        </div>`
    })}

    ${bloques}`;
}

// Repinta una sola fila con el estado recién confirmado por el servidor.
function refreshAlertRow(kind) {
  const item = alertGroups().flatMap(group => group.items).find(entry => entry.kind === kind);
  const row = document.querySelector(`[data-alert="${kind}"]`);
  if (!item || !row) return;
  const replacement = document.createElement('div');
  replacement.innerHTML = alertRowMarkup(item);
  const fresh = replacement.firstElementChild;
  row.replaceWith(fresh);
  bindAlertRow(fresh);
  updateAlertCounters();
}

function updateAlertCounters() {
  const todos = alertGroups().flatMap(group => group.items);
  const values = [
    todos.filter(item => item.enabled).length,
    todos.filter(item => !item.enabled).length,
    new Set(todos.filter(item => item.enabled).map(item => item.effectiveChannelId).filter(Boolean)).size
  ];
  document.querySelectorAll('.stat-row .stat-value').forEach((node, index) => {
    if (values[index] !== undefined) node.textContent = values[index];
  });
}

function bindAlertRow(row) {
  row.querySelector('[data-alert-toggle]')?.addEventListener('change', event => {
    const kind = event.target.dataset.alertToggle;
    saveConfig({ alerts: { [kind]: { enabled: event.target.checked } } }, null, null, { rerender: false })
      .then(() => refreshAlertRow(kind));
  });
  row.querySelector('[data-alert-channel]')?.addEventListener('change', event => {
    const kind = event.target.dataset.alertChannel;
    saveConfig({ alerts: { [kind]: { channel: event.target.value || null } } }, null, null, { rerender: false })
      .then(() => refreshAlertRow(kind));
  });
  row.querySelector('[data-alert-ping]')?.addEventListener('change', event => {
    const kind = event.target.dataset.alertPing;
    saveConfig({ alerts: { [kind]: { ping: event.target.value || null } } }, null, null, { rerender: false })
      .then(() => refreshAlertRow(kind));
  });
}

function bindRegistros(root) {
  root.querySelector('#form-log-channels')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ general: {
      logChannel: $('#channel-log').value || null,
      botLogChannel: $('#channel-botlog').value || null
    } }, 'Canales de registro actualizados.', event.submitter);
  });

  // Cada fila guarda sola, sin botón: es una sola casilla y obligar a pulsar
  // «Guardar» después sobra.
  root.querySelectorAll('.alert-row').forEach(bindAlertRow);

  root.querySelectorAll('[data-alerts-all]').forEach(button => {
    button.addEventListener('click', async event => {
      const mode = button.dataset.alertsAll;
      const labels = { on: 'Encender todos los avisos', off: 'Apagar todos los avisos', reset: 'Volver a lo de fábrica' };
      const detail = {
        on: 'Se encenderán los avisos de todos los módulos que estén activos.',
        off: 'Vesper dejará de anotar nada en los canales de registro.',
        reset: 'Cada aviso volverá a depender de su módulo, y se olvidarán los canales y menciones que hayas puesto uno a uno.'
      };
      if (!await confirmDialog({ title: labels[mode], message: detail[mode], confirmLabel: labels[mode], danger: mode !== 'on' })) return;

      const alerts = {};
      for (const item of alertGroups().flatMap(group => group.items)) {
        alerts[item.kind] = mode === 'reset'
          ? { enabled: null, channel: null, ping: null }
          : { enabled: mode === 'on' };
      }
      saveConfig({ alerts }, `${labels[mode]}: hecho.`, event.currentTarget);
    });
  });
}

const RENDERERS = {
  inicio: { render: renderInicio, bind: () => {} },
  apariencia: { render: renderIdentidad, bind: bindIdentidad },
  registros: { render: renderRegistros, bind: bindRegistros },
  bienvenidas: { render: renderBienvenidas, bind: bindBienvenidas },
  avisos: { render: renderAvisos, bind: bindAvisos },
  mensajes: { render: renderMensajes, bind: bindMensajes },
  ofertas: { render: renderOfertas, bind: bindOfertas },
  moderacion: { render: renderModeracion, bind: bindModeracion },
  comunidad: { render: renderComunidad, bind: bindComunidad },
  musica: { render: renderMusica, bind: bindMusica },
  modulos: { render: renderModulos, bind: bindModulos },
  resumen: { render: renderResumen, bind: bindResumen },
  auditoria: { render: renderAuditoria, bind: () => loadAudit() }
};

/* ---------------------------------------------------------------- */
/* Barra de guardado y buscador                                      */
/* ---------------------------------------------------------------- */

// Antes cada tarjeta avisaba de sus cambios sin guardar con una etiqueta
// diminuta que era fácil no ver, y se perdía trabajo al cambiar de pantalla.
// Ahora aparece una barra abajo que no se puede pasar por alto y que guarda
// todo lo pendiente de una vez.
function dirtyForms() {
  return [...state.dirty]
    .map(id => document.getElementById(id))
    .filter(form => form && document.body.contains(form));
}

function updateSaveBar() {
  const bar = $('#save-bar');
  if (!bar) return;
  const forms = dirtyForms();
  bar.hidden = forms.length === 0;
  const label = $('#save-bar-text');
  if (label) {
    label.textContent = forms.length === 1
      ? 'Tienes un cambio sin guardar.'
      : `Tienes ${forms.length} cambios sin guardar.`;
  }
}

function bindSaveBar() {
  $('#save-bar-save')?.addEventListener('click', () => {
    for (const form of dirtyForms()) {
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.click();
      else form.requestSubmit?.();
    }
  });

  $('#save-bar-discard')?.addEventListener('click', async () => {
    if (!await confirmDialog({
      title: 'Descartar los cambios',
      message: 'Se perderá lo que hayas escrito y no guardado en esta pantalla.',
      confirmLabel: 'Descartar',
      danger: true
    })) return;
    state.dirty.clear();
    updateSaveBar();
    renderView();
  });
}

/* ---------------------------------------------------------------- */

// El buscador es la respuesta a un panel con cientos de ajustes: en vez de
// recordar en qué pantalla estaba cada cosa, se escribe y se va.
function searchEntries() {
  const entries = [];

  for (const section of SECTIONS.filter(sectionAllowed)) {
    entries.push({
      kind: 'Pantalla',
      label: section.title,
      detail: section.hint,
      terms: [section.label, section.title, section.hint, ...(section.keywords || [])].join(' '),
      section: section.id
    });
  }

  for (const group of state.data?.messageCatalog || []) {
    for (const item of group.items) {
      entries.push({
        kind: 'Mensaje',
        label: item.label,
        detail: item.description,
        terms: `${item.label} ${item.description} ${group.group} mensaje embed texto`,
        section: 'mensajes',
        focus: `[data-message="${item.id}"]`
      });
    }
  }

  for (const group of state.data?.alerts || []) {
    for (const item of group.items) {
      entries.push({
        kind: 'Registro',
        label: item.label,
        detail: `${item.enabled ? 'Activo' : 'Apagado'} · ${group.group}`,
        terms: `${item.label} ${group.group} registro log aviso canal mención`,
        section: 'registros',
        focus: `[data-alert="${item.kind}"]`
      });
    }
  }

  return entries;
}

// Coincidencia sencilla y tolerante: sin tildes, por palabras sueltas y en
// cualquier orden, que es como escribe la gente cuando busca.
function normalize(value) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function searchMatches(query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return searchEntries().filter(entry => entry.kind === 'Pantalla');
  return searchEntries()
    .map(entry => {
      const haystack = normalize(entry.terms);
      if (!words.every(word => haystack.includes(word))) return null;
      // Lo que empieza por lo escrito va primero: es casi siempre lo buscado.
      const score = normalize(entry.label).startsWith(words[0]) ? 0 : 1;
      return { entry, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, 12)
    .map(match => match.entry);
}

function renderSearchResults(query) {
  const list = $('#search-results');
  if (!list) return;
  const results = searchMatches(query);
  state.searchResults = results;
  state.searchIndex = 0;

  if (!results.length) {
    list.innerHTML = '<li class="search-empty">No encontré nada con eso. Prueba con «bienvenida», «baneos», «twitch» o «color».</li>';
    return;
  }

  list.innerHTML = results.map((entry, index) => `
    <li>
      <button type="button" class="search-hit${index === 0 ? ' active' : ''}" data-hit="${index}">
        <span class="search-kind">${escapeHtml(entry.kind)}</span>
        <span class="search-label">${escapeHtml(entry.label)}</span>
        <span class="search-detail">${escapeHtml(entry.detail || '')}</span>
      </button>
    </li>`).join('');
}

function moveSearchSelection(delta) {
  const hits = [...document.querySelectorAll('.search-hit')];
  if (!hits.length) return;
  state.searchIndex = (state.searchIndex + delta + hits.length) % hits.length;
  hits.forEach((hit, index) => hit.classList.toggle('active', index === state.searchIndex));
  hits[state.searchIndex].scrollIntoView({ block: 'nearest' });
}

async function runSearchHit(index) {
  const entry = state.searchResults?.[index];
  if (!entry) return;
  closeSearch();
  await showSection(entry.section);
  if (!entry.focus) return;
  // Se abre y se resalta lo que se buscó, para no tener que localizarlo a
  // mano dentro de una lista larga.
  const target = document.querySelector(entry.focus);
  if (!target) return;
  if (target.tagName === 'DETAILS') target.open = true;
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.classList.add('flash');
  setTimeout(() => target.classList.remove('flash'), 1600);
}

function openSearch() {
  const dialog = $('#search-dialog');
  if (!dialog || dialog.open) return;
  const input = $('#search-input');
  if (input) input.value = '';
  renderSearchResults('');
  dialog.showModal();
  input?.focus();
}

function closeSearch() {
  const dialog = $('#search-dialog');
  if (dialog?.open) dialog.close();
}

function bindSearch() {
  $('#search-open')?.addEventListener('click', openSearch);
  $('#search-input')?.addEventListener('input', event => renderSearchResults(event.target.value));

  $('#search-results')?.addEventListener('click', event => {
    const hit = event.target.closest('[data-hit]');
    if (hit) runSearchHit(Number(hit.dataset.hit));
  });

  $('#search-dialog')?.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); moveSearchSelection(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveSearchSelection(-1); }
    else if (event.key === 'Enter') { event.preventDefault(); runSearchHit(state.searchIndex); }
  });

  document.addEventListener('keydown', event => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSearch();
    } else if (event.key === '/' && !typing && !$('#search-dialog')?.open) {
      event.preventDefault();
      openSearch();
    }
  });
}

/* ---------------------------------------------------------------- */
/* Navegación y estructura                                           */
/* ---------------------------------------------------------------- */

function renderNav() {
  const nav = $('#section-nav');
  const available = SECTIONS.filter(sectionAllowed);
  let lastGroup = null;
  nav.innerHTML = available.map(section => {
    const heading = section.group !== lastGroup ? `<p class="nav-group-label">${escapeHtml(section.group)}</p>` : '';
    lastGroup = section.group;
    const tally = section.id === 'moderacion' && state.data?.cases
      ? `<span class="nav-tally">${state.data.cases.filter(item => item.status === 'active').length}</span>`
      : '';
    // Las funciones de plan se listan igual, con un candado: esconderlas
    // dejaría al administrador sin saber siquiera que existen.
    const locked = sectionLocked(section);
    const lock = locked ? '<span class="nav-lock" aria-label="Necesita plan">🔒</span>' : '';
    return `${heading}
      <button class="nav-item${locked ? ' locked' : ''}" type="button" data-section="${section.id}"${state.section === section.id ? ' aria-current="page"' : ''}>
        <span class="nav-icon" aria-hidden="true">${section.icon}</span>
        <span>${escapeHtml(section.label)}</span>
        ${tally}${lock}
      </button>`;
  }).join('');

  nav.querySelectorAll('[data-section]').forEach(button => {
    button.addEventListener('click', () => showSection(button.dataset.section));
  });
}

function renderGuildSwitcher() {
  const container = $('#guild-switcher');
  if (!state.guilds.length) {
    container.innerHTML = '<p class="hint">No hay servidores disponibles para esta cuenta.</p>';
    return;
  }
  container.innerHTML = state.guilds.map(guild => `
    <button class="guild-option" type="button" data-guild="${escapeHtml(guild.id)}" aria-pressed="${guild.id === state.guildId}">
      ${avatarMarkup(guild.icon, guild.name, 'guild-badge')}
      <span class="guild-option-text">
        <strong>${escapeHtml(guild.name)}</strong>
        <small>${escapeHtml(TIER_LABELS[guild.tier] || guild.tier)}</small>
      </span>
    </button>`).join('');

  container.querySelectorAll('[data-guild]').forEach(button => {
    button.addEventListener('click', () => selectGuild(button.dataset.guild));
  });
}

function renderBrand() {
  const identity = state.data?.identity;
  const name = identity?.webhook?.name || state.data?.guild?.name || 'Vesper';
  $('#brand-avatar').innerHTML = identity?.webhook?.avatar
    ? `<img src="${escapeHtml(identity.webhook.avatar)}" alt="" referrerpolicy="no-referrer">`
    : escapeHtml(name.slice(0, 1).toUpperCase());
  $('#brand-name').textContent = name;
  $('#brand-sub').textContent = state.data?.guild?.name || 'Panel de control';
}

function renderAccount() {
  const user = state.session.user;
  const preferred = user.discord || user.google;
  const name = user.discord?.globalName || user.discord?.username || user.google?.name || user.google?.email || 'Cuenta vinculada';
  const detail = user.globalOwner ? 'Propietario global' : user.discord ? 'Cuenta de Discord' : 'Cuenta de Google';

  const actions = [];
  if (!user.discord && state.publicConfig?.discordEnabled) actions.push('<a class="button sm" href="/auth/discord">Vincular Discord</a>');
  if (!user.google && state.publicConfig?.googleEnabled) actions.push('<a class="button quiet sm" href="/auth/google">Vincular Google</a>');
  if (user.discord && user.google) actions.push('<button class="button ghost sm" type="button" id="unlink-google">Separar Google</button>');
  actions.push('<button class="button ghost sm" type="button" id="logout">Cerrar sesión</button>');

  $('#account-card').innerHTML = `
    <div class="theme-switch" role="group" aria-label="Tema del panel">
      ${[['auto', '◐', 'El del sistema'], ['claro', '☀', 'Claro'], ['oscuro', '☾', 'Oscuro']].map(([value, icon, label]) => `
        <button type="button" data-theme-option="${value}" title="${escapeHtml(label)}" aria-pressed="false">
          <span aria-hidden="true">${icon}</span><span class="sr-only">${escapeHtml(label)}</span>
        </button>`).join('')}
    </div>
    <div class="account-row">
      ${avatarMarkup(preferred?.avatar || preferred?.picture, name)}
      <div class="account-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(detail)}</small></div>
    </div>
    <div class="account-actions">${actions.join('')}</div>`;

  applyTheme();

  $('#logout')?.addEventListener('click', async () => {
    try {
      await api('/logout', { method: 'POST' });
      location.href = '/panel';
    } catch (error) { toast(error.message, 'bad'); }
  });

  $('#unlink-google')?.addEventListener('click', async () => {
    if (!await confirmDialog({
      title: 'Separar las cuentas',
      message: 'Google y Discord dejarán de estar vinculadas. Podrás volver a unirlas cuando quieras.',
      confirmLabel: 'Separar'
    })) return;
    try {
      const result = await api('/unlink', { method: 'POST', body: JSON.stringify({ provider: 'google' }) });
      state.session = { ...state.session, ...result };
      renderAccount();
      toast('Identidades separadas.', 'ok');
    } catch (error) { toast(error.message, 'bad'); }
  });
}

function showSection(id) {
  const section = SECTIONS.find(item => item.id === id);
  if (!section || !sectionAllowed(section)) return showSection('inicio');

  if (state.dirty.size) {
    // La navegación es asíncrona a partir de aquí, así que se delega en una
    // función aparte para no dejar showSection a medias.
    confirmDialog({
      title: 'Cambios sin guardar',
      message: 'Has modificado esta pantalla y no la has guardado. Si sales, se pierden los cambios.',
      confirmLabel: 'Salir sin guardar',
      cancelLabel: 'Seguir aquí',
      danger: true
    }).then(accepted => { if (accepted) { state.dirty.clear(); showSection(id); } });
    return;
  }
  state.section = id;
  closeNav();
  renderNav();
  renderView();
  $('#view').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderView() {
  const section = currentSection();
  const view = $('#view');

  $('#view-eyebrow').textContent = section.group;
  $('#view-title').textContent = section.title;
  $('#view-hint').textContent = section.hint || '';

  if (!state.data) {
    view.innerHTML = '<div class="card"><div class="skeleton line"></div><div class="skeleton block"></div></div>';
    return;
  }

  if (!state.data.permissions.configure && section.needs === 'configure') {
    view.innerHTML = card({
      eyebrow: 'Acceso',
      title: 'Necesitas permisos de administración',
      description: 'Esta pantalla requiere Administrar servidor o ser propietario del bot. Puedes seguir viendo el resumen y tus propios casos.',
      body: ''
    });
    return;
  }

  const locked = sectionLocked(section);
  if (locked) {
    view.innerHTML = lockedScreen(section, locked);
    bindCommon(view);
    updateSaveBar();
    return;
  }

  const renderer = RENDERERS[section.id];
  view.innerHTML = renderer.render();
  bindCommon(view);
  renderer.bind(view);
  // Al cambiar de pantalla, lo pendiente de la anterior ya no está en el DOM.
  updateSaveBar();
}

function openNav() {
  document.body.dataset.nav = 'open';
  $('#nav-toggle').setAttribute('aria-expanded', 'true');
  $('#nav-scrim').hidden = false;
}

function closeNav() {
  delete document.body.dataset.nav;
  $('#nav-toggle')?.setAttribute('aria-expanded', 'false');
  const scrim = $('#nav-scrim');
  if (scrim) scrim.hidden = true;
}

/* ---------------------------------------------------------------- */
/* Carga de datos                                                    */
/* ---------------------------------------------------------------- */

async function refreshStatus() {
  const pill = $('#status-pill');
  try {
    const health = await api('/status');
    state.health = health;
    const ready = health.ready ?? health.healthy;
    pill.textContent = ready ? 'Vesper operativo' : healthSummary(health);
    pill.className = `pill ${ready ? 'ok' : health.botReady ? 'warn' : 'bad'}`;
  } catch {
    state.health = null;
    pill.textContent = 'Sin conexión con Vesper';
    pill.className = 'pill bad';
  }
}

async function selectGuild(guildId, { keepSection = false, silent = false } = {}) {
  state.guildId = guildId;
  if (!keepSection) state.section = 'inicio';
  state.dirty.clear();
  renderGuildSwitcher();

  if (!silent) {
    $('#view').innerHTML = '<div class="card"><div class="skeleton line"></div><div class="skeleton block"></div></div>';
    $('#view-title').textContent = 'Cargando…';
  }

  try {
    state.data = await api(`/guilds/${guildId}`);
    applyTheme();
    renderBrand();
    renderNav();
    renderView();
  } catch (error) {
    state.data = null;
    $('#view').innerHTML = card({
      eyebrow: 'Error',
      title: 'No se pudo cargar este servidor',
      description: error.message,
      actions: '<button class="button quiet sm" type="button" data-goto="inicio">Reintentar</button>',
      body: ''
    });
    toast(error.message, 'bad');
  }
}

function showLogin() {
  $('#boot-view').hidden = true;
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;

  const params = new URLSearchParams(location.search);
  const message = $('#login-message');
  if (params.get('message')) {
    message.textContent = params.get('message');
    message.className = 'callout danger';
    message.hidden = false;
  }

  const actions = [];
  if (state.bootError) {
    message.innerHTML = `<strong>No se pudo contactar con Vesper.</strong><span>${escapeHtml(state.bootError)} Puede estar reiniciando; inténtalo en un momento.</span>`;
    message.className = 'callout danger';
    message.hidden = false;
    actions.push('<a class="button" href="/panel">Reintentar</a>');
  } else if (!state.publicConfig?.enabled) {
    actions.push('<div class="callout danger"><strong>El panel está desactivado.</strong><span>Pon WEB_DASHBOARD_ENABLED=true en el alojamiento.</span></div>');
  } else if (!state.publicConfig.ready) {
    actions.push('<div class="callout danger"><strong>Falta la clave de sesión.</strong><span>Configura WEB_SESSION_SECRET con al menos 32 caracteres.</span></div>');
  } else {
    if (state.publicConfig.discordEnabled) actions.push('<a class="button" href="/auth/discord">Continuar con Discord</a>');
    if (state.publicConfig.googleEnabled) actions.push('<a class="button quiet" href="/auth/google">Continuar con Google</a>');
    if (!state.publicConfig.discordEnabled && !state.publicConfig.googleEnabled) {
      actions.push('<div class="callout danger"><strong>No hay proveedor de acceso configurado.</strong><span>Añade DISCORD_OAUTH_CLIENT_SECRET para poder entrar.</span></div>');
    }
  }
  $('#login-actions').innerHTML = actions.join('');
}

async function boot() {
  // El tema se aplica antes de nada, para que no haya un fogonazo blanco
  // mientras carga si el usuario lo tiene en oscuro.
  state.theme = storedTheme();
  applyTheme();
  bindTheme();

  try {
    const response = await fetch('/api/web/public', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);
    state.publicConfig = await response.json();
  } catch (error) {
    state.bootError = error.message;
    showLogin();
    return;
  }

  try {
    state.session = await api('/session');
  } catch {
    showLogin();
    return;
  }

  history.replaceState({}, '', '/panel');
  $('#boot-view').hidden = true;
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;

  renderAccount();
  bindSaveBar();
  bindSearch();
  await refreshStatus();

  try {
    const result = await api('/guilds');
    state.guilds = result.guilds || [];
    renderGuildSwitcher();
    if (state.guilds.length) {
      await selectGuild(state.guilds[0].id);
    } else {
      $('#view-title').textContent = 'Sin servidores';
      $('#view-hint').textContent = '';
      $('#view').innerHTML = card({
        eyebrow: 'Acceso',
        title: 'No hay servidores disponibles para esta cuenta',
        description: 'Solo aparecen servidores aprobados en los que Vesper pueda comprobar tu membresía. Si acabas de entrar a uno, pulsa Actualizar.',
        body: ''
      });
    }
  } catch (error) {
    toast(error.message, 'bad');
  }
}

/* ---------------------------------------------------------------- */
/* Arranque                                                          */
/* ---------------------------------------------------------------- */

$('#refresh-button').addEventListener('click', async () => {
  await refreshStatus();
  if (state.guildId) await selectGuild(state.guildId, { keepSection: true });
});

$('#nav-toggle').addEventListener('click', () => {
  if (document.body.dataset.nav === 'open') closeNav(); else openNav();
});
$('#nav-scrim').addEventListener('click', closeNav);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.dataset.nav === 'open') closeNav();
});

// Este sí es del navegador y no se puede estilar, pero solo salta al cerrar la
// pestaña de verdad: dentro del panel la navegación usa el diálogo propio.
window.addEventListener('beforeunload', event => {
  if (!state.dirty.size) return;
  event.preventDefault();
  event.returnValue = '';
});

// El estado del bot se refresca solo para que la insignia no se quede antigua.
setInterval(() => { if (state.session) refreshStatus(); }, 45_000);

boot();
