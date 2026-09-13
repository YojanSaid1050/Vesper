const state = {
  publicConfig: null,
  bootError: null,
  session: null,
  guilds: [],
  selectedGuildId: null,
  overview: null,
  activeTab: 'overview'
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

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
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.toggle('error', error);
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.hidden = true; }, 4500);
}

async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (state.session?.csrfToken && !['GET', 'HEAD'].includes(options.method || 'GET')) {
    headers['X-CSRF-Token'] = state.session.csrfToken;
  }
  const response = await fetch(`/api/web${path}`, { ...options, headers });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) showLogin();
    throw new Error(data?.error || `Error HTTP ${response.status}`);
  }
  return data;
}

function avatarMarkup(url, fallback = 'V') {
  return url
    ? `<img class="avatar" src="${escapeHtml(url)}" alt="">`
    : `<span class="avatar guild-icon">${escapeHtml(fallback.slice(0, 1).toUpperCase())}</span>`;
}

function showLogin() {
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
  const params = new URLSearchParams(location.search);
  if (params.get('message')) {
    $('#auth-error').textContent = params.get('message');
    $('#auth-error').hidden = false;
  }
  const actions = [];
  if (state.bootError) {
    actions.push(`<div class="notice danger">No se pudo contactar con Vesper: ${escapeHtml(state.bootError)}. Puede estar reiniciando; vuelve a intentarlo en un momento.</div>`);
    actions.push('<a class="button secondary" href="/panel">Reintentar</a>');
  } else if (!state.publicConfig?.enabled) {
    actions.push('<div class="notice danger">El panel web todavía no está habilitado en el servidor.</div>');
  } else if (!state.publicConfig.ready) {
    actions.push('<div class="notice danger">El panel necesita una clave de sesión segura antes de poder iniciar.</div>');
  } else {
    if (state.publicConfig.discordEnabled) actions.push('<a class="button" href="/auth/discord">Continuar con Discord</a>');
    if (state.publicConfig.googleEnabled) actions.push('<a class="button secondary" href="/auth/google">Continuar con Google</a>');
    if (!state.publicConfig.discordEnabled && !state.publicConfig.googleEnabled) {
      actions.push('<div class="notice danger">Configura al menos un proveedor OAuth para abrir el panel.</div>');
    }
  }
  $('#auth-actions').innerHTML = actions.join('');
}

function renderIdentity() {
  const user = state.session.user;
  const preferred = user.discord || user.google;
  const name = user.discord?.globalName || user.discord?.username || user.google?.name || user.google?.email || 'Cuenta vinculada';
  const detail = user.globalOwner ? 'Propietario global' : user.discord ? 'Cuenta de Discord' : 'Cuenta de Google';
  const links = [];
  if (!user.discord && state.publicConfig.discordEnabled) links.push('<a class="button small" href="/auth/discord">Vincular Discord</a>');
  if (!user.google && state.publicConfig.googleEnabled) links.push('<a class="button secondary small" href="/auth/google">Vincular Google</a>');
  if (user.discord && user.google) links.push('<button class="button ghost small" data-unlink="google" type="button">Desvincular Google</button>');
  links.push('<button id="logout-button" class="button ghost small" type="button">Cerrar sesión</button>');
  $('#identity-card').innerHTML = `
    <div class="identity-row">
      ${avatarMarkup(preferred?.avatar || preferred?.picture, name)}
      <div class="identity-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(detail)}</small></div>
    </div>
    <div class="identity-links">${links.join('')}</div>`;
  $('#logout-button').addEventListener('click', async () => {
    try {
      await api('/logout', { method: 'POST' });
      location.href = '/panel';
    } catch (error) { toast(error.message, true); }
  });
  $('[data-unlink]')?.addEventListener('click', async event => {
    if (!confirm('¿Deseas separar las cuentas de Google y Discord? Podrás volver a vincularlas después.')) return;
    try {
      const result = await api('/unlink', { method: 'POST', body: JSON.stringify({ provider: event.currentTarget.dataset.unlink }) });
      state.session = { ...state.session, ...result };
      renderIdentity();
      toast('Las identidades se separaron correctamente.');
    } catch (error) { toast(error.message, true); }
  });
}

function renderGuildList() {
  $('#guild-list').innerHTML = state.guilds.length ? state.guilds.map(guild => `
    <button class="guild-button ${guild.id === state.selectedGuildId ? 'active' : ''}" type="button" data-guild-id="${guild.id}">
      <span class="guild-icon">${guild.icon ? `<img src="${escapeHtml(guild.icon)}" alt="">` : escapeHtml(guild.name.slice(0, 1))}</span>
      <span class="guild-name">${escapeHtml(guild.name)}${guild.tier === 'themed_main' ? '<small class="guild-tier">Main temático</small>' : guild.tier === 'primary_main' ? '<small class="guild-tier">Main principal</small>' : ''}</span>
    </button>`).join('') : '<div class="notice">No hay servidores disponibles para esta cuenta.</div>';
  $$('.guild-button').forEach(button => button.addEventListener('click', () => selectGuild(button.dataset.guildId)));
}

function applyGuildTheme() {
  const data = state.overview;
  const themed = data?.guild?.tier === 'themed_main';
  const body = document.body;
  body.dataset.theme = themed ? (data.config?.profile?.theme || 'cinnamoroll') : data?.guild?.tier === 'primary_main' ? 'void' : 'neutral';
  for (const variable of ['--purple', '--purple-2']) body.style.removeProperty(variable);
  if (themed) {
    body.style.setProperty('--purple', data.config?.profile?.primaryColor || '#8DDCF4');
    body.style.setProperty('--purple-2', data.config?.profile?.secondaryColor || '#F8C8DC');
  }
  $('#panel-brand-name').textContent = themed ? (data.config?.profile?.displayName || 'AnkeBot') : 'Vesper';
  $('#panel-brand-mode').textContent = themed ? 'Ankerie Console' : data?.guild?.tier === 'primary_main' ? 'Void Console' : 'Server Console';
}

function selectOptions(items, selected, emptyLabel = 'Sin configurar') {
  const values = new Set(Array.isArray(selected) ? selected.map(String) : [String(selected || '')]);
  return `<option value="">${escapeHtml(emptyLabel)}</option>${items.map(item =>
    `<option value="${item.id}" ${values.has(String(item.id)) ? 'selected' : ''}>${escapeHtml(item.parent ? `${item.parent} / ${item.name}` : item.name)}</option>`
  ).join('')}`;
}

