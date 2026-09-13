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
  dirty: new Set()
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

function applyTheme() {
  const root = document.documentElement;
  const guild = state.data?.guild;
  const profile = state.data?.config?.profile || {};
  const fallback = guild?.tier === 'themed_main' ? '#8DDCF4' : '#9D63FF';
  const accentHex = profile.primaryColor || fallback;
  const rgb = parseHex(accentHex) || parseHex(fallback);

  root.style.setProperty('--accent', accentHex);
  root.style.setProperty('--accent-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .16)`);
  root.style.setProperty('--accent-line', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .34)`);
  root.style.setProperty('--accent-ink', luminance(rgb) > 0.55 ? '#14101c' : '#ffffff');

  // Un servidor con paleta clara merece un panel claro. Se deduce del propio
  // color elegido, así que cambiar el color cambia también el lienzo.
  const light = luminance(rgb) > 0.62;
  document.body.dataset.mode = light ? 'light' : 'dark';

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', light ? '#f7f5fb' : '#0e0b14');
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
      if (line.startsWith('### ')) return `<span class="md-h3">${line.slice(4)}</span>`;
      if (line.startsWith('## ')) return `<span class="md-h2">${line.slice(3)}</span>`;
      if (line.startsWith('# ')) return `<span class="md-h1">${line.slice(2)}</span>`;
      return line;
    })
    .join('<br>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/(@[\w-]+)/g, '<span class="md-mention">$1</span>');
}

function sampleValues(text) {
  const guild = state.data?.guild;
  return String(text ?? '')
    .replaceAll('{user}', '@nuevo-miembro')
    .replaceAll('{username}', 'nuevo-miembro')
    .replaceAll('{displayName}', 'Nuevo miembro')
    .replaceAll('{server}', guild?.name || 'tu servidor')
    .replaceAll('{memberCount}', formatNumber(guild?.memberCount ?? 0))
    .replaceAll('{userId}', '123456789012345678');
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

  const footerRow = !componentsV2 && footer
    ? `<div class="embed-footer">${escapeHtml(footer)} · hoy a las 14:32</div>`
    : '';

  return `
    <div class="embed-preview">
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

const SECTIONS = [
  { id: 'inicio', group: 'Servidor', icon: '◈', label: 'Inicio', title: 'Resumen del servidor',
    hint: 'Estado de Vesper y qué falta por configurar.' },
  { id: 'identidad', group: 'Servidor', icon: '✦', label: 'Identidad', title: 'Identidad del bot',
    hint: 'Cómo se llama y qué cara pone Vesper en este servidor.', needs: 'configure' },
  { id: 'bienvenidas', group: 'Mensajes', icon: '✉', label: 'Bienvenidas', title: 'Bienvenida y despedida',
    hint: 'Edita los embeds que se publican cuando alguien entra o sale.', needs: 'configure' },
  { id: 'avisos', group: 'Mensajes', icon: '◎', label: 'Avisos de redes', title: 'TikTok, Twitch y YouTube',
    hint: 'Cuentas vigiladas, canales de destino y rol al que avisar.', needs: 'social' },
  { id: 'moderacion', group: 'Comunidad', icon: '⚖', label: 'Moderación', title: 'Moderación',
    hint: 'Filtros automáticos, casos abiertos y sanciones.' },
  { id: 'comunidad', group: 'Comunidad', icon: '☰', label: 'Comunidad', title: 'Tickets, sugerencias y roles',
    hint: 'Paneles de soporte, buzón de sugerencias, autorroles y destacados.', needs: 'configure' },
  { id: 'musica', group: 'Comunidad', icon: '♪', label: 'Música', title: 'Reproductor de música',
    hint: 'Canales permitidos y límites de la cola.', needs: 'configure' },
  { id: 'modulos', group: 'Ajustes', icon: '⚙', label: 'Módulos y permisos', title: 'Módulos y permisos',
    hint: 'Qué funciones están activas y qué roles pueden usarlas.', needs: 'configure' },
  { id: 'resumen', group: 'Ajustes', icon: '≡', label: 'Configuración', title: 'Configuración completa',
    hint: 'Todo lo que Vesper tiene guardado de este servidor.', needs: 'configure' },
  { id: 'auditoria', group: 'Ajustes', icon: '⏱', label: 'Auditoría', title: 'Auditoría del panel',
    hint: 'Quién cambió qué desde la web.', needs: 'configure' }
];

function sectionAllowed(section) {
  if (!section.needs) return true;
  return Boolean(state.data?.permissions?.[section.needs]);
}

function currentSection() {
  return SECTIONS.find(section => section.id === state.section) || SECTIONS[0];
}

/* ---------------------------------------------------------------- */
/* Inicio                                                            */
/* ---------------------------------------------------------------- */

function renderInicio() {
  const data = state.data;
  const health = state.health || data.health || {};
  const ready = health.ready ?? health.healthy;
  const setup = data.setup || { checks: [], percentage: 0, ready: 0, total: 0 };
  const activeCases = (data.cases || []).filter(item => item.status === 'active').length;
  const accounts = ['tiktok', 'twitch', 'youtube']
    .reduce((total, platform) => total + (data.config?.[platform]?.users?.length || 0), 0);
  const activeModules = Object.values(data.config?.features || {}).filter(Boolean).length;

  const pending = setup.checks.filter(check => !check.ready);
  const checks = setup.checks.map(check => `
    <div class="check-row">
      <span>${escapeHtml(check.label)}</span>
      <span class="tag ${check.ready ? 'ok' : 'warn'}">${check.ready ? 'Listo' : 'Pendiente'}</span>
    </div>`).join('');

  const monitors = (health.monitors || []).map(monitor => `
    <div class="check-row">
      <span>${escapeHtml(monitor.name)}</span>
      <span class="tag ${monitor.disabledUntil ? 'warn' : 'ok'}">${monitor.disabledUntil ? `En pausa hasta ${formatDate(monitor.disabledUntil)}` : 'Activo'}</span>
    </div>`).join('');

  const noDiscord = !state.session.user.discord
    ? `<div class="callout warn"><strong>Falta vincular Discord.</strong><span>Con solo Google puedes configurar, pero no moderar ni gestionar cuentas de redes. Vincula Discord desde la tarjeta de tu cuenta.</span></div>`
    : '';

  const nextStep = pending.length
    ? `<div class="callout info"><strong>Siguiente paso: ${escapeHtml(pending[0].label)}.</strong><span>${pending.length === 1 ? 'Queda 1 ajuste' : `Quedan ${pending.length} ajustes`} por completar.</span></div>`
    : `<div class="callout ok"><strong>Configuración completa.</strong><span>No queda nada pendiente en este servidor.</span></div>`;

  return `
    ${noDiscord}
    <div class="grid-3">
      <div class="stat">
        <small>Estado de Vesper</small>
        <strong class="${ready ? 'ok' : 'warn'}">${ready ? 'Operativo' : 'Requiere atención'}</strong>
        <span class="stat-note">${escapeHtml(healthSummary(health))}</span>
      </div>
      <div class="stat">
        <small>Preparación</small>
        <strong>${setup.percentage}%</strong>
        <span class="stat-note">${setup.ready} de ${setup.total} ajustes listos</span>
      </div>
      <div class="stat">
        <small>Cuentas vigiladas</small>
        <strong>${accounts}</strong>
        <span class="stat-note">TikTok, Twitch y YouTube</span>
      </div>
      <div class="stat">
        <small>Casos activos</small>
        <strong class="${activeCases ? 'warn' : ''}">${activeCases}</strong>
        <span class="stat-note">${data.cases?.length || 0} visibles en total</span>
      </div>
    </div>

    ${nextStep}

    <div class="grid-2">
      ${card({
        eyebrow: 'Preparación',
        title: 'Qué falta por configurar',
        description: 'Cada punto corresponde a un ajuste que Vesper necesita para trabajar.',
        body: `<div class="meter"><span data-meter="${setup.percentage}"></span></div><div class="check-list">${checks || emptyBlock('Sin comprobaciones', 'El servidor todavía no tiene configuración.')}</div>`
      })}
      ${card({
        eyebrow: 'Servicio',
        title: 'Monitores y conexiones',
        description: 'Si un monitor falla varias veces seguidas entra en pausa y se reanuda solo.',
        body: `
          <div class="check-list">
            <div class="check-row"><span>Base de datos</span><span class="tag ${health.database?.connected ? 'ok' : 'bad'}">${health.database?.connected ? 'Conectada' : 'Desconectada'}</span></div>
            <div class="check-row"><span>Música (Lavalink)</span><span class="tag ${health.music?.connected ? 'ok' : health.music?.configured ? 'warn' : ''}">${health.music?.connected ? 'Conectada' : health.music?.configured ? 'Sin conexión' : 'No configurada'}</span></div>
            ${monitors}
          </div>`
      })}
    </div>

    ${card({
      eyebrow: 'Módulos',
      title: `${activeModules} de ${Object.keys(data.config?.features || {}).length} funciones activas`,
      description: 'Un vistazo rápido. Se activan y desactivan en «Módulos y permisos».',
      actions: data.permissions.configure ? '<button class="button quiet sm" type="button" data-goto="modulos">Gestionar módulos</button>' : '',
      body: `<div class="chips">${Object.entries(data.config?.features || {}).map(([key, value]) =>
        `<span class="tag ${value ? 'ok' : ''}">${escapeHtml(moduleLabel(key))}</span>`).join('') || emptyBlock('Sin módulos', 'No se pudo leer la configuración.')}</div>`
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
          <label for="profile-theme">Tema del panel</label>
          <select id="profile-theme">
            ${themeOptions.map(([value, label]) => `<option value="${value}"${profile.theme === value ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}
          </select>
          <span class="hint">Identifica el estilo del servidor.</span>
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
/* Bienvenidas                                                       */
/* ---------------------------------------------------------------- */

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
          <div class="field wide">
            <label for="embed-${kind}-title">Título</label>
            <input id="embed-${kind}-title" type="text" maxlength="240" data-embed="${kind}"
                   value="${escapeHtml(saved.title || '')}" placeholder="${escapeHtml(fallback.title || '')}">
          </div>
          <div class="field wide">
            <label for="embed-${kind}-message">Mensaje</label>
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
              <span class="field-label">${defaults.layout === 'components_v2' ? 'Color del borde' : 'Color del embed'}</span>
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

function embedValues(kind) {
  const read = suffix => $(`#embed-${kind}-${suffix}`)?.value ?? '';
  const useColor = $(`#embed-${kind}-usecolor`)?.checked;
  const thumbnail = $(`#embed-${kind}-thumbnail`);
  return {
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
  const componentsV2 = defaults.layout === 'components_v2';

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
          </div>
          ${formActions('Guardar canales')}
        </form>`
    })}

    ${card({
      eyebrow: 'Cómo escribir',
      title: 'Variables disponibles',
      description: `${defaults.note || ''} Pulsa una variable para copiarla.`,
      body: `<ul class="var-list">${variables}</ul>`
    })}

    ${embedEditorCard('welcome')}
    ${embedEditorCard('goodbye')}`;
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
    ${health.music?.configured === false ? '<div class="callout"><strong>Lavalink no está configurado en el alojamiento.</strong><span>Sin él, el reproductor no puede conectarse aunque el módulo esté activo.</span></div>' : ''}

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

  const switches = Object.entries(config.features || {}).map(([key, value]) => `
    <label class="switch">
      <input type="checkbox" name="${escapeHtml(key)}" ${value ? 'checked' : ''}>
      <span class="switch-copy"><strong>${escapeHtml(moduleLabel(key))}</strong><small>${escapeHtml(moduleHint(key))}</small></span>
    </label>`).join('');

  return `
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

async function saveConfig(body, successMessage, submitter = null) {
  const button = submitter?.tagName === 'BUTTON' ? submitter : null;
  const previousLabel = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Guardando…'; }

  try {
    const result = await api(`/guilds/${state.guildId}/config`, { method: 'PATCH', body: JSON.stringify(body) });
    state.data.config = result.config;
    state.data.setup = result.setup;
    state.dirty.clear();
    if (result.warning) toast(result.warning, 'bad');
    else toast(successMessage, 'ok');
    // Se recarga el servidor para que la identidad efectiva, los avisos y el
    // resumen reflejen lo recién guardado sin tener que refrescar a mano.
    await selectGuild(state.guildId, { keepSection: true, silent: true });
    return result;
  } catch (error) {
    toast(error.message, 'bad');
    return null;
  } finally {
    if (button) { button.disabled = false; button.textContent = previousLabel; }
  }
}

function markDirty(form) {
  if (!form) return;
  state.dirty.add(form.id);
  const flag = form.querySelector('.dirty-flag');
  if (flag) flag.hidden = false;
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
  root.querySelector('#form-welcome-channels')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ general: {
      welcomeChannel: $('#channel-welcome').value || null,
      goodbyeChannel: $('#channel-goodbye').value || null
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

    root.querySelector(`[data-embed-reset="${kind}"]`)?.addEventListener('click', event => {
      if (!confirm(`¿Restablecer el embed de ${EMBED_KINDS[kind].toLowerCase()} al diseño original del servidor?`)) return;
      saveConfig(
        { embeds: { [kind]: { title: null, message: null, footer: null, image: null, color: null, thumbnail: true } } },
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
      if (!confirm(`¿Dejar de vigilar ${account}?`)) return;
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
    const note = prompt(`Nota interna para el caso #${button.dataset.caseNote}`);
    if (!note?.trim()) return;
    await updateCase(button.dataset.caseNote, { note: note.trim() });
  }));

  $$('[data-case-status]').forEach(button => button.addEventListener('click', async () => {
    const labels = { active: 'reabrir', resolved: 'resolver', revoked: 'revocar' };
    if (!confirm(`¿Deseas ${labels[button.dataset.status]} el caso #${button.dataset.caseStatus}?`)) return;
    await updateCase(button.dataset.caseStatus, { status: button.dataset.status, note: prompt('Nota opcional') || '' });
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
      const labels = { open: 'devolver a pendiente', approved: 'aprobar', rejected: 'rechazar' };
      if (!confirm(`¿Deseas ${labels[button.dataset.status]} esta sugerencia?`)) return;
      const note = prompt('Nota opcional para quien la propuso') || '';
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
    const features = Object.fromEntries(
      [...event.currentTarget.querySelectorAll('input[type="checkbox"]')].map(input => [input.name, input.checked])
    );
    saveConfig({ features }, 'Módulos actualizados.', event.submitter);
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

const RENDERERS = {
  inicio: { render: renderInicio, bind: () => {} },
  identidad: { render: renderIdentidad, bind: bindIdentidad },
  bienvenidas: { render: renderBienvenidas, bind: bindBienvenidas },
  avisos: { render: renderAvisos, bind: bindAvisos },
  moderacion: { render: renderModeracion, bind: bindModeracion },
  comunidad: { render: renderComunidad, bind: bindComunidad },
  musica: { render: renderMusica, bind: bindMusica },
  modulos: { render: renderModulos, bind: bindModulos },
  resumen: { render: renderResumen, bind: bindResumen },
  auditoria: { render: renderAuditoria, bind: () => loadAudit() }
};

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
    return `${heading}
      <button class="nav-item" type="button" data-section="${section.id}"${state.section === section.id ? ' aria-current="page"' : ''}>
        <span class="nav-icon" aria-hidden="true">${section.icon}</span>
        <span>${escapeHtml(section.label)}</span>
        ${tally}
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
    <div class="account-row">
      ${avatarMarkup(preferred?.avatar || preferred?.picture, name)}
      <div class="account-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(detail)}</small></div>
    </div>
    <div class="account-actions">${actions.join('')}</div>`;

  $('#logout')?.addEventListener('click', async () => {
    try {
      await api('/logout', { method: 'POST' });
      location.href = '/panel';
    } catch (error) { toast(error.message, 'bad'); }
  });

  $('#unlink-google')?.addEventListener('click', async () => {
    if (!confirm('¿Separar las cuentas de Google y Discord? Podrás volver a vincularlas después.')) return;
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

  if (state.dirty.size && !confirm('Tienes cambios sin guardar en esta pantalla. ¿Salir de todos modos?')) return;
  state.dirty.clear();
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

  const renderer = RENDERERS[section.id];
  view.innerHTML = renderer.render();
  bindCommon(view);
  renderer.bind(view);
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

window.addEventListener('beforeunload', event => {
  if (!state.dirty.size) return;
  event.preventDefault();
  event.returnValue = '';
});

// El estado del bot se refresca solo para que la insignia no se quede antigua.
setInterval(() => { if (state.session) refreshStatus(); }, 45_000);

boot();
