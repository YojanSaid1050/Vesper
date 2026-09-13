const state = {
  publicConfig: null,
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
  if (!state.publicConfig?.enabled) {
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

function statusLabel(status) {
  return { active: 'Activo', resolved: 'Resuelto', revoked: 'Revocado' }[status] || status;
}

function suggestionStatusLabel(status) {
  return { open: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' }[status] || status;
}

function actionLabel(action) {
  return { warning: 'Advertencia', timeout: 'Aislamiento', filter: 'Filtro automático' }[action] || action;
}

function renderSummary() {
  const data = state.overview;
  const activeCases = data.cases.filter(item => item.status === 'active').length;
  const healthy = data.health.healthy;
  $('#summary-grid').innerHTML = `
    <article class="metric"><small>Estado de Vesper</small><strong class="${healthy ? 'good' : 'warn'}">${healthy ? 'Operativo' : 'Requiere atención'}</strong></article>
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

function renderConfig() {
  const root = $('#tab-config');
  const data = state.overview;
  if (!data.permissions.configure || !data.config) {
    root.innerHTML = '<article class="panel"><h2>Configuración restringida</h2><p>Necesitas ser propietario o tener Administrar servidor.</p></article>';
    return;
  }
  const config = data.config;
  const themedMain = data.guild.tier === 'themed_main';
  const channelFields = [
    ['general','welcomeChannel','Canal de bienvenida'], ['general','goodbyeChannel','Canal de despedida'],
    ['general','logChannel','Registro general'], ['general','botLogChannel','Registro de bots'],
    ['tiktok','liveChannel','TikTok · directos'], ['tiktok','videoChannel','TikTok · videos'],
    ['twitch','liveChannel','Twitch · directos'], ['youtube','liveChannel','YouTube · directos'],
    ['youtube','videoChannel','YouTube · videos'], ['youtube','shortChannel','YouTube · Shorts'],
    ['music','requestChannel','Solicitudes de música']
  ];
  const profilePanel = themedMain ? `
    <article class="panel profile-panel">
      <div class="panel-header"><div><p class="eyebrow">IDENTIDAD TEMÁTICA</p><h2>AnkeBot en Ankerie Dimension</h2><p>Estos valores solo afectan este servidor; Embers Void conserva su identidad original.</p></div></div>
      <form id="profile-form" class="form-grid">
        <div class="field"><label for="profile-name">Nombre visible</label><input id="profile-name" maxlength="80" value="${escapeHtml(config.profile?.displayName || 'AnkeBot')}"></div>
        <div class="field"><label for="profile-theme">Tema</label><select id="profile-theme"><option value="cinnamoroll" ${config.profile?.theme === 'cinnamoroll' ? 'selected' : ''}>Cinnamoroll · nubes pastel</option><option value="custom" ${config.profile?.theme === 'custom' ? 'selected' : ''}>Personalizado</option></select></div>
        <div class="field full"><label for="profile-avatar">Avatar de webhooks</label><input id="profile-avatar" type="url" maxlength="500" placeholder="https://..." value="${escapeHtml(config.profile?.avatar || '')}"><small>El avatar de la cuenta Discord es global; este sí puede cambiar por servidor.</small></div>
        <div class="field"><label for="profile-primary">Color principal</label><input id="profile-primary" type="color" value="${escapeHtml(config.profile?.primaryColor || '#8DDCF4')}"></div>
        <div class="field"><label for="profile-secondary">Color secundario</label><input id="profile-secondary" type="color" value="${escapeHtml(config.profile?.secondaryColor || '#F8C8DC')}"></div>
        <div class="field full"><label for="profile-member-role">Rol temático automático para miembros</label><select id="profile-member-role">${selectOptions(data.assignableRoles || [], config.profile?.memberRole, 'Sin rol automático')}</select></div>
        <div class="field"><label for="profile-welcome-title">Título de bienvenida</label><input id="profile-welcome-title" maxlength="120" value="${escapeHtml(config.profile?.welcomeTitle || '')}"></div>
        <div class="field"><label for="profile-goodbye-title">Título de despedida</label><input id="profile-goodbye-title" maxlength="120" value="${escapeHtml(config.profile?.goodbyeTitle || '')}"></div>
        <div class="field"><label for="profile-welcome-message">Mensaje de bienvenida</label><textarea id="profile-welcome-message" maxlength="1500">${escapeHtml(config.profile?.welcomeMessage || '')}</textarea></div>
        <div class="field"><label for="profile-goodbye-message">Mensaje de despedida</label><textarea id="profile-goodbye-message" maxlength="1500">${escapeHtml(config.profile?.goodbyeMessage || '')}</textarea></div>
        <div class="field full"><small>Variables disponibles: {user}, {username} y {server}.</small></div>
        <div class="form-actions"><button class="button" type="submit">Guardar identidad de AnkeBot</button></div>
      </form>
    </article>` : '';
  root.innerHTML = `
    ${profilePanel}
    <article class="panel">
      <div class="panel-header"><div><p class="eyebrow">MÓDULOS</p><h2>Funciones activas</h2></div></div>
      <form id="features-form" class="check-grid">
        ${Object.entries(config.features).map(([key,value]) => `<label class="check-card"><input type="checkbox" name="${escapeHtml(key)}" ${value ? 'checked' : ''}><span>${escapeHtml(key)}</span></label>`).join('')}
        <div class="form-actions"><button class="button" type="submit">Guardar módulos</button></div>
      </form>
    </article>
    <article class="panel">
      <div class="panel-header"><div><p class="eyebrow">CANALES</p><h2>Portales y notificaciones</h2></div></div>
      <form id="channels-form" class="form-grid">
        ${channelFields.map(([section,field,label]) => `<div class="field"><label for="channel-${section}-${field}">${escapeHtml(label)}</label><select id="channel-${section}-${field}" data-section="${section}" data-field="${field}">${selectOptions(data.channels, config[section]?.[field])}</select></div>`).join('')}
        <div class="field"><label for="music-voice-channel">Canal de voz preferido</label><select id="music-voice-channel" data-section="music" data-field="preferredVoiceChannel">${selectOptions(data.voiceChannels || [], config.music?.preferredVoiceChannel, 'Cualquier canal de voz')}</select></div>
        <div class="field"><label for="bot-role">Rol automático de bots</label><select id="bot-role">${selectOptions(data.assignableRoles || [], config.general.botRole, 'Sin rol')}</select></div>
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
          <div class="field full"><label for="roles-social">Gestores de redes</label><select id="roles-social" multiple>${multiOptions(data.roles, config.permissions.socialManagerRoles)}</select></div>
          <div class="field full"><label for="roles-moderator">Moderadores</label><select id="roles-moderator" multiple>${multiOptions(data.roles, config.permissions.moderatorRoles)}</select></div>
          <div class="field full"><label for="roles-dj">DJ de música</label><select id="roles-dj" multiple>${multiOptions(data.roles, config.permissions.musicDjRoles)}</select><small>Usa Ctrl o Cmd para elegir varios roles.</small></div>
          <div class="form-actions"><button class="button" type="submit">Guardar roles</button></div>
        </form>
      </article>
      <article class="panel">
        <div class="panel-header"><div><p class="eyebrow">MÚSICA</p><h2>Límites de reproducción</h2></div></div>
        <form id="music-form" class="form-grid">
          ${[['defaultVolume','Volumen',1,100],['maxQueue','Cola máxima',1,500],['maxPerUser','Por usuario',1,25],['maxTrackMinutes','Minutos por pista',1,180],['idleSeconds','Inactividad (s)',30,3600]].map(([field,label,min,max]) => `<div class="field"><label for="music-${field}">${label}</label><input id="music-${field}" name="${field}" type="number" min="${min}" max="${max}" value="${Number(config.music[field])}"></div>`).join('')}
          <div class="form-actions"><button class="button" type="submit">Guardar música</button></div>
        </form>
      </article>
    </div>
    <article class="panel">
      <div class="panel-header"><div><p class="eyebrow">AUTOMOD</p><h2>Filtros y exclusiones</h2></div></div>
      <form id="moderation-config-form" class="form-grid">
        <label class="check-card"><input id="filter-links" type="checkbox" ${config.moderation.filterLinks ? 'checked' : ''}><span>Filtrar enlaces</span></label>
        <label class="check-card"><input id="block-invites" type="checkbox" ${config.moderation.blockInvites ? 'checked' : ''}><span>Bloquear invitaciones</span></label>
        <div class="field"><label for="max-mentions">Máximo de menciones</label><input id="max-mentions" type="number" min="1" max="25" value="${Number(config.moderation.maxMentions)}"></div>
        <div class="field"><label for="repeat-limit">Repeticiones permitidas</label><input id="repeat-limit" type="number" min="2" max="15" value="${Number(config.moderation.repeatLimit)}"></div>
        <div class="field"><label for="automod-action">Acción automática</label><select id="automod-action">${[['delete','Eliminar'],['warn','Advertir'],['timeout','Aislar 5 minutos']].map(([value,label]) => `<option value="${value}" ${config.moderation.action === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
        <div class="field"><label for="allowed-domains">Dominios permitidos</label><textarea id="allowed-domains" placeholder="youtube.com&#10;twitch.tv">${escapeHtml((config.moderation.allowedDomains || []).join('\n'))}</textarea><small>Uno por línea, sin rutas.</small></div>
        <div class="field"><label for="exempt-channels">Canales excluidos</label><select id="exempt-channels" multiple>${multiOptions(data.channels, config.moderation.exemptChannels)}</select></div>
        <div class="field"><label for="exempt-roles">Roles excluidos</label><select id="exempt-roles" multiple>${multiOptions(data.roles, config.moderation.exemptRoles)}</select></div>
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
    </article>`;
  bindConfigForms();
}

async function saveConfig(body, success) {
  const button = document.activeElement;
  if (button?.tagName === 'BUTTON') button.disabled = true;
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
  finally { if (button?.tagName === 'BUTTON') button.disabled = false; }
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
  $('#profile-form')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ profile: {
      theme: $('#profile-theme').value,
      displayName: $('#profile-name').value,
      avatar: $('#profile-avatar').value || null,
      primaryColor: $('#profile-primary').value,
      secondaryColor: $('#profile-secondary').value,
      memberRole: $('#profile-member-role').value || null,
      welcomeTitle: $('#profile-welcome-title').value || null,
      welcomeMessage: $('#profile-welcome-message').value || null,
      goodbyeTitle: $('#profile-goodbye-title').value || null,
      goodbyeMessage: $('#profile-goodbye-message').value || null
    } }, 'Identidad temática actualizada.');
  });
  $('#features-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const features = Object.fromEntries([...event.currentTarget.elements].filter(item => item.type === 'checkbox').map(item => [item.name, item.checked]));
    saveConfig({ features }, 'Módulos actualizados.');
  });
  $('#channels-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const body = { general: { botRole: $('#bot-role').value || null } };
    event.currentTarget.querySelectorAll('select[data-section]').forEach(select => {
      body[select.dataset.section] ||= {};
      body[select.dataset.section][select.dataset.field] = select.value || null;
    });
    saveConfig(body, 'Canales actualizados.');
  });
  $('#permissions-form')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig({ permissions: {
      socialManagerRoles: selectedValues($('#roles-social')),
      moderatorRoles: selectedValues($('#roles-moderator')),
      musicDjRoles: selectedValues($('#roles-dj'))
    } }, 'Roles autorizados actualizados.');
  });
  $('#music-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const music = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key,value]) => [key, Number(value)]));
    saveConfig({ music }, 'Límites de música actualizados.');
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
    } }, 'Moderación automática actualizada.');
  });
  $('#community-form')?.addEventListener('submit', event => {
    event.preventDefault();
    saveConfig(communityConfigBody(), 'Configuración de comunidad actualizada.');
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
  $$('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === name));
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
    pill.textContent = health.healthy ? 'Vesper operativo' : 'Estado degradado';
    pill.className = `pill ${health.healthy ? 'good' : 'warn'}`;
  } catch {
    $('#connection-pill').textContent = 'Sin conexión';
    $('#connection-pill').className = 'pill warn';
  }
}

async function boot() {
  try {
    state.publicConfig = await fetch('/api/web/public').then(response => response.json());
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