function multiOptions(items, selected = []) {
  const values = new Set((selected || []).map(String));
  return items.map(item => `<option value="${item.id}" ${values.has(String(item.id)) ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
}

function selectedValues(select) {
  return [...select.selectedOptions].map(option => option.value).filter(Boolean);
}

const MODULE_LABELS = {
  tiktok: 'Avisos de TikTok',
  twitch: 'Avisos de Twitch',
  youtube: 'Avisos de YouTube',
  welcome: 'Mensaje de bienvenida',
  goodbye: 'Mensaje de despedida',
  logs: 'Registro de eventos',
  music: 'Reproductor de música',
  moderation: 'Moderación automática',
  tickets: 'Tickets de soporte',
  suggestions: 'Buzón de sugerencias',
  selfroles: 'Autorroles',
  starboard: 'Mensajes destacados'
};

const MODULE_HINTS = {
  tiktok: 'Publica cuando una cuenta de TikTok empieza directo o sube un video.',
  twitch: 'Publica cuando un streamer de Twitch empieza directo.',
  youtube: 'Publica directos, videos y Shorts de los canales seguidos.',
  welcome: 'Envía el embed de bienvenida cuando alguien entra.',
  goodbye: 'Envía el embed de despedida cuando alguien sale.',
  logs: 'Registra entradas, salidas, ediciones, baneos y cambios de canal.',
  music: 'Habilita /musica y el reproductor de voz.',
  moderation: 'Filtra enlaces, invitaciones, menciones y mensajes repetidos.',
  tickets: 'Panel de tickets con categoría y transcripciones.',
  suggestions: 'Permite /sugerir y su revisión desde el panel.',
  selfroles: 'Panel donde los miembros eligen sus propios roles.',
  starboard: 'Destaca mensajes que superan un número de reacciones.'
};

const EMBED_KIND_LABELS = { welcome: 'Bienvenida', goodbye: 'Despedida' };

const EMBED_VARIABLES = [
  ['{user}', 'menciona al miembro'],
  ['{username}', 'su nombre de usuario'],
  ['{displayName}', 'su apodo en el servidor'],
  ['{server}', 'nombre del servidor'],
  ['{memberCount}', 'total de miembros'],
  ['{userId}', 'su ID']
];

function moduleLabel(key) {
  return MODULE_LABELS[key] || key;
}

// Render mínimo de Markdown solo para la vista previa. Se escapa PRIMERO y
// después se aplican las marcas, así el contenido del usuario nunca puede
// inyectar HTML en el panel.
function previewMarkdown(value) {
  const escaped = escapeHtml(value ?? '');
  return escaped
    .split('\n')
    .map(line => {
      if (line.startsWith('### ')) return `<span class="preview-h3">${line.slice(4)}</span>`;
      if (line.startsWith('## ')) return `<span class="preview-h2">${line.slice(3)}</span>`;
      if (line.startsWith('# ')) return `<span class="preview-h1">${line.slice(2)}</span>`;
      return line;
    })
    .join('<br>')
    .replaceAll('&lt;br&gt;', '<br>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// Sustituye las variables por valores de ejemplo, para que la vista previa se
// parezca a lo que verá un miembro real.
function previewVariables(value, data) {
  const guildName = data?.guild?.name || 'tu servidor';
  return String(value ?? '')
    .replaceAll('{user}', '@nuevo-miembro')
    .replaceAll('{username}', 'nuevo-miembro')
    .replaceAll('{displayName}', 'Nuevo miembro')
    .replaceAll('{server}', guildName)
    .replaceAll('{memberCount}', String(data?.guild?.memberCount ?? 0))
    .replaceAll('{userId}', '123456789012345678');
}

function statusLabel(status) {
  return { active: 'Activo', resolved: 'Resuelto', revoked: 'Revocado' }[status] || status;
}

function suggestionStatusLabel(status) {
  return { open: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' }[status] || status;
}

function actionLabel(action) {
  return { warning: 'Advertencia', timeout: 'Aislamiento', filter: 'Filtro automático' }[action] || action;
}

function embedFieldValues(kind) {
  const read = id => {
    const element = $(`#embed-${kind}-${id}`);
    return element ? element.value : '';
  };
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

function renderEmbedPreview(kind) {
  const container = $(`#embed-preview-${kind}`);
  if (!container) return;
  const data = state.overview;
  const defaults = data.embedDefaults || {};
  const fallback = defaults[kind] || {};
  const values = embedFieldValues(kind);

  const title = previewVariables(values.title ?? fallback.title, data);
  const message = previewVariables(values.message ?? fallback.message, data);
  const footer = previewVariables(values.footer, data);
  const color = values.color || fallback.color || '#5865F2';
  const image = values.image ?? fallback.image ?? null;
  const componentsV2 = defaults.layout === 'components_v2';

  const media = image
    ? `<img class="preview-image" src="${escapeHtml(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : '';
  const thumb = !componentsV2 && values.thumbnail
    ? '<span class="preview-thumb" aria-hidden="true">👤</span>'
    : '';
  const footerRow = !componentsV2 && footer
    ? `<div class="preview-footer">${escapeHtml(footer)} · hoy a las 14:32</div>`
    : '';

  // La CSP del panel es `style-src 'self'`, que también cubre los atributos
  // style en línea. El color se aplica después por CSSOM, que sí está
  // permitido; con un atributo style el borde saldría siempre gris.
  container.innerHTML = `
    <div class="preview-embed">
      <div class="preview-body">
        <div class="preview-text">
          <div class="preview-title">${previewMarkdown(title)}</div>
          ${componentsV2 ? '<div class="preview-divider" role="presentation"></div>' : ''}
          <div class="preview-description">${previewMarkdown(message)}</div>
        </div>
        ${thumb}
      </div>
      ${media}
      ${footerRow}
    </div>`;

  const embed = container.firstElementChild;
  if (embed) {
    embed.style.setProperty('border-left-color', color);
    embed.style.setProperty('--preview-accent', color);
  }
}

function embedCard(kind, config, defaults) {
  const saved = config.embeds?.[kind] || {};
  const fallback = defaults[kind] || {};
  const label = EMBED_KIND_LABELS[kind];
  const hasColor = Boolean(saved.color);
  const colorValue = saved.color || fallback.color || '#5865F2';

  const footerField = defaults.supportsFooter ? `
    <div class="field full">
      <label for="embed-${kind}-footer">Pie de página</label>
      <input id="embed-${kind}-footer" data-embed="${kind}" maxlength="200" placeholder="Nombre del bot • ${escapeHtml(state.overview.guild.name)}" value="${escapeHtml(saved.footer || '')}">
    </div>` : '';

  const thumbnailField = defaults.supportsThumbnail ? `
    <label class="check-card compact">
      <input id="embed-${kind}-thumbnail" data-embed="${kind}" type="checkbox" ${saved.thumbnail === false ? '' : 'checked'}>
      <span>Mostrar el avatar del miembro</span>
    </label>` : '';

  return `
    <article class="panel embed-editor" data-embed-card="${kind}">
      <div class="panel-header">
        <div>
          <p class="eyebrow">EMBED DE ${label.toUpperCase()}</p>
          <h2>${label}</h2>
          <p>Deja un campo vacío para conservar el valor original del servidor.</p>
        </div>
        <button class="button ghost small" type="button" data-embed-reset="${kind}">Restablecer</button>
      </div>
      <div class="embed-grid">
        <form id="embed-form-${kind}" class="form-grid embed-fields">
          <div class="field full">
            <label for="embed-${kind}-title">Título</label>
            <input id="embed-${kind}-title" data-embed="${kind}" maxlength="240" placeholder="${escapeHtml(fallback.title || '')}" value="${escapeHtml(saved.title || '')}">
          </div>
          <div class="field full">
            <label for="embed-${kind}-message">Mensaje</label>
            <textarea id="embed-${kind}-message" data-embed="${kind}" rows="6" maxlength="3000" placeholder="${escapeHtml(fallback.message || '')}">${escapeHtml(saved.message || '')}</textarea>
          </div>
          ${footerField}
          <div class="field full">
            <label for="embed-${kind}-image">Imagen o GIF (HTTPS)</label>
            <input id="embed-${kind}-image" data-embed="${kind}" type="url" maxlength="500" placeholder="${escapeHtml(fallback.image || 'https://...')}" value="${escapeHtml(saved.image || '')}">
          </div>
          <div class="field">
            <label for="embed-${kind}-color">${defaults.layout === 'components_v2' ? 'Color del borde' : 'Color del embed'}</label>
            <div class="color-row">
              <input id="embed-${kind}-color" data-embed="${kind}" type="color" value="${escapeHtml(colorValue)}" ${hasColor ? '' : 'disabled'}>
              <label class="check-inline">
                <input id="embed-${kind}-usecolor" data-embed="${kind}" type="checkbox" ${hasColor ? 'checked' : ''}>
                <span>Usar color propio</span>
              </label>
            </div>
          </div>
          ${thumbnailField}
          <div class="form-actions">
            <button class="button" type="submit">Guardar ${label.toLowerCase()}</button>
          </div>
        </form>
        <div class="embed-preview-wrap">
          <p class="eyebrow">VISTA PREVIA</p>
          <div id="embed-preview-${kind}" class="embed-preview"></div>
          <p class="muted-copy small-copy">Aproximación. Discord puede ajustar espaciado y tamaño de imagen.</p>
        </div>
      </div>
    </article>`;
}

function renderEmbedsSection(config, defaults) {
  if (!defaults) return '';
  const variables = EMBED_VARIABLES
    .map(([token, description]) => `<li><code>${escapeHtml(token)}</code> · ${escapeHtml(description)}</li>`)
    .join('');
  return `
    <article class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">EMBEDS</p>
          <h2>Bienvenida y despedida</h2>
          <p>${escapeHtml(defaults.note || '')}</p>
        </div>
      </div>
      <ul class="variable-list">${variables}</ul>
    </article>
    ${embedCard('welcome', config, defaults)}
    ${embedCard('goodbye', config, defaults)}`;
}

function bindEmbedEditor() {
  for (const kind of ['welcome', 'goodbye']) {
    const form = $(`#embed-form-${kind}`);
    if (!form) continue;

    form.addEventListener('input', event => {
      if (event.target.id === `embed-${kind}-usecolor`) {
        const picker = $(`#embed-${kind}-color`);
        if (picker) picker.disabled = !event.target.checked;
      }
      renderEmbedPreview(kind);
    });
    form.addEventListener('change', () => renderEmbedPreview(kind));

    form.addEventListener('submit', event => {
      event.preventDefault();
      saveConfig(
        { embeds: { [kind]: embedFieldValues(kind) } },
        `Embed de ${EMBED_KIND_LABELS[kind].toLowerCase()} actualizado.`,
        event.submitter
      );
    });

    $(`[data-embed-reset="${kind}"]`)?.addEventListener('click', event => {
      if (!confirm(`¿Restablecer el embed de ${EMBED_KIND_LABELS[kind].toLowerCase()} al diseño original del servidor?`)) return;
      saveConfig(
        { embeds: { [kind]: { title: null, message: null, footer: null, image: null, color: null, thumbnail: true } } },
        `Embed de ${EMBED_KIND_LABELS[kind].toLowerCase()} restablecido.`,
        event.currentTarget
      );
    });

    renderEmbedPreview(kind);
  }
}

function renderSummary() {
  const data = state.overview;
  const activeCases = data.cases.filter(item => item.status === 'active').length;
  // `ready` es el estado estricto (bot + base de datos + monitores + música).
  // `healthy` solo dice que el proceso sigue vivo, y serviría de poco aquí.
  const ready = data.health.ready ?? data.health.healthy;
  $('#summary-grid').innerHTML = `
    <article class="metric"><small>Estado de Vesper</small><strong class="${ready ? 'good' : 'warn'}">${ready ? 'Operativo' : 'Requiere atención'}</strong></article>
    <article class="metric"><small>Configuración</small><strong>${data.setup.percentage}%</strong></article>
    <article class="metric"><small>Casos visibles</small><strong>${data.cases.length}</strong></article>
    <article class="metric"><small>Casos activos</small><strong>${activeCases}</strong></article>`;
}

function renderOverview() {
  const data = state.overview;
  const checks = data.setup.checks.map(check => `
    <div class="status-item"><span>${escapeHtml(check.label)}</span><strong class="status-dot ${check.ready ? '' : 'missing'}">${check.ready ? 'Listo' : 'Pendiente'}</strong></div>`).join('');
  const identityNotice = !state.session.user.discord ? `
    <div class="notice danger">Vincula una cuenta de Discord para ver tus casos y ejecutar acciones de moderación.</div>` : '';
  $('#tab-overview').innerHTML = `
    ${identityNotice}
    <article class="panel">
      <div class="panel-header"><div><p class="eyebrow">PREPARACIÓN</p><h2>Estado de configuración</h2></div><strong>${data.setup.ready}/${data.setup.total}</strong></div>
      <progress class="progress" max="100" value="${data.setup.percentage}" aria-label="Configuración ${data.setup.percentage}%"></progress>
      <div class="status-list spaced">${checks}</div>
    </article>
    <div class="two-columns">
      <article class="panel"><p class="eyebrow">SERVIDOR</p><h2>${escapeHtml(data.guild.name)}</h2><p>${data.guild.memberCount.toLocaleString('es-CO')} miembros. Tus permisos se comprueban directamente en Discord cada vez que abres el panel.</p></article>
      <article class="panel"><p class="eyebrow">ACCESO</p><h2>${data.permissions.configure ? 'Administración' : data.permissions.moderate ? 'Moderación' : 'Usuario'}</h2><p>${data.permissions.configure ? 'Puedes cambiar módulos, canales, roles y filtros.' : data.permissions.moderate ? 'Puedes consultar y administrar casos.' : 'Puedes consultar únicamente tus propios casos.'}</p></article>
    </div>`;
}

// Vista de solo lectura con TODA la configuración del servidor, resolviendo
// los IDs a nombres. Sirve para revisar de un vistazo qué tiene puesto cada
// Main sin abrir la base de datos.
function nameOf(collection, id, empty = 'Sin configurar') {
  if (!id) return empty;
  const found = (collection || []).find(item => String(item.id) === String(id));
  return found ? (found.parent ? `${found.parent} / ${found.name}` : found.name) : `ID ${id} (no encontrado)`;
}

function namesOf(collection, ids, empty = 'Ninguno') {
  const list = (ids || []).map(id => nameOf(collection, id, null)).filter(Boolean);
  return list.length ? list.join(', ') : empty;
}

function definitionRows(rows) {
  return rows.map(([label, value]) => `
    <div class="definition-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('');
}

function renderConfigOverview(config, data) {
  const channels = data.channels || [];
  const roles = data.roles || [];
  const categories = data.categories || [];
  const voice = data.voiceChannels || [];
  const yesNo = value => (value ? 'Sí' : 'No');
  const embedSummary = kind => {
    const saved = config.embeds?.[kind] || {};
    const custom = ['title', 'message', 'footer', 'image', 'color'].filter(field => saved[field]);
    return custom.length ? `Personalizado (${custom.join(', ')})` : 'Diseño original del servidor';
  };

  const blocks = [
    ['Canales', [
      ['Bienvenida', nameOf(channels, config.general?.welcomeChannel)],
      ['Despedida', nameOf(channels, config.general?.goodbyeChannel)],
      ['Registro general', nameOf(channels, config.general?.logChannel)],
      ['Registro de bots', nameOf(channels, config.general?.botLogChannel)],
      ['Rol automático de bots', nameOf(roles, config.general?.botRole, 'Sin rol')]
    ]],
    ['Redes sociales', [
      ['TikTok · directos', nameOf(channels, config.tiktok?.liveChannel)],
      ['TikTok · videos', nameOf(channels, config.tiktok?.videoChannel)],
      ['TikTok · cuentas', (config.tiktok?.users || []).join(', ') || 'Ninguna'],
      ['TikTok · rol de aviso', nameOf(roles, config.tiktok?.pingRole, 'Sin mención')],
      ['Twitch · directos', nameOf(channels, config.twitch?.liveChannel)],
      ['Twitch · cuentas', (config.twitch?.users || []).join(', ') || 'Ninguna'],
      ['Twitch · rol de aviso', nameOf(roles, config.twitch?.pingRole, 'Sin mención')],
      ['YouTube · directos', nameOf(channels, config.youtube?.liveChannel)],
      ['YouTube · videos', nameOf(channels, config.youtube?.videoChannel)],
      ['YouTube · Shorts', nameOf(channels, config.youtube?.shortChannel)],
      ['YouTube · canales', (config.youtube?.users || []).join(', ') || 'Ninguno'],
      ['YouTube · rol de aviso', nameOf(roles, config.youtube?.pingRole, 'Sin mención')]
    ]],
    ['Embeds', [
      ['Bienvenida', embedSummary('welcome')],
      ['Despedida', embedSummary('goodbye')],
      ['Formato', data.embedDefaults?.layout === 'components_v2' ? 'Components V2 (diseño propio)' : 'Embed clásico']
    ]],
    ['Identidad', [
      ['Nombre visible', config.profile?.displayName || 'El del bot'],
      ['Tema', config.profile?.theme || 'neutral'],
      ['Color principal', config.profile?.primaryColor || '—'],
      ['Color secundario', config.profile?.secondaryColor || '—'],
      ['Rol automático de miembros', nameOf(roles, config.profile?.memberRole, 'Sin rol')]
    ]],
    ['Permisos', [
      ['Gestores de redes', namesOf(roles, config.permissions?.socialManagerRoles)],
      ['Moderadores', namesOf(roles, config.permissions?.moderatorRoles)],
      ['DJ de música', namesOf(roles, config.permissions?.musicDjRoles)]
    ]],
    ['Moderación automática', [
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
      ['Volumen por defecto', config.music?.defaultVolume ?? 50],
      ['Cola máxima', config.music?.maxQueue ?? 100],
      ['Canciones por usuario', config.music?.maxPerUser ?? 3],
      ['Minutos por pista', config.music?.maxTrackMinutes ?? 15],
      ['Inactividad (s)', config.music?.idleSeconds ?? 180]
    ]],
    ['Comunidad', [
      ['Panel de tickets', nameOf(channels, config.community?.tickets?.panelChannel)],
      ['Categoría de tickets', nameOf(categories, config.community?.tickets?.category, 'Sin categoría')],
      ['Transcripciones', nameOf(channels, config.community?.tickets?.transcriptChannel)],
      ['Roles de soporte', namesOf(roles, config.community?.tickets?.staffRoles)],
      ['Tickets por usuario', config.community?.tickets?.maxOpenPerUser ?? 1],
      ['Canal de sugerencias', nameOf(channels, config.community?.suggestions?.channel)],
      ['Panel de autorroles', nameOf(channels, config.community?.selfRoles?.panelChannel)],
      ['Autorroles', namesOf(roles, (config.community?.selfRoles?.roles || []).map(item => item.roleId))],
      ['Canal de destacados', nameOf(channels, config.community?.starboard?.channel)],
      ['Reacciones necesarias', config.community?.starboard?.threshold ?? 3],
      ['Emoji de destacados', config.community?.starboard?.emoji || '⭐']
    ]]
  ];

  const modules = Object.entries(config.features || {})
    .map(([key, value]) => `<span class="badge ${value ? 'approved' : 'rejected'}">${escapeHtml(moduleLabel(key))}: ${value ? 'activo' : 'apagado'}</span>`)
    .join(' ');

  return `
    <article class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">RESUMEN</p>
          <h2>Configuración actual de ${escapeHtml(data.guild.name)}</h2>
          <p>Todo lo que Vesper tiene guardado para este servidor, con los nombres ya resueltos.</p>
        </div>
        <button id="copy-config" class="button ghost small" type="button">Copiar como JSON</button>
      </div>
      <div class="chip-list spaced">${modules}</div>
      <div class="definition-grid">
        ${blocks.map(([title, rows]) => `
          <section class="definition-block">
            <h3>${escapeHtml(title)}</h3>
            <dl>${definitionRows(rows)}</dl>
          </section>`).join('')}
      </div>
    </article>`;
}

function renderConfig() {
  const root = $('#tab-config');
  const data = state.overview;
  if (!data.permissions.configure || !data.config) {
    root.innerHTML = '<article class="panel"><h2>Configuración restringida</h2><p>Necesitas ser propietario o tener Administrar servidor.</p></article>';
    return;
  }
  const config = data.config;
  const themedMain = data.guild.tier === 'themed_main';
  const primaryMain = data.guild.tier === 'primary_main';
  const anyMain = themedMain || primaryMain;
  const channelFields = [
    ['general','welcomeChannel','Canal de bienvenida'], ['general','goodbyeChannel','Canal de despedida'],
    ['general','logChannel','Registro general'], ['general','botLogChannel','Registro de bots'],
    ['tiktok','liveChannel','TikTok · directos'], ['tiktok','videoChannel','TikTok · videos'],
    ['twitch','liveChannel','Twitch · directos'], ['youtube','liveChannel','YouTube · directos'],
    ['youtube','videoChannel','YouTube · videos'], ['youtube','shortChannel','YouTube · Shorts'],
    ['music','requestChannel','Solicitudes de música']
  ];
  const profileTitle = themedMain
    ? `Identidad de ${escapeHtml(config.profile?.displayName || 'AnkeBot')} en ${escapeHtml(data.guild.name)}`
    : `Identidad de Vesper en ${escapeHtml(data.guild.name)}`;
  const profilePanel = anyMain ? `
    <article class="panel profile-panel">
      <div class="panel-header"><div><p class="eyebrow">IDENTIDAD DEL BOT</p><h2>${profileTitle}</h2><p>Estos valores solo afectan a este servidor. Cada Main mantiene su propia identidad.</p></div></div>
      <form id="profile-form" class="form-grid">
        <div class="field"><label for="profile-name">Nombre visible</label><input id="profile-name" maxlength="80" value="${escapeHtml(config.profile?.displayName || '')}" placeholder="${escapeHtml(themedMain ? 'AnkeBot' : 'Vesper')}"></div>
        <div class="field"><label for="profile-theme">Tema</label><select id="profile-theme">${(primaryMain ? [['void', 'Void · morado profundo']] : [['cinnamoroll', 'Cinnamoroll · nubes pastel']]).concat([['custom', 'Personalizado']]).map(([value, label]) => `<option value="${value}" ${config.profile?.theme === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
        <div class="field full"><label for="profile-avatar">Avatar de webhooks</label><input id="profile-avatar" type="url" maxlength="500" placeholder="https://..." value="${escapeHtml(config.profile?.avatar || '')}"><small>El avatar de la cuenta Discord es global; este sí puede cambiar por servidor.</small></div>
        <div class="field"><label for="profile-primary">Color principal</label><input id="profile-primary" type="color" value="${escapeHtml(config.profile?.primaryColor || (primaryMain ? '#9D63FF' : '#8DDCF4'))}"></div>
        <div class="field"><label for="profile-secondary">Color secundario</label><input id="profile-secondary" type="color" value="${escapeHtml(config.profile?.secondaryColor || (primaryMain ? '#100C18' : '#F8C8DC'))}"></div>
        <div class="field full"><label for="profile-member-role">Rol temático automático para miembros</label><select id="profile-member-role">${selectOptions(data.assignableRoles || [], config.profile?.memberRole, 'Sin rol automático')}</select></div>
        <div class="field full"><div class="notice">Los textos y colores de los embeds de bienvenida y despedida se editan más abajo, en «Bienvenida y despedida», con vista previa.</div></div>
        <div class="form-actions"><button class="button" type="submit">Guardar identidad</button></div>
      </form>
    </article>` : '';
  root.innerHTML = `
    ${profilePanel}
    ${renderEmbedsSection(config, data.embedDefaults)}
    <article class="panel">
      <div class="panel-header"><div><p class="eyebrow">MÓDULOS</p><h2>Funciones activas</h2></div></div>
      <form id="features-form" class="check-grid">
        ${Object.entries(config.features || {}).map(([key,value]) => `<label class="check-card"><input type="checkbox" name="${escapeHtml(key)}" ${value ? 'checked' : ''}><span><strong>${escapeHtml(moduleLabel(key))}</strong><small>${escapeHtml(MODULE_HINTS[key] || '')}</small></span></label>`).join('')}
        <div class="form-actions"><button class="button" type="submit">Guardar módulos</button></div>
      </form>
    </article>
    <article class="panel">
      <div class="panel-header"><div><p class="eyebrow">CANALES</p><h2>Portales y notificaciones</h2></div></div>
      <form id="channels-form" class="form-grid">
        ${channelFields.map(([section,field,label]) => `<div class="field"><label for="channel-${section}-${field}">${escapeHtml(label)}</label><select id="channel-${section}-${field}" data-section="${section}" data-field="${field}">${selectOptions(data.channels, config[section]?.[field])}</select></div>`).join('')}
        <div class="field"><label for="music-voice-channel">Canal de voz preferido</label><select id="music-voice-channel" data-section="music" data-field="preferredVoiceChannel">${selectOptions(data.voiceChannels || [], config.music?.preferredVoiceChannel, 'Cualquier canal de voz')}</select></div>
        <div class="field"><label for="bot-role">Rol automático de bots</label><select id="bot-role">${selectOptions(data.assignableRoles || [], config.general?.botRole, 'Sin rol')}</select></div>
        <div class="field"><label for="tiktok-ping-role">Rol de avisos TikTok</label><select id="tiktok-ping-role" data-section="tiktok" data-field="pingRole">${selectOptions(data.roles, config.tiktok?.pingRole, 'Sin mención')}</select></div>
        <div class="field"><label for="twitch-ping-role">Rol de avisos Twitch</label><select id="twitch-ping-role" data-section="twitch" data-field="pingRole">${selectOptions(data.roles, config.twitch?.pingRole, 'Sin mención')}</select></div>
        <div class="field"><label for="youtube-ping-role">Rol de avisos YouTube</label><select id="youtube-ping-role" data-section="youtube" data-field="pingRole">${selectOptions(data.roles, config.youtube?.pingRole, 'Sin mención')}</select></div>
        <div class="form-actions"><button class="button" type="submit">Guardar canales</button></div>
      </form>
    </article>
    <article class="panel">
      <div class="panel-header"><div><p class="eyebrow">REDES SOCIALES</p><h2>Cuentas monitoreadas</h2><p>Añade y elimina cuentas aquí; el panel verifica cada nueva cuenta antes de guardarla.</p></div></div>
      <div class="social-grid">
        ${[['tiktok','TikTok','@usuario'],['twitch','Twitch','streamer'],['youtube','YouTube','URL, @handle o nombre']].map(([platform,label,placeholder]) => `
          <section class="social-card">
            <h3>${label}</h3>
            <form class="social-add-form" data-platform="${platform}"><input name="account" maxlength="200" placeholder="${placeholder}" required><button class="button small" type="submit">Añadir</button></form>
            <div class="chip-list">${(config[platform]?.users || []).length ? (config[platform].users).map(account => `<span class="account-chip"><span>${escapeHtml(account)}</span><button type="button" data-social-remove="${platform}" data-account="${escapeHtml(account)}" aria-label="Eliminar ${escapeHtml(account)}">×</button></span>`).join('') : '<span class="muted-copy">Sin cuentas configuradas</span>'}</div>
          </section>`).join('')}
      </div>
    </article>
    <div class="two-columns">
      <article class="panel">
        <div class="panel-header"><div><p class="eyebrow">CAPACIDADES</p><h2>Roles autorizados</h2></div></div>
        <form id="permissions-form" class="form-grid">
          <div class="field full"><label for="roles-social">Gestores de redes</label><select id="roles-social" multiple>${multiOptions(data.roles, config.permissions?.socialManagerRoles)}</select></div>
          <div class="field full"><label for="roles-moderator">Moderadores</label><select id="roles-moderator" multiple>${multiOptions(data.roles, config.permissions?.moderatorRoles)}</select></div>
          <div class="field full"><label for="roles-dj">DJ de música</label><select id="roles-dj" multiple>${multiOptions(data.roles, config.permissions?.musicDjRoles)}</select><small>Usa Ctrl o Cmd para elegir varios roles.</small></div>
          <div class="form-actions"><button class="button" type="submit">Guardar roles</button></div>
        </form>
      </article>
      <article class="panel">
        <div class="panel-header"><div><p class="eyebrow">MÚSICA</p><h2>Límites de reproducción</h2></div></div>
        <form id="music-form" class="form-grid">
          ${[['defaultVolume','Volumen',1,100],['maxQueue','Cola máxima',1,500],['maxPerUser','Por usuario',1,25],['maxTrackMinutes','Minutos por pista',1,180],['idleSeconds','Inactividad (s)',30,3600]].map(([field,label,min,max]) => `<div class="field"><label for="music-${field}">${label}</label><input id="music-${field}" name="${field}" type="number" min="${min}" max="${max}" value="${Number(config.music?.[field] ?? 0) || min}"></div>`).join('')}
          <div class="form-actions"><button class="button" type="submit">Guardar música</button></div>
        </form>
      </article>
    </div>
    <article class="panel">
      <div class="panel-header"><div><p class="eyebrow">AUTOMOD</p><h2>Filtros y exclusiones</h2></div></div>
      <form id="moderation-config-form" class="form-grid">
        <label class="check-card"><input id="filter-links" type="checkbox" ${config.moderation?.filterLinks ? 'checked' : ''}><span>Filtrar enlaces</span></label>
        <label class="check-card"><input id="block-invites" type="checkbox" ${config.moderation?.blockInvites ? 'checked' : ''}><span>Bloquear invitaciones</span></label>
        <div class="field"><label for="max-mentions">Máximo de menciones</label><input id="max-mentions" type="number" min="1" max="25" value="${Number(config.moderation?.maxMentions ?? 5)}"></div>
        <div class="field"><label for="repeat-limit">Repeticiones permitidas</label><input id="repeat-limit" type="number" min="2" max="15" value="${Number(config.moderation?.repeatLimit ?? 4)}"></div>
        <div class="field"><label for="automod-action">Acción automática</label><select id="automod-action">${[['delete','Eliminar'],['warn','Advertir'],['timeout','Aislar 5 minutos']].map(([value,label]) => `<option value="${value}" ${config.moderation?.action === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
        <div class="field"><label for="allowed-domains">Dominios permitidos</label><textarea id="allowed-domains" placeholder="youtube.com&#10;twitch.tv">${escapeHtml((config.moderation?.allowedDomains || []).join('\n'))}</textarea><small>Uno por línea, sin rutas.</small></div>
        <div class="field"><label for="exempt-channels">Canales excluidos</label><select id="exempt-channels" multiple>${multiOptions(data.channels, config.moderation?.exemptChannels)}</select></div>
        <div class="field"><label for="exempt-roles">Roles excluidos</label><select id="exempt-roles" multiple>${multiOptions(data.roles, config.moderation?.exemptRoles)}</select></div>
        <div class="form-actions"><button class="button" type="submit">Guardar moderación</button></div>
      </form>
    </article>
    <article class="panel">
      <div class="panel-header"><div><p class="eyebrow">COMUNIDAD</p><h2>Tickets, sugerencias y destacados</h2></div></div>
      <form id="community-form" class="form-grid">
        <div class="field"><label for="ticket-panel">Panel de tickets</label><select id="ticket-panel">${selectOptions(data.channels, config.community?.tickets?.panelChannel)}</select></div>
        <div class="field"><label for="ticket-category">Categoría de tickets</label><select id="ticket-category">${selectOptions(data.categories || [], config.community?.tickets?.category, 'Sin categoría')}</select></div>
        <div class="field"><label for="ticket-transcripts">Transcripciones</label><select id="ticket-transcripts">${selectOptions(data.channels, config.community?.tickets?.transcriptChannel)}</select></div>
        <div class="field"><label for="ticket-staff">Roles de soporte</label><select id="ticket-staff" multiple>${multiOptions(data.roles, config.community?.tickets?.staffRoles)}</select></div>
        <div class="field"><label for="ticket-limit">Tickets abiertos por usuario</label><input id="ticket-limit" type="number" min="1" max="5" value="${Number(config.community?.tickets?.maxOpenPerUser || 1)}"></div>
        <div class="field"><label for="suggestions-channel">Canal de sugerencias</label><select id="suggestions-channel">${selectOptions(data.channels, config.community?.suggestions?.channel)}</select></div>
        <div class="field"><label for="selfroles-channel">Panel de autorroles</label><select id="selfroles-channel">${selectOptions(data.channels, config.community?.selfRoles?.panelChannel)}</select></div>
        <div class="field"><label for="selfroles-roles">Roles disponibles</label><select id="selfroles-roles" multiple>${multiOptions(data.assignableRoles || [], (config.community?.selfRoles?.roles || []).map(item => item.roleId))}</select><small>Usa Ctrl o Cmd para elegir varios.</small></div>
        <div class="field"><label for="starboard-channel">Canal de destacados</label><select id="starboard-channel">${selectOptions(data.channels, config.community?.starboard?.channel)}</select></div>
        <div class="field"><label for="starboard-threshold">Reacciones necesarias</label><input id="starboard-threshold" type="number" min="2" max="50" value="${Number(config.community?.starboard?.threshold || 3)}"></div>
        <div class="field"><label for="starboard-emoji">Emoji del starboard</label><input id="starboard-emoji" maxlength="100" value="${escapeHtml(config.community?.starboard?.emoji || '⭐')}"></div>
        <div class="field"><label for="starboard-ignored">Canales ignorados</label><select id="starboard-ignored" multiple>${multiOptions(data.channels, config.community?.starboard?.ignoredChannels)}</select></div>
        <div class="form-actions">
          <button class="button" type="submit">Guardar comunidad</button>
          <button id="publish-ticket-panel" class="button secondary" type="button">Guardar y publicar tickets</button>
          <button id="publish-selfroles-panel" class="button secondary" type="button">Guardar y publicar autorroles</button>
        </div>
      </form>
      <div class="panel-header section-gap"><div><p class="eyebrow">REVISIÓN</p><h3>Sugerencias recientes</h3><p>Aprueba, rechaza o devuelve a pendiente sin copiar el ID del mensaje.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Sugerencia</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>${(data.suggestions || []).length ? data.suggestions.map(item => `
        <tr>
          <td>${escapeHtml(item.userId)}</td>
          <td class="case-reason">${escapeHtml(item.text)}${item.reviewNote ? `<small class="review-note">Nota: ${escapeHtml(item.reviewNote)}</small>` : ''}</td>
          <td><span class="badge ${escapeHtml(item.status)}">${escapeHtml(suggestionStatusLabel(item.status))}</span></td>
          <td>${escapeHtml(formatDate(item.createdAt))}</td>
          <td><div class="case-actions">
            <button class="button ghost small suggestion-status" data-suggestion="${escapeHtml(item.messageId)}" data-status="open" type="button" ${item.status === 'open' ? 'disabled' : ''}>Pendiente</button>
            <button class="button secondary small suggestion-status" data-suggestion="${escapeHtml(item.messageId)}" data-status="approved" type="button" ${item.status === 'approved' ? 'disabled' : ''}>Aprobar</button>
            <button class="button danger small suggestion-status" data-suggestion="${escapeHtml(item.messageId)}" data-status="rejected" type="button" ${item.status === 'rejected' ? 'disabled' : ''}>Rechazar</button>
          </div></td>
        </tr>`).join('') : '<tr><td colspan="5">Todavía no hay sugerencias.</td></tr>'}</tbody></table></div>
    </article>
    ${renderConfigOverview(config, data)}`;
  bindConfigForms();
}

async function saveConfig(body, success, submitter = null) {
  // document.activeElement puede haber cambiado tras el await (o no ser el
  // botón si se envía con Enter), así que el que envía se pasa explícitamente.
  const button = submitter && submitter.tagName === 'BUTTON'
    ? submitter
    : (document.activeElement?.tagName === 'BUTTON' ? document.activeElement : null);
  if (button) button.disabled = true;
  try {
    const result = await api(`/guilds/${state.selectedGuildId}/config`, { method: 'PATCH', body: JSON.stringify(body) });
    state.overview.config = result.config;
    state.overview.setup = result.setup;
    renderAll();
    toast(result.warning || success, Boolean(result.warning));
    return result;
  } catch (error) {
    toast(error.message, true);
    return null;
  }
  finally { if (button) button.disabled = false; }
}

function communityConfigBody() {
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

async function publishCommunityPanel(kind, button) {
  button.disabled = true;
  try {
    const saved = await saveConfig(communityConfigBody(), 'Configuración de comunidad guardada.');
    if (!saved) return;
    await api(`/guilds/${state.selectedGuildId}/community/publish`, { method: 'POST', body: JSON.stringify({ kind }) });
    await selectGuild(state.selectedGuildId);
    toast(kind === 'tickets' ? 'Panel de tickets publicado.' : 'Panel de autorroles publicado.');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

function bindConfigForms() {
  bindEmbedEditor();
  $('#copy-config')?.addEventListener('click', async event => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(state.overview.config, null, 2));
      toast('Configuración copiada al portapapeles.');
    } catch {
      // Sin permiso de portapapeles: se ofrece el JSON en una ventana nueva.
      const view = window.open('', '_blank');
      if (!view) return toast('Tu navegador bloqueó la copia y la ventana emergente.', true);
      view.document.title = 'Configuración de Vesper';
      const pre = view.document.createElement('pre');
      pre.textContent = JSON.stringify(state.overview.config, null, 2);
      view.document.body.appendChild(pre);
    }
  });
  $('#profile-form')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ profile: {
      theme: $('#profile-theme').value,
      displayName: $('#profile-name').value,
      avatar: $('#profile-avatar').value || null,
      primaryColor: $('#profile-primary').value,
      secondaryColor: $('#profile-secondary').value,
      memberRole: $('#profile-member-role').value || null
    } }, 'Identidad del bot actualizada.', event.submitter);
  });
  $('#features-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const features = Object.fromEntries([...event.currentTarget.elements].filter(item => item.type === 'checkbox').map(item => [item.name, item.checked]));
    saveConfig({ features }, 'Módulos actualizados.', event.submitter);
  });
  $('#channels-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const body = { general: { botRole: $('#bot-role').value || null } };
    event.currentTarget.querySelectorAll('select[data-section]').forEach(select => {
      body[select.dataset.section] ||= {};
      body[select.dataset.section][select.dataset.field] = select.value || null;
    });
    saveConfig(body, 'Canales actualizados.', event.submitter);
  });
  $('#permissions-form')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ permissions: {
      socialManagerRoles: selectedValues($('#roles-social')),
      moderatorRoles: selectedValues($('#roles-moderator')),
      musicDjRoles: selectedValues($('#roles-dj'))
    } }, 'Roles autorizados actualizados.', event.submitter);
  });
  $('#music-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const music = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key,value]) => [key, Number(value)]));
    saveConfig({ music }, 'Límites de música actualizados.', event.submitter);
  });
  $('#moderation-config-form')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ moderation: {
      filterLinks: $('#filter-links').checked,
      blockInvites: $('#block-invites').checked,
      maxMentions: Number($('#max-mentions').value),
      repeatLimit: Number($('#repeat-limit').value),
      action: $('#automod-action').value,
      allowedDomains: $('#allowed-domains').value.split(/\n|,/).map(value => value.trim()).filter(Boolean),
      exemptChannels: selectedValues($('#exempt-channels')),
      exemptRoles: selectedValues($('#exempt-roles'))
    } }, 'Moderación automática actualizada.', event.submitter);
  });
  $('#community-form')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig(communityConfigBody(), 'Configuración de comunidad actualizada.', event.submitter);
  });
  $('#publish-ticket-panel')?.addEventListener('click', event => publishCommunityPanel('tickets', event.currentTarget));
  $('#publish-selfroles-panel')?.addEventListener('click', event => publishCommunityPanel('selfroles', event.currentTarget));
  $$('.suggestion-status').forEach(button => button.addEventListener('click', async () => {
    const labels = { open: 'devolver a pendiente', approved: 'aprobar', rejected: 'rechazar' };
    if (!confirm(`¿Deseas ${labels[button.dataset.status]} esta sugerencia?`)) return;
    const note = prompt('Nota opcional para la revisión') || '';
    button.disabled = true;
    try {
      await api(`/guilds/${state.selectedGuildId}/suggestions/${button.dataset.suggestion}`, {
        method: 'PATCH', body: JSON.stringify({ status: button.dataset.status, note })
      });
      await selectGuild(state.selectedGuildId);
      toast('Sugerencia actualizada.');
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  }));
  $$('.social-add-form').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    const account = new FormData(form).get('account');
    button.disabled = true;
    try {
      await api(`/guilds/${state.selectedGuildId}/social/${form.dataset.platform}`, { method: 'POST', body: JSON.stringify({ account }) });
      await selectGuild(state.selectedGuildId);
      toast('Cuenta verificada y añadida.');
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  }));
  $$('[data-social-remove]').forEach(button => button.addEventListener('click', async () => {
    if (!confirm(`¿Dejar de monitorear ${button.dataset.account}?`)) return;
    button.disabled = true;
    try {
      await api(`/guilds/${state.selectedGuildId}/social/${button.dataset.socialRemove}/${encodeURIComponent(button.dataset.account)}`, { method: 'DELETE' });
      await selectGuild(state.selectedGuildId);
      toast('Cuenta eliminada del monitoreo.');
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  }));
}

function caseRows() {
  const canModerate = state.overview.permissions.moderate;
  if (!state.overview.cases.length) return '<tr><td colspan="7">No hay casos para mostrar.</td></tr>';
  return state.overview.cases.map(item => `
    <tr>
      <td><strong>#${escapeHtml(item.id)}</strong></td>
      <td>${escapeHtml(item.userId)}</td>
      <td>${escapeHtml(actionLabel(item.action))}</td>
      <td><span class="badge ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span></td>
      <td class="case-reason">${escapeHtml(item.reason)}</td>
      <td>${escapeHtml(formatDate(item.createdAt))}</td>
      <td>${canModerate ? `<div class="case-actions">
        <button class="button ghost small case-note" data-case="${item.id}" type="button">Nota</button>
        ${item.status === 'active' ? `<button class="button secondary small case-status" data-case="${item.id}" data-status="resolved" type="button">Resolver</button>` : `<button class="button secondary small case-status" data-case="${item.id}" data-status="active" type="button">Reabrir</button>`}
        ${item.status !== 'revoked' ? `<button class="button danger small case-status" data-case="${item.id}" data-status="revoked" type="button">Revocar</button>` : ''}
      </div>` : '—'}</td>
    </tr>`).join('');
}

function renderModeration() {
  const data = state.overview;
  const createForm = data.permissions.moderate ? `
    <article class="panel">
      <div class="panel-header"><div><p class="eyebrow">NUEVO CASO</p><h2>Aplicar una acción</h2></div></div>
      ${!data.modules.moderation ? '<div class="notice danger">El módulo de moderación está desactivado. Un administrador debe activarlo antes de crear casos.</div>' : ''}
      <form id="case-form" class="form-grid">
        <div class="field full"><label for="case-member-search">Buscar miembro</label><input id="case-member-search" autocomplete="off" placeholder="Escribe su nombre de Discord"><small id="case-member-status">Escribe al menos dos caracteres.</small></div>
        <div class="field"><label for="case-user">Miembro seleccionado</label><select id="case-user" name="userId" required><option value="">Busca y selecciona un miembro</option></select></div>
        <div class="field"><label for="case-action">Acción</label><select id="case-action" name="action"><option value="warning">Advertencia</option><option value="timeout">Aislamiento</option></select></div>
        <div id="minutes-field" class="field" hidden><label for="case-minutes">Duración en minutos</label><input id="case-minutes" name="minutes" type="number" min="1" max="40320" value="10"></div>
        <div class="field full"><label for="case-reason">Motivo</label><textarea id="case-reason" name="reason" maxlength="1000" required></textarea></div>
        <div class="form-actions"><button class="button" type="submit" ${!data.modules.moderation ? 'disabled' : ''}>Registrar acción</button></div>
      </form>
    </article>` : `
    <article class="panel"><p class="eyebrow">MI HISTORIAL</p><h2>Casos asociados a tu cuenta</h2><p>Esta vista es privada. Otros miembros no pueden ver tus registros.</p></article>`;
  $('#tab-moderation').innerHTML = `${createForm}
    <article class="panel">
      <div class="panel-header"><div><p class="eyebrow">REGISTRO</p><h2>${data.permissions.moderate ? 'Casos recientes' : 'Mis casos'}</h2></div><button id="reload-cases" class="button ghost small" type="button">Recargar</button></div>
      <div class="table-wrap"><table><thead><tr><th>Caso</th><th>Usuario</th><th>Acción</th><th>Estado</th><th>Motivo</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>${caseRows()}</tbody></table></div>
    </article>`;
  bindModeration();
}

async function reloadCases() {
  try {
    const result = await api(`/guilds/${state.selectedGuildId}/cases`);
    state.overview.cases = result.cases;
    renderSummary();
    renderModeration();
  } catch (error) { toast(error.message, true); }
}

function bindModeration() {
  $('#case-action')?.addEventListener('change', event => { $('#minutes-field').hidden = event.target.value !== 'timeout'; });
  let memberSearchTimer = null;
  $('#case-member-search')?.addEventListener('input', event => {
    clearTimeout(memberSearchTimer);
    const query = event.target.value.trim();
    const status = $('#case-member-status');
    if (query.length < 2) {
      $('#case-user').innerHTML = '<option value="">Busca y selecciona un miembro</option>';
      status.textContent = 'Escribe al menos dos caracteres.';
      return;
    }
    status.textContent = 'Buscando en Discord…';
    memberSearchTimer = setTimeout(async () => {
      try {
        const result = await api(`/guilds/${state.selectedGuildId}/members?q=${encodeURIComponent(query)}`);
        $('#case-user').innerHTML = `<option value="">Selecciona un miembro</option>${result.members.map(member => `<option value="${member.id}">${escapeHtml(member.displayName)} · @${escapeHtml(member.username)}</option>`).join('')}`;
        status.textContent = result.members.length ? `${result.members.length} resultado(s).` : 'No se encontraron miembros.';
      } catch (error) { status.textContent = error.message; }
    }, 350);
  });
  $('#case-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const body = { ...values, minutes: Number(values.minutes || 0) };
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api(`/guilds/${state.selectedGuildId}/cases`, { method: 'POST', body: JSON.stringify(body) });
      event.currentTarget.reset();
      $('#minutes-field').hidden = true;
      await reloadCases();
      toast('Caso registrado correctamente.');
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  });
  $('#reload-cases')?.addEventListener('click', reloadCases);
  $$('.case-note').forEach(button => button.addEventListener('click', async () => {
    const note = prompt(`Nota interna para el caso #${button.dataset.case}`);
    if (!note?.trim()) return;
    await updateCase(button.dataset.case, { note: note.trim() });
  }));
  $$('.case-status').forEach(button => button.addEventListener('click', async () => {
    const labels = { active: 'reabrir', resolved: 'resolver', revoked: 'revocar' };
    if (!confirm(`¿Deseas ${labels[button.dataset.status]} el caso #${button.dataset.case}?`)) return;
    const note = prompt('Nota opcional para esta acción') || '';
    await updateCase(button.dataset.case, { status: button.dataset.status, note });
  }));
}

async function updateCase(caseId, body) {
  try {
    await api(`/guilds/${state.selectedGuildId}/cases/${caseId}`, { method: 'PATCH', body: JSON.stringify(body) });
    await reloadCases();
    toast(`Caso #${caseId} actualizado.`);
  } catch (error) { toast(error.message, true); }
}

async function renderAudit() {
  const root = $('#tab-audit');
  if (!state.overview.permissions.configure) {
    root.innerHTML = '<article class="panel"><h2>Auditoría restringida</h2><p>Solo los administradores del servidor pueden consultarla.</p></article>';
    return;
  }
  root.innerHTML = '<article class="panel"><p>Cargando auditoría…</p></article>';
  try {
    const result = await api(`/guilds/${state.selectedGuildId}/audit`);
    const rows = result.audit.length ? result.audit.map(item => `<tr><td>${escapeHtml(formatDate(item.createdAt))}</td><td>${escapeHtml(item.actorDiscordId || item.actorGoogleEmail || 'Desconocido')}</td><td>${escapeHtml(item.action)}</td><td>${escapeHtml(item.target || '—')}</td><td>${escapeHtml((item.metadata?.fields || []).join(', ') || '—')}</td></tr>`).join('') : '<tr><td colspan="5">Todavía no hay acciones web.</td></tr>';
    root.innerHTML = `<article class="panel"><div class="panel-header"><div><p class="eyebrow">TRAZABILIDAD</p><h2>Acciones realizadas desde el panel</h2></div></div><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Responsable</th><th>Acción</th><th>Objetivo</th><th>Campos</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
  } catch (error) { root.innerHTML = `<article class="panel"><div class="notice danger">${escapeHtml(error.message)}</div></article>`; }
}

function tabAllowed(name) {
  if (name === 'config' || name === 'audit') return state.overview?.permissions.configure;
  return true;
}

function showTab(name) {
  if (!tabAllowed(name)) name = 'overview';
  state.activeTab = name;
  $$('.tab').forEach(tab => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $$('.tab-panel').forEach(panel => { panel.hidden = panel.id !== `tab-${name}`; });
  if (name === 'audit') renderAudit();
}

function renderAll() {
  applyGuildTheme();
  renderGuildList();
  renderSummary();
  renderOverview();
  renderConfig();
  renderModeration();
  $$('.tab[data-tab="config"], .tab[data-tab="audit"]').forEach(tab => { tab.hidden = !state.overview.permissions.configure; });
  showTab(state.activeTab);
}

async function selectGuild(guildId) {
  state.selectedGuildId = guildId;
  renderGuildList();
  $('#empty-state').hidden = true;
  $('#guild-view').hidden = false;
  $('#page-title').textContent = 'Cargando…';
  try {
    state.overview = await api(`/guilds/${guildId}`);
    $('#page-title').textContent = state.overview.guild.name;
    renderAll();
  } catch (error) {
    $('#guild-view').hidden = true;
    $('#empty-state').hidden = false;
    toast(error.message, true);
  }
}

async function refreshStatus() {
  try {
    const health = await api('/status');
    const pill = $('#connection-pill');
    const ready = health.ready ?? health.healthy;
    const paused = (health.monitors || []).filter(monitor => monitor.disabledUntil).map(monitor => monitor.name);
    pill.textContent = ready
      ? 'Vesper operativo'
      : !health.botReady ? 'Bot desconectado'
      : !health.database?.connected ? 'Base de datos caída'
      : paused.length ? `Monitor en pausa: ${paused.join(', ')}`
      : 'Estado degradado';
    pill.className = `pill ${ready ? 'good' : 'warn'}`;
    pill.title = pill.textContent;
  } catch {
    $('#connection-pill').textContent = 'Sin conexión';
    $('#connection-pill').className = 'pill warn';
  }
}

async function boot() {
  try {
    const response = await fetch('/api/web/public', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`El servidor respondió ${response.status}`);
    state.publicConfig = await response.json();
  } catch (error) {
    // Sin esta distinción, un fallo de red se mostraba como «el panel no está
    // habilitado», que es un mensaje falso y manda a revisar lo que no es.
    state.publicConfig = null;
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
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  renderIdentity();
  await refreshStatus();
  try {
    const result = await api('/guilds');
    state.guilds = result.guilds;
    renderGuildList();
    if (state.guilds.length) await selectGuild(state.guilds[0].id);
  } catch (error) { toast(error.message, true); }
}

$$('.tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
$('#refresh-button').addEventListener('click', async () => {
  await refreshStatus();
  if (state.selectedGuildId) await selectGuild(state.selectedGuildId);
});

boot();
