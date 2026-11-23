'use strict';
/* DrivePanel - interfaz (JavaScript sin dependencias) */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const TOUCH = matchMedia('(pointer:coarse)').matches;

/* ---------- iconos (Material, SVG en linea) ---------- */
const P = {
  plus:'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  upload:'M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z',
  folderUp:'M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 3l4 4h-3v4h-2v-4H8l4-4z',
  folderAdd:'M20 6h-8l-2-2H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z',
  drive:'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z',
  people:'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  clock:'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  photo:'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  trash:'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  shield:'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z',
  menu:'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  search:'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  sun:'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z',
  moon:'M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z',
  auto:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18V4c4.41 0 8 3.59 8 8s-3.59 8-8 8z',
  account:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 01-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z',
  phone:'M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z',
  key:'M12.65 10A5.99 5.99 0 007 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 005.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
  logout:'M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 00-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 002 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  download:'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  share:'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z',
  move:'M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 12v-3h-4v-4h4V8l5 5-5 5z',
  edit:'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  restore:'M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0013 21a9 9 0 000-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
  forever:'M14.12 10.47L12 12.59l-2.13-2.12-1.41 1.41L10.59 14l-2.12 2.12 1.41 1.41L12 15.41l2.12 2.12 1.41-1.41L13.41 14l2.12-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z',
  close:'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  grid:'M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z',
  list:'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
  left:'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z', right:'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  more:'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  open:'M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
  link:'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  play:'M8 5v14l11-7z',
  down:'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
  folder:'M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
  image:'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  video:'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',
  pdf:'M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z',
  audio:'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  archive:'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 6h-2v2h2v2h-2v2h-2v-2h2v-2h-2v-2h2v-2h-2V8h2v2h2v2z',
  doc:'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  file:'M6 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z',
  sheet:'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 8h-8v8H9v-8H5V9h4V5h2v4h8v2z',
  chart:'M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z',
  bolt:'M7 2v11h3v9l7-12h-4l4-8z',
  refresh:'M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  info:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  storage:'M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z',
  cloudUp:'M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z',
};
P.text = P.doc; P.slides = P.sheet;
const svg = n => `<svg viewBox="0 0 24 24"><path d="${P[n] || P.file}"/></svg>`;
const ic = (n, cls = '') => `<i data-i="${n}" class="${cls}">${svg(n)}</i>`;
function paintIcons(root = document) { root.querySelectorAll('i[data-i]:empty').forEach(e => e.innerHTML = svg(e.dataset.i)); }

/* ---------- utilidades ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fmtSize(b) { if (b == null) return '—'; const u = ['B','KB','MB','GB','TB']; let i = 0; while (b >= 1024 && i < 4) { b /= 1024; i++; } return (i ? b.toFixed(b < 10 ? 1 : 0) : b) .toString().replace('.', ',') + ' ' + u[i]; }
const fmtDate = t => new Date(t * 1000).toLocaleString('es-ES', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
function toast(msg, ms = 3000) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), ms); }
const enc = encodeURIComponent;

async function api(url, opts = {}) {
  if (opts.json !== undefined) { opts.body = JSON.stringify(opts.json); opts.headers = {'Content-Type':'application/json'}; opts.method = opts.method || 'POST'; }
  const r = await fetch(url, opts);
  if (r.status === 401 && !url.includes('/api/login')) { showAuth(); throw new Error('Sesión caducada'); }
  let data = null; try { data = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error((data && data.detail && (typeof data.detail === 'string' ? data.detail : 'Datos no válidos')) || ('Error ' + r.status));
  return data;
}
const shareQ = () => S.share ? `&share=${S.share}` : '';
const fileUrl = (p, dl) => `/api/file?path=${enc(p)}${shareQ()}${dl ? '&download=1' : ''}`;
const thumbUrl = p => `/api/thumb?path=${enc(p)}${shareQ()}`;

/* ---------- estado ---------- */
const S = { me: null, view: 'drive', path: '', share: null, shareName: '', items: [], sel: new Set(), last: null,
  mode: (() => { try { return localStorage.getItem('dp-mode') || 'grid'; } catch (e) { return 'grid'; } })(), q: '' };
const keyOf = it => S.view === 'trash' ? String(it.id) : (it.share_id ? 's' + it.share_id : it.path);

/* ---------- acceso ---------- */
let registering = false;
function showAuth() { $('#app').classList.add('hidden'); $('#auth').classList.remove('hidden'); }
$('#authSwitch').onclick = e => {
  e.preventDefault(); registering = !registering;
  $('#authTitle').textContent = registering ? 'Crear cuenta' : 'Iniciar sesión';
  $('#authBtn').textContent = registering ? 'Registrarme' : 'Entrar';
  $('#authSwitch').textContent = registering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate';
  $('#authPass2').classList.toggle('hidden', !registering);
  $('#authMsg').textContent = '';
};
$('#authForm').onsubmit = async e => {
  e.preventDefault();
  const m = $('#authMsg'); m.className = 'auth-msg'; m.textContent = '';
  const username = $('#authUser').value.trim(), password = $('#authPass').value;
  try {
    if (registering) {
      if (password !== $('#authPass2').value) throw new Error('Las contraseñas no coinciden');
      const r = await api('/api/register', {json: {username, password}});
      m.className = 'auth-msg ok'; m.textContent = r.msg;
      if (r.msg.includes('Ya puedes')) { $('#authSwitch').click(); m.className = 'auth-msg ok'; m.textContent = r.msg; }
      return;
    }
    await api('/api/login', {json: {username, password}});
    $('#authPass').value = '';
    start();
  } catch (err) { m.textContent = err.message; }
};

async function start() {
  try { S.me = await api('/api/me'); } catch (e) { showAuth(); return; }
  $('#auth').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#userName').textContent = S.me.username; $('#menuName').textContent = S.me.username;
  paintAvatars(); paintVersion();
  $$('.admin-only').forEach(e => e.classList.toggle('hidden', !S.me.is_admin));
  updateBadge(S.me.pending);
  route(); loadStats();
}
// Versión del servidor y, si se abre desde la app de Android, también la de la app
function paintVersion() {
  const app = (navigator.userAgent.match(/DrivePanelAndroid\/([\d.]+)/) || [])[1];
  const t = `DrivePanel ${S.me.version || '?'}` + (app ? ` · App Android ${app}` : '');
  $('#sideVersion').textContent = t; $('#menuVersion').textContent = t.replace(' · ', '\n');
}
const AV_COLORS = ['#1a73e8','#e8710a','#188038','#a142f4','#d93025','#12b5cb','#e52592','#9334e6'];
function avatarHtml(name, ver, cls = '') {
  if (ver) return `<span class="avatar ${cls}" style="background-image:url('/api/avatar/${enc(name)}?v=${ver}')"></span>`;
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="avatar ${cls}" style="background:${AV_COLORS[h % AV_COLORS.length]}">${esc(name[0].toUpperCase())}</span>`;
}
function paintAvatars() {
  $('#userAvatar').outerHTML = avatarHtml(S.me.username, S.me.avatar).replace('<span ', '<span id="userAvatar" ');
  $('#menuAvatar').outerHTML = avatarHtml(S.me.username, S.me.avatar, 'big').replace('<span ', '<span id="menuAvatar" ');
  $('#avatarDelBtn').classList.toggle('hidden', !S.me.avatar);
}
$('#avatarInput').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const r = await api('/api/avatar', {method: 'PUT', body: f}); S.me.avatar = r.avatar; paintAvatars(); toast('Foto de perfil actualizada'); if (S.view === 'users') renderUsers(); }
  catch (err) { toast(err.message); }
};
function updateBadge(n) { const b = $('#pendingBadge'); b.textContent = n; b.classList.toggle('hidden', !n); }

/* ---------- navegacion (hash) ---------- */
function go(view, path = '', share = null) {
  let h = '#/' + view;
  if (view === 'drive' && path) h += '/' + path.split('/').map(enc).join('/');
  if (view === 'shared' && share) h += '/' + share + (path ? '/' + path.split('/').map(enc).join('/') : '');
  if (location.hash === h) route(); else location.hash = h;
}
window.addEventListener('hashchange', route);
function route() {
  if (!S.me) return;
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const view = ['drive','shared','recent','photos','trash','users','panel'].includes(parts[0]) ? parts[0] : 'drive';
  if (view === 'users' && !S.me.is_admin) return go('drive');
  S.view = view; S.share = null; S.path = '';
  if (view === 'drive') S.path = parts.slice(1).filter(Boolean).join('/');
  if (view === 'shared' && parts[1]) { S.share = +parts[1]; S.path = parts.slice(2).filter(Boolean).join('/'); }
  S.q = ''; $('#search').value = '';
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  $('#gridBtn').classList.toggle('hidden', view === 'panel'); $('#listBtn').classList.toggle('hidden', view === 'panel');
  closeSidebar(); load();
}

async function load() {
  S.sel.clear(); S.last = null;
  const c = $('#content');
  try {
    let data;
    if (S.q) data = await api('/api/search?q=' + enc(S.q));
    else if (S.view === 'drive') data = await api('/api/list?path=' + enc(S.path));
    else if (S.view === 'recent') data = await api('/api/recent');
    else if (S.view === 'photos') data = await api('/api/photos');
    else if (S.view === 'trash') data = await api('/api/trash');
    else if (S.view === 'users') return renderUsers();
    else if (S.view === 'panel') return renderPanel();
    else if (S.view === 'shared') {
      if (S.share) data = await api(`/api/list?path=${enc(S.path)}&share=${S.share}`);
      else { const r = await api('/api/shares'); S.sharesData = r; data = {items: r.withme}; }
    }
    S.items = data.items;
  } catch (e) { c.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  render();
}

/* ---------- pintar ---------- */
function crumbs() {
  const el = $('#crumbs');
  const label = {drive:'Mi unidad', shared:'Compartido conmigo', recent:'Recientes', photos:'Fotos', trash:'Papelera', users:'Usuarios', panel:'Panel de actividad'}[S.view];
  if (S.q) { el.innerHTML = `<button>Resultados de «${esc(S.q)}»</button>`; return; }
  let html = `<button data-p="" data-root="1">${label}</button>`;
  if (S.view === 'shared' && S.share) {
    const sh = (S.sharesData?.withme || []).find(x => x.share_id === S.share);
    html += `<span class="sep">›</span><button data-p="">${esc(sh ? sh.name + ' (' + sh.owner + ')' : 'Compartido')}</button>`;
  }
  let acc = '';
  (S.view === 'drive' || S.share) && S.path.split('/').filter(Boolean).forEach(seg => {
    acc = acc ? acc + '/' + seg : seg;
    html += `<span class="sep">›</span><button data-p="${esc(acc)}">${esc(seg)}</button>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('button').forEach(b => {
    b.onclick = () => S.view === 'shared' ? (b.dataset.root ? go('shared') : go('shared', b.dataset.p, S.share)) : go(S.view, b.dataset.p);
    if (S.view === 'drive') dropZone(b, () => b.dataset.p);
  });
}

function emptyMsg() {
  if (S.q) return 'No se ha encontrado nada';
  return {drive:'Esta carpeta está vacía. Arrastra archivos aquí o usa «Nuevo».', shared:'Nadie ha compartido nada contigo todavía.',
    recent:'Aún no hay archivos.', photos:'Aquí aparecerán tus fotos y vídeos.', trash:'La papelera está vacía.'}[S.view] || 'Vacío';
}

function render() {
  crumbs();
  $('#emptyTrash').classList.toggle('hidden', !(S.view === 'trash' && S.items.length));
  $('#gridBtn').classList.toggle('on', S.mode === 'grid'); $('#listBtn').classList.toggle('on', S.mode === 'list');
  $('#search').placeholder = 'Buscar en Mi unidad';
  const c = $('#content');
  let html = '';
  if (S.view === 'shared' && !S.share && !S.q) html += myLinksHtml();
  if (!S.items.length) { c.innerHTML = html + `<div class="empty">${ic(S.view === 'trash' ? 'trash' : S.view === 'photos' ? 'photo' : 'drive')}${emptyMsg()}</div>`; updateSel(); return; }
  if (S.view === 'photos' && !S.q) html += photosHtml();
  else if (S.mode === 'list') html += listHtml();
  else html += gridHtml();
  c.innerHTML = html;
  c.querySelectorAll('.item').forEach(bindItem);
  c.querySelectorAll('[data-unshare]').forEach(b => b.onclick = async () => { await api('/api/share/' + b.dataset.unshare, {method:'DELETE'}); load(); });
  c.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(b.dataset.copy));
  observeThumbs(c);
  updateSel();
}

function myLinksHtml() {
  const mine = S.sharesData?.mine || [];
  if (!mine.length) return '';
  return `<div class="sec-title">Lo que he compartido</div>` + mine.map(s => `<div class="share-row">${ic(s.kind, 'ic-' + s.kind)}<span>${esc(s.path)} · ${s.target ? 'con ' + esc(s.target) : 'enlace público' + (s.expires ? ' · caduca el ' + esc(fmtDate(s.expires)) : '')}</span>
    ${s.target ? '' : `<button class="btn small" data-copy="${esc(location.origin + '/s/' + s.token)}">Copiar enlace</button>`}
    <button class="btn small danger" data-unshare="${s.share_id}">Dejar de compartir</button></div>`).join('') + `<div class="sec-title">Compartido conmigo</div>`;
}

function thumbHtml(it) {
  if (it.kind === 'image' && !/\.(heic|heif)$/i.test(it.name)) return `<img data-src="${thumbUrl(it.path)}" alt="" loading="lazy">`;
  if (it.kind === 'video') return `${ic('video', 'big-ic ic-video')}`;
  return ic(it.kind, 'big-ic ic-' + it.kind);
}
function sub(it) {
  if (S.view === 'trash') return 'Eliminado ' + fmtDate(it.mtime);
  if (it.share_id) return 'De ' + esc(it.owner);
  return fmtDate(it.mtime);
}
function gridHtml() {
  const folders = S.items.filter(i => i.dir), files = S.items.filter(i => !i.dir);
  let h = '';
  if (folders.length) h += `<div class="sec-title">Carpetas</div><div class="folders">` + folders.map(it =>
    `<div class="item" data-k="${esc(keyOf(it))}" draggable="${S.view === 'drive'}"><div class="folder-card" title="${esc(it.name)}">${ic('folder', 'ic-folder')}<span class="ell">${esc(it.name)}</span><button class="icon-btn more">${svg('more')}</button></div></div>`).join('') + `</div>`;
  if (files.length) h += `<div class="sec-title">Archivos</div><div class="grid">` + files.map(it =>
    `<div class="item file-card" data-k="${esc(keyOf(it))}" draggable="${S.view === 'drive'}" title="${esc(it.name)}\n${fmtSize(it.size)} · ${sub(it)}">
      <div class="thumb">${thumbHtml(it)}${it.kind === 'video' ? '' : ''}</div>
      <div class="fname">${ic(it.kind, 'ic-' + it.kind)}<span class="ell">${esc(it.name)}</span><button class="icon-btn more">${svg('more')}</button></div></div>`).join('') + `</div>`;
  return h;
}
function listHtml() {
  const col = S.view === 'trash' ? 'Eliminado' : S.view === 'shared' && !S.share ? 'Propietario' : 'Modificado';
  return `<div class="tablewrap"><table class="list"><thead><tr><th>Nombre</th><th class="c-m hide-sm">${col}</th><th class="c-m">Tamaño</th><th></th></tr></thead><tbody>` +
    S.items.map(it => `<tr class="item row" data-k="${esc(keyOf(it))}" draggable="${S.view === 'drive'}">
      <td class="nc"><div class="n">${ic(it.dir ? 'folder' : it.kind, 'ic-' + (it.dir ? 'folder' : it.kind))}<span class="ell" title="${esc(it.path || it.name)}">${esc(it.name)}</span></div></td>
      <td class="c-m hide-sm">${it.share_id ? esc(it.owner) : fmtDate(it.mtime)}</td><td class="c-m">${it.dir ? '—' : fmtSize(it.size)}</td>
      <td style="width:40px"><button class="icon-btn more">${svg('more')}</button></td></tr>`).join('') + `</tbody></table></div>`;
}
function photosHtml() {
  let h = '', month = '';
  S.items.forEach(it => {
    const m = new Date(it.mtime * 1000).toLocaleDateString('es-ES', {month:'long', year:'numeric'});
    if (m !== month) { if (month) h += '</div>'; month = m; h += `<div class="photo-month">${m[0].toUpperCase() + m.slice(1)}</div><div class="photos">`; }
    h += `<div class="item ph" data-k="${esc(keyOf(it))}" title="${esc(it.path)}">${it.kind === 'image' && !/\.(heic|heif)$/i.test(it.name) ? `<img data-src="${thumbUrl(it.path)}" alt="">` : ic(it.kind, 'big-ic ic-' + it.kind)}${it.kind === 'video' ? ic('play', 'play') : ''}</div>`;
  });
  return h + '</div>';
}

/* miniaturas: solo se cargan al verse (ahorra CPU en la Pi) */
let thumbObs;
function observeThumbs(root) {
  thumbObs?.disconnect();
  thumbObs = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { const img = e.target; img.src = img.dataset.src; img.onerror = () => { img.replaceWith(Object.assign(document.createElement('i'), {innerHTML: svg('image'), className: 'big-ic ic-image'})); }; thumbObs.unobserve(img); }
  }), {rootMargin: '300px'});
  root.querySelectorAll('img[data-src]').forEach(i => thumbObs.observe(i));
}

/* ---------- seleccion y clics ---------- */
const itemByKey = k => S.items.find(i => keyOf(i) === k);
function bindItem(el) {
  const k = el.dataset.k, it = itemByKey(k);
  let press;
  el.addEventListener('click', e => {
    if (e.target.closest('.more')) { e.stopPropagation(); if (!S.sel.has(k)) { S.sel.clear(); S.sel.add(k); updateSel(); } openCtx(e.target.closest('.more'), it); return; }
    if (el._long) { el._long = false; return; }
    if (e.ctrlKey || e.metaKey) { S.sel.has(k) ? S.sel.delete(k) : S.sel.add(k); S.last = k; }
    else if (e.shiftKey && S.last) {
      const ks = S.items.map(keyOf), a = ks.indexOf(S.last), b = ks.indexOf(k);
      ks.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => S.sel.add(x));
    } else if (TOUCH) { if (S.sel.size) { S.sel.has(k) ? S.sel.delete(k) : S.sel.add(k); } else return openItem(it); }
    else if (S.view === 'photos') return openItem(it);
    else { S.sel.clear(); S.sel.add(k); S.last = k; }
    updateSel();
  });
  el.addEventListener('dblclick', () => !TOUCH && openItem(it));
  el.addEventListener('contextmenu', e => { e.preventDefault(); if (!S.sel.has(k)) { S.sel.clear(); S.sel.add(k); updateSel(); } openCtx({x: e.clientX, y: e.clientY}, it); });
  el.addEventListener('touchstart', () => { press = setTimeout(() => { el._long = true; S.sel.add(k); updateSel(); navigator.vibrate?.(20); }, 500); }, {passive: true});
  ['touchend','touchmove','touchcancel'].forEach(ev => el.addEventListener(ev, () => clearTimeout(press), {passive: true}));
  if (S.view === 'drive' && !S.q) {
    el.addEventListener('dragstart', e => { if (!S.sel.has(k)) { S.sel.clear(); S.sel.add(k); updateSel(); } e.dataTransfer.setData('application/x-dp', JSON.stringify([...S.sel])); e.dataTransfer.effectAllowed = 'move'; });
    if (it.dir) dropZone(el, () => it.path);
  }
}
function dropZone(el, destFn) {
  el.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('application/x-dp')) { e.preventDefault(); e.stopPropagation(); el.classList.add('drop-target'); } });
  el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
  el.addEventListener('drop', async e => {
    const d = e.dataTransfer.getData('application/x-dp'); el.classList.remove('drop-target');
    if (!d) return; e.preventDefault(); e.stopPropagation();
    const paths = JSON.parse(d).filter(p => p !== destFn());
    if (!paths.length) return;
    try { await api('/api/move', {json: {paths, dest: destFn()}}); toast('Movido'); load(); } catch (err) { toast(err.message); }
  });
}
function updateSel() {
  $$('#content .item').forEach(el => el.classList.toggle('selected', S.sel.has(el.dataset.k)));
  const n = S.sel.size, bar = $('#selBar');
  bar.classList.toggle('hidden', !n); $('#crumbs').classList.toggle('hidden', !!n);
  if (!n) return;
  $('#selCount').textContent = n === 1 ? '1 seleccionado' : n + ' seleccionados';
  const trash = S.view === 'trash', own = (S.view === 'drive' || S.view === 'recent' || S.view === 'photos' || (S.q && S.view !== 'trash')) && !S.share;
  const show = (a, v) => bar.querySelector(`[data-sel="${a}"]`).classList.toggle('hidden', !v);
  show('download', !trash); show('share', own && n === 1); show('move', own); show('rename', own && n === 1);
  show('delete', own || (S.view === 'shared' && !S.share)); show('restore', trash); show('purge', trash);
  bar.querySelector('[data-sel="delete"]').title = S.view === 'shared' ? 'Quitar de compartidos' : 'Eliminar';
}
const selItems = () => [...S.sel].map(itemByKey).filter(Boolean);
$('#content').addEventListener('click', e => { if (e.target === $('#content') || e.target.classList.contains('empty')) { S.sel.clear(); updateSel(); } });

/* ---------- acciones ---------- */
function openItem(it) {
  if (S.view === 'trash') { S.sel.clear(); S.sel.add(keyOf(it)); updateSel(); return toast('Restáuralo para poder abrirlo'); }
  if (it.share_id) return go('shared', '', it.share_id);
  if (it.dir) return S.view === 'shared' ? go('shared', it.path, S.share) : go('drive', it.path);
  openViewer(it);
}
function download(items) {
  if (items.length === 1 && !items[0].dir) { location.href = fileUrl(items[0].path, true); return; }
  location.href = '/api/zip?' + items.map(i => 'paths=' + enc(i.path)).join('&') + shareQ();
}
const actions = {
  open: it => openItem(it),
  download: () => download(selItems()),
  share: () => shareDialog(selItems()[0]),
  move: () => moveDialog(selItems()),
  rename: () => renameDialog(selItems()[0]),
  location: it => go('drive', it.path.split('/').slice(0, -1).join('/')),
  delete: async () => {
    const items = selItems();
    if (S.view === 'shared') { for (const i of items) await api('/api/share/' + i.share_id, {method:'DELETE'}); return load(); }
    try { await api('/api/delete', {json: {paths: items.map(i => i.path)}}); toast(items.length === 1 ? 'Movido a la papelera' : items.length + ' elementos movidos a la papelera'); load(); loadStats(); } catch (e) { toast(e.message); }
  },
  restore: async () => { await api('/api/trash/restore', {json: {ids: selItems().map(i => i.id)}}); toast('Restaurado'); load(); },
  purge: async () => { if (await confirmDialog('Eliminar para siempre', 'Estos elementos se borrarán definitivamente. No se puede deshacer.', 'Eliminar')) { await api('/api/trash/delete', {json: {ids: selItems().map(i => i.id)}}); load(); loadStats(); } },
  clear: () => { S.sel.clear(); updateSel(); },
  props: () => propsDialog(selItems()),
};
$('#selBar').addEventListener('click', e => { const b = e.target.closest('[data-sel]'); if (b) actions[b.dataset.sel](); });
$('#emptyTrash').onclick = async () => { if (await confirmDialog('Vaciar papelera', 'Se borrará todo lo que hay en la papelera para siempre.', 'Vaciar')) { await api('/api/trash/empty', {method:'POST'}); load(); loadStats(); } };

function openCtx(anchor, it) {
  const m = $('#ctx'), trash = S.view === 'trash', own = !S.share && S.view !== 'shared' && !trash, multi = S.sel.size > 1;
  const opts = [];
  if (!trash && !multi) opts.push(['open', 'open', it.dir ? 'Abrir' : 'Ver']);
  if (!trash) opts.push(['download', 'download', it.dir || multi ? 'Descargar (.zip)' : 'Descargar']);
  if (own && !multi) opts.push(['share', 'share', 'Compartir'], ['rename', 'edit', 'Cambiar nombre']);
  if (own) opts.push(['move', 'move', 'Mover a…']);
  if ((S.view === 'recent' || S.view === 'photos' || S.q) && !multi) opts.push(['location', 'drive', 'Mostrar ubicación']);
  if (!trash) opts.push(['props', 'info', 'Propiedades']);
  if (trash) opts.push(['restore', 'restore', 'Restaurar'], ['purge', 'forever', 'Eliminar para siempre']);
  if (own) opts.push(['-'], ['delete', 'trash', 'Mover a la papelera']);
  if (S.view === 'shared' && !S.share) opts.push(['delete', 'close', 'Quitar de compartidos']);
  m.innerHTML = opts.map(o => o[0] === '-' ? '<hr>' : `<button data-a="${o[0]}" class="${o[0] === 'delete' || o[0] === 'purge' ? 'danger' : ''}">${ic(o[1])}${o[2]}</button>`).join('');
  m.classList.remove('hidden');
  let x, y;
  if (anchor.getBoundingClientRect) { const r = anchor.getBoundingClientRect(); x = r.left; y = r.bottom; } else { x = anchor.x; y = anchor.y; }
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px';
  m.style.top = (y + h > innerHeight - 8 ? Math.max(8, y - h) : y) + 'px';
  m.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; m.classList.add('hidden'); actions[b.dataset.a](it); };
}
document.addEventListener('click', e => {
  if (!e.target.closest('.quick-wrap')) $('#quickMenu').classList.add('hidden');
  if (!e.target.closest('#ctx') && !e.target.closest('.more')) $('#ctx').classList.add('hidden');
  if (!e.target.closest('.new-wrap')) $('#newMenu').classList.add('hidden');
  if (!e.target.closest('.user-wrap')) $('#userMenu').classList.add('hidden');
});
document.addEventListener('keydown', e => {
  if (!$('#viewer').classList.contains('hidden')) {
    if (e.key === 'Escape') closeViewer(); if (e.key === 'ArrowLeft') stepViewer(-1); if (e.key === 'ArrowRight') stepViewer(1); return;
  }
  if (!$('#dialog').classList.contains('hidden')) { if (e.key === 'Escape') closeDialog(); return; }
  if (e.target.matches('input')) return;
  if (e.key === 'Delete' && S.sel.size && S.view !== 'trash') actions.delete();
  if (e.key === 'Escape') { S.sel.clear(); updateSel(); $('#ctx').classList.add('hidden'); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'a' && S.items.length) { e.preventDefault(); S.items.forEach(i => S.sel.add(keyOf(i))); updateSel(); }
  if (e.key === 'F2' && S.sel.size === 1 && S.view === 'drive') actions.rename();
});

/* ---------- dialogos ---------- */
let dlgResolve;
function dialog(html) { $('#dialogBox').innerHTML = html; $('#dialog').classList.remove('hidden'); paintIcons($('#dialogBox')); const f = $('#dialogBox input'); f && setTimeout(() => { f.focus(); f.select?.(); }, 30); return new Promise(r => dlgResolve = r); }
function closeDialog(v) { $('#dialog').classList.add('hidden'); dlgResolve?.(v); dlgResolve = null; }
$('#dialog').addEventListener('mousedown', e => { if (e.target === $('#dialog')) closeDialog(); });
$('#dialogBox').addEventListener('click', e => { const b = e.target.closest('[data-close]'); if (b) closeDialog(b.dataset.close === 'ok' ? true : undefined); });
async function promptDialog(title, value = '', ok = 'Aceptar') {
  const p = dialog(`<h3>${esc(title)}</h3><form id="pf"><input id="pv" value="${esc(value)}"><div class="actions"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary">${ok}</button></div></form>`);
  $('#pf').onsubmit = e => { e.preventDefault(); closeDialog($('#pv').value.trim()); };
  return p;
}
function confirmDialog(title, text, ok = 'Aceptar') {
  return dialog(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="actions"><button class="btn" data-close>Cancelar</button><button class="btn primary" data-close="ok">${ok}</button></div>`);
}
async function mkdirDialog() {
  const name = await promptDialog('Nueva carpeta', 'Carpeta sin título', 'Crear');
  if (!name) return;
  try { await api('/api/mkdir', {json: {path: S.view === 'drive' ? S.path : '', name}}); if (S.view !== 'drive') go('drive'); else load(); } catch (e) { toast(e.message); }
}
async function renameDialog(it) {
  const name = await promptDialog('Cambiar nombre', it.name);
  if (!name || name === it.name) return;
  try { await api('/api/rename', {json: {path: it.path, name}}); load(); } catch (e) { toast(e.message); }
}
async function moveDialog(items) {
  let cur = '';
  const paint = async () => {
    const r = await api('/api/list?path=' + enc(cur));
    const ups = cur ? `<button data-p="${esc(cur.split('/').slice(0, -1).join('/'))}">${ic('left')}Subir un nivel</button>` : '';
    $('#picker').innerHTML = ups + r.items.filter(i => i.dir && !items.some(s => s.path === i.path)).map(i => `<button data-p="${esc(i.path)}">${ic('folder', 'ic-folder')}${esc(i.name)}</button>`).join('') || '<p style="padding:10px">Sin subcarpetas</p>';
    $('#pickPath').textContent = 'Mi unidad' + (cur ? ' / ' + cur.split('/').join(' / ') : '');
    $('#picker').querySelectorAll('[data-p]').forEach(b => b.onclick = () => { cur = b.dataset.p; paint(); });
  };
  const p = dialog(`<h3>Mover ${items.length === 1 ? '«' + esc(items[0].name) + '»' : items.length + ' elementos'}</h3><p id="pickPath"></p><div id="picker" class="picker"></div>
    <div class="actions"><button class="btn" data-close>Cancelar</button><button class="btn primary" data-close="ok">Mover aquí</button></div>`);
  paint();
  if (await p) { try { await api('/api/move', {json: {paths: items.map(i => i.path), dest: cur}}); toast('Movido'); load(); } catch (e) { toast(e.message); } }
}
async function shareDialog(it) {
  const p = dialog(`<h3>Compartir «${esc(it.name)}»</h3>
    <label>Con otro usuario de DrivePanel (solo lectura)</label>
    <form id="shU" style="display:flex;gap:8px"><input id="shUser" placeholder="Nombre de usuario"><button class="btn primary">Compartir</button></form>
    <label>O con un enlace público (cualquiera con el enlace puede descargarlo${it.dir ? ' en .zip' : ''})</label>
    <div id="shLink" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select id="shDays" style="width:auto"><option value="">No caduca</option><option value="1">Caduca en 1 día</option><option value="7" selected>Caduca en 7 días</option><option value="30">Caduca en 30 días</option></select>
      <button class="btn" id="mkLink">${ic('link')} Crear enlace</button></div>
    <div class="actions"><button class="btn" data-close>Cerrar</button></div>`);
  $('#shU').onsubmit = async e => { e.preventDefault(); try { await api('/api/share', {json: {path: it.path, target: $('#shUser').value}}); toast('Compartido con ' + $('#shUser').value); closeDialog(); } catch (err) { toast(err.message); } };
  $('#mkLink').onclick = async () => {
    const days = +$('#shDays').value || null;
    let r; try { r = await api('/api/share', {json: {path: it.path, days}}); } catch (err) { return toast(err.message); }
    const url = location.origin + '/s/' + r.token;
    $('#shLink').innerHTML = `<div class="copy">${esc(url)}</div><button class="btn small" id="cpL">Copiar</button>${r.expires ? `<span class="muted">Caduca el ${esc(fmtDate(r.expires))}</span>` : ''}`; $('#cpL').onclick = () => copy(url);
  };
  return p;
}
function copy(text) {
  (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => toast('Copiado'), () => {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('Copiado'); } catch (e) {} t.remove();
  });
}
function webdavDialog() {
  const url = location.origin + '/dav/';
  dialog(`<h3>Conectar el móvil o el PC (WebDAV)</h3>
    <p>Tu carpeta «Mi unidad» está disponible por WebDAV. Úsalo con FolderSync, PhotoSync, el explorador de archivos, etc.</p>
    <label>Dirección del servidor</label><div class="copy">${esc(url)}</div>
    <label>Usuario</label><div class="copy">${esc(S.me.username)}</div>
    <label>Contraseña</label><div class="copy">La misma con la que entras aquí</div>
    <p style="margin-top:12px"><b>FolderSync (Android):</b> Cuentas → + → WebDAV. Servidor: la dirección de arriba, sin HTTPS. Luego crea un «Folderpair» de tipo <i>Hacia la carpeta remota</i> desde DCIM/Camera a una carpeta, por ejemplo <code>/Móvil/Cámara</code>, y activa la sincronización programada o al detectar cambios.</p>
    <div class="actions"><button class="btn" id="cpDav">Copiar dirección</button><button class="btn primary" data-close>Cerrar</button></div>`);
  $('#cpDav').onclick = () => copy(url);
}
async function passwordDialog() {
  const p = dialog(`<h3>Cambiar contraseña</h3><form id="pwf"><label>Actual</label><input id="pw0" type="password" autocomplete="current-password"><label>Nueva</label><input id="pw1" type="password" autocomplete="new-password"><label>Repite la nueva</label><input id="pw2" type="password" autocomplete="new-password">
    <div class="actions"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary">Guardar</button></div></form>`);
  $('#pwf').onsubmit = async e => {
    e.preventDefault(); if ($('#pw1').value !== $('#pw2').value) return toast('Las contraseñas no coinciden');
    try { await api('/api/password', {json: {old: $('#pw0').value, new: $('#pw1').value}}); toast('Contraseña cambiada'); closeDialog(); } catch (err) { toast(err.message); }
  };
  return p;
}

/* ---------- visor de fotos / video / pdf / texto ---------- */
let vList = [], vIdx = 0;
function openViewer(it) {
  vList = S.items.filter(i => !i.dir); vIdx = vList.indexOf(it); showViewer(); $('#viewer').classList.remove('hidden');
}
async function showViewer() {
  const it = vList[vIdx], b = $('#vBody'), url = fileUrl(it.path);
  $('#vName').textContent = it.name; $('#vDownload').href = fileUrl(it.path, true);
  $('#vPrev').style.visibility = vIdx > 0 ? '' : 'hidden'; $('#vNext').style.visibility = vIdx < vList.length - 1 ? '' : 'hidden';
  if (it.kind === 'image') b.innerHTML = `<img src="${url}" alt="">`;
  else if (it.kind === 'video') b.innerHTML = `<video src="${url}" controls autoplay playsinline preload="metadata"></video>`;
  else if (it.kind === 'audio') b.innerHTML = `<audio src="${url}" controls autoplay></audio>`;
  else if (it.kind === 'pdf') b.innerHTML = `<iframe src="${url}"></iframe>`;
  else if (it.kind === 'text' && it.size < 2e6) { b.innerHTML = '<pre>Cargando…</pre>'; try { const t = await (await fetch(url)).text(); b.querySelector('pre').textContent = t; } catch (e) {} }
  else b.innerHTML = `<div class="nopreview">${ic(it.kind, 'big-ic')}<p>No hay vista previa para este archivo</p><a class="btn primary" href="${fileUrl(it.path, true)}">Descargar (${fmtSize(it.size)})</a></div>`;
  paintIcons(b);
  const nx = vList[vIdx + 1]; if (nx && nx.kind === 'image') new Image().src = fileUrl(nx.path);
}
function stepViewer(d) { const n = vIdx + d; if (n >= 0 && n < vList.length) { vIdx = n; showViewer(); } }
function closeViewer() { $('#viewer').classList.add('hidden'); $('#vBody').innerHTML = ''; }
$('#vClose').onclick = closeViewer; $('#vPrev').onclick = () => stepViewer(-1); $('#vNext').onclick = () => stepViewer(1);
(() => { let x0 = null; const v = $('#viewer');
  v.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive: true});
  v.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 60 && !e.target.closest('video')) stepViewer(dx < 0 ? 1 : -1); x0 = null; }); })();

/* ---------- subidas ----------
   Cada archivo se manda en trozos de 32 MB con reintentos automaticos, asi una subida
   grande (o pasando por un proxy inverso) no se corta. Los que fallan se quedan en la lista con
   su motivo y se pueden reintentar; la lista de fallidos se guarda tambien en el navegador. */
const queue = []; let active = 0, refreshT;
const UP = {total: 0, done: 0, skipped: 0, failed: [], bytesTotal: 0, bytesDone: 0, sent: 0};

/* velocidad de subida: media de los ultimos 5 segundos de bytes realmente enviados */
const fmtRate = b => fmtSize(b) + '/s';
function fmtEta(s) {
  if (!isFinite(s) || s <= 0) return '';
  s = Math.round(s);
  if (s < 60) return `quedan ${s} s`;
  if (s < 3600) return `quedan ${Math.floor(s / 60)} min ${s % 60 ? (s % 60) + ' s' : ''}`.trim();
  return `quedan ${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60)} min`;
}
function rateOf(samples, now, value) {
  samples.push([now, value]);
  while (samples.length > 2 && now - samples[0][0] > 5000) samples.shift();
  const [t0, v0] = samples[0], dt = (now - t0) / 1000;
  return dt >= 0.8 ? Math.max(0, (value - v0) / dt) : null;
}
const speedSamples = [];
setInterval(() => {
  const busy = active || queue.length, box = $('#upSpeed');
  if (!busy) { speedSamples.length = 0; box.classList.add('hidden'); return; }
  const r = rateOf(speedSamples, Date.now(), UP.sent);
  box.classList.remove('hidden');
  $('#upRate').textContent = r == null ? 'Midiendo velocidad…' : '↑ ' + fmtRate(r);
  const left = Math.max(0, UP.bytesTotal - UP.bytesDone);
  $('#upEta').textContent = r ? fmtEta(left / r) : '';
  $('#upBytes').textContent = `${fmtSize(UP.bytesDone)} de ${fmtSize(UP.bytesTotal)}`;
}, 1000);
const MAX_PARALLEL = 2, CHUNK = 32 * 1024 * 1024, MIN_CHUNK = 1024 * 1024, MAX_TRIES = 6;
const NO_RETRY = new Set([400, 401, 403, 404, 413, 507]);

async function enqueue(files, base) {
  // files: [{file, rel}] ; base: carpeta destino
  if (!files.length) return;
  let list = files.map(f => ({...f, conflict: 'skip'}));
  try {
    const r = await api('/api/upload/check', {json: {path: base, files: files.map(f => [f.rel, f.file.size])}});
    if (r.exists.length) { list = await resolveConflicts(list, r.exists); if (!list) return; }
  } catch (e) { /* si falla la comprobacion, se sube saltando los identicos */ }
  if (!list.length) return toast('No hay nada nuevo que subir');
  $('#uploads').classList.remove('hidden', 'min');
  list.forEach(f => { queue.push({...f, base, uid: null, offset: 0}); UP.total++; UP.bytesTotal += f.file.size; });
  updUpTitle(); pump();
}

/* Como el explorador de Windows: reemplazar, omitir o decidir archivo por archivo */
async function resolveConflicts(list, exists) {
  const ex = new Map(exists.map(e => [e.rel, e])), n = exists.length, same = exists.filter(e => e.same).length;
  const p = dialog(`<h3>${n === 1 ? 'Ya existe un archivo con ese nombre' : `${n} archivos ya existen en el destino`}</h3>
    <p>${n === 1 ? esc(exists[0].rel) : `${same} son idénticos (mismo tamaño) y ${n - same} distintos.`}</p>
    <div class="choice-list">
      <button class="btn primary" data-c="skip">${ic('right')} Omitir ${n === 1 ? 'este archivo' : 'estos archivos'} (subir solo lo nuevo)</button>
      <button class="btn" data-c="overwrite">${ic('upload')} Reemplazar ${n === 1 ? 'el archivo' : 'los archivos'} del destino</button>
      <button class="btn" data-c="rename">${ic('folderAdd')} Conservar ambos (se sube como «nombre (1)»)</button>
      ${n > 1 ? `<button class="btn" data-c="ask">${ic('list')} Decidir para cada archivo</button>` : ''}
      <button class="btn" data-close>Cancelar la subida</button>
    </div>`);
  $('#dialogBox').querySelectorAll('[data-c]').forEach(b => b.onclick = () => closeDialog(b.dataset.c));
  const choice = await p;
  if (!choice) return null;
  if (choice !== 'ask') return applyChoice(list, ex, () => choice);
  // uno por uno, con «hacer lo mismo con los demas»
  const decided = new Map(); let forAll = null, i = 0;
  for (const f of list) {
    const e = ex.get(f.rel); if (!e) continue; i++;
    if (forAll) { decided.set(f.rel, forAll); continue; }
    const q = dialog(`<h3>Reemplazar u omitir (${i} de ${n})</h3>
      <p><b>${esc(f.rel)}</b></p>
      <div class="cmp"><div><span>En el servidor</span>${fmtSize(e.size)} · ${fmtDate(e.mtime)}</div>
      <div><span>El que subes</span>${fmtSize(f.file.size)} · ${fmtDate(f.file.lastModified / 1000)}</div></div>
      ${e.same ? '<p>Tienen el mismo tamaño: seguramente es el mismo archivo.</p>' : ''}
      <label class="forall"><input type="checkbox" id="forAll" style="width:auto"> Hacer lo mismo con los ${n - i} restantes</label>
      <div class="choice-list">
        <button class="btn primary" data-c="overwrite">Reemplazar</button>
        <button class="btn" data-c="skip">Omitir</button>
        <button class="btn" data-c="rename">Conservar ambos</button>
        <button class="btn" data-close>Cancelar la subida</button>
      </div>`);
    if (n - i === 0) $('#dialogBox .forall').classList.add('hidden');
    $('#dialogBox').querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const all = $('#forAll').checked; closeDialog({c: b.dataset.c, all}); });
    const a = await q;
    if (!a) return null;
    decided.set(f.rel, a.c); if (a.all) forAll = a.c;
  }
  return applyChoice(list, ex, f => decided.get(f.rel));
}
function applyChoice(list, ex, pick) {
  const out = [];
  for (const f of list) {
    if (!ex.has(f.rel)) { out.push(f); continue; }
    const c = pick(f);
    if (c === 'skip') { UP.skippedNow = (UP.skippedNow || 0) + 1; continue; }
    out.push({...f, conflict: c});
  }
  if (UP.skippedNow) { toast(`${UP.skippedNow} archivos omitidos porque ya estaban`); UP.skippedNow = 0; }
  return out;
}

function updUpTitle() {
  const busy = active || queue.length;
  const parts = [busy ? `Subiendo ${Math.min(UP.done + UP.skipped + UP.failed.length + 1, UP.total)} de ${UP.total}` : `${UP.done} subidos`];
  if (UP.skipped) parts.push(`${UP.skipped} ya estaban`);
  if (UP.failed.length) parts.push(`${UP.failed.length} con error`);
  $('#upTitle').textContent = parts.join(' · ');
  $('#upTotalBar').style.width = (UP.bytesTotal ? UP.bytesDone / UP.bytesTotal * 100 : 0) + '%';
  const nf = UP.failed.length;
  $('#upFailBox').classList.toggle('hidden', !nf);
  $('#upFailCount').textContent = nf === 1 ? '1 archivo no se ha podido subir' : `${nf} archivos no se han podido subir`;
  $('#upRetry').disabled = !UP.failed.some(f => f.file);
  saveFailed();
}

function makeRow(job) {
  const row = document.createElement('div'); row.className = 'up-item';
  row.innerHTML = `<div class="r"><span class="ell" title="${esc(job.rel)}">${esc(job.rel)}</span><span class="st">0%</span></div><div class="bar"><div></div></div>`;
  $('#upList').prepend(row); return row;
}

function pump() {
  while (active < MAX_PARALLEL && queue.length) {
    const job = queue.shift(); active++;
    job.row = job.row || makeRow(job);
    job.row.classList.remove('failed', 'done');
    job.row.querySelector('.st').className = 'st';
    uploadFile(job).then(res => {
      const st = job.row.querySelector('.st'), bar = job.row.querySelector('.bar div');
      if (res.ok) {
        if (res.skipped) { UP.skipped++; st.textContent = 'Ya estaba'; } else { UP.done++; st.textContent = 'Listo'; }
        st.className = 'st ok'; bar.style.width = '100%'; bar.className = '';
        job.row.classList.add('done'); if (upAuto()) autoClear(job.row);
      } else {
        st.textContent = res.error; st.className = 'st err'; bar.className = 'crit';
        job.row.classList.add('failed');
        // si el fallo es definitivo (cuota, permisos...) se borra lo subido a medias en el servidor;
        // si no, se conserva para que «Reintentar» continue desde donde se quedo
        if (res.fatal) { dropPart(job.uid); job.uid = null; job.offset = 0; }
        UP.failed.push({rel: job.rel, base: job.base, error: res.error, file: job.file, conflict: job.conflict, row: job.row,
                        uid: job.uid, offset: job.offset || 0, chunk: job.chunk});
      }
      active--; updUpTitle(); pump();
      clearTimeout(refreshT); refreshT = setTimeout(() => { if (S.view === 'drive' || S.view === 'recent' || S.view === 'photos') load(); loadStats(); }, active ? 3000 : 300);
    });
  }
}

function sendChunk(job, blob, offset, onProgress) {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    const q = `path=${enc(job.base)}&name=${enc(job.rel)}&uid=${job.uid}&offset=${offset}&total=${job.file.size}&conflict=${job.conflict}`;
    xhr.open('PUT', '/api/upload?' + q);
    xhr.setRequestHeader('X-Mtime', job.file.lastModified || '');
    xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = e => onProgress(e.loaded);
    xhr.onload = () => { let d = null; try { d = JSON.parse(xhr.responseText); } catch (e) {} resolve({status: xhr.status, data: d}); };
    xhr.onerror = () => resolve({status: 0});
    xhr.ontimeout = () => resolve({status: 0, timeout: true});
    xhr.send(blob);
  });
}

async function uploadFile(job) {
  const st = job.row.querySelector('.st'), bar = job.row.querySelector('.bar div'), size = job.file.size;
  job.uid = job.uid || (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  let offset = job.offset || 0, tries = 0, counted = offset; job._sp = []; job._rate = 0; job._t = 0;
  const show = sent => { const p = size ? (offset + sent) / size * 100 : 100; bar.style.width = p + '%';
    const now = offset + sent; UP.bytesDone += Math.max(0, now - counted); UP.sent += Math.max(0, now - counted); counted = Math.max(counted, now);
    const t = Date.now(); if (!job._t || t - job._t > 700) { job._t = t; const r = rateOf(job._sp = job._sp || [], t, counted); if (r != null) job._rate = r; }
    st.textContent = Math.floor(p) + '%' + (job._rate ? ' · ' + fmtRate(job._rate) : ''); $('#upTotalBar').style.width = (UP.bytesDone / UP.bytesTotal * 100) + '%'; };
  while (true) {
    const end = Math.min(offset + (job.chunk || CHUNK), size);
    const r = await sendChunk(job, job.file.slice(offset, end), offset, show);
    if (r.status >= 200 && r.status < 300) {
      tries = 0;
      if (r.data?.skipped) { UP.bytesDone += size - counted; return {ok: true, skipped: true}; }
      if (r.data?.done || end >= size) { UP.bytesDone += Math.max(0, size - counted); return {ok: true}; }
      offset = end; job.offset = offset; continue;
    }
    if (r.status === 409 && /^offset:(\d+)/.test(r.data?.detail || '')) {  // el servidor tiene otra cantidad: seguimos desde ahi
      offset = +RegExp.$1; job.offset = offset; counted = Math.min(counted, offset); continue;
    }
    if (r.status === 413 && (job.chunk || CHUNK) > MIN_CHUNK) {  // el proxy no admite trozos tan grandes: mas pequenos
      job.chunk = Math.max(MIN_CHUNK, Math.floor((job.chunk || CHUNK) / 2)); continue;
    }
    const msg = r.status === 0 ? (r.timeout ? 'Tiempo de espera agotado' : 'Error de red')
      : r.status === 413 ? 'El servidor o el proxy rechaza el tamaño de la subida' : (r.data?.detail || `Error ${r.status}`);
    if (NO_RETRY.has(r.status)) return {ok: false, error: msg, fatal: true};
    if (++tries >= MAX_TRIES) return {ok: false, error: msg};
    const wait = [2, 5, 10, 20, 40][tries - 1] || 60;
    for (let s = wait; s > 0; s--) { st.textContent = `${msg}. Reintento ${tries}/${MAX_TRIES - 1} en ${s}s`; await new Promise(z => setTimeout(z, 1000)); }
  }
}

function retryFailed() {
  const again = UP.failed.filter(f => f.file); if (!again.length) return;
  UP.failed = UP.failed.filter(f => !f.file);
  // se continua la misma subida (mismo uid): el servidor dice desde que byte seguir
  again.forEach(f => { f.row && f.row.querySelector('.st') && (f.row.querySelector('.st').textContent = 'En cola'); queue.push({file: f.file, rel: f.rel, base: f.base, conflict: f.conflict, row: f.row, uid: f.uid || null, offset: f.offset || 0, chunk: f.chunk}); });
  $('#uploads').classList.remove('hidden', 'min'); updUpTitle(); pump();
}
function failedText() { return UP.failed.map(f => `${f.base ? f.base + '/' : ''}${f.rel}\t${f.error}`).join('\n'); }
function saveFailed() { try { localStorage.setItem('dp-upfailed', JSON.stringify(UP.failed.map(f => ({rel: f.rel, base: f.base, error: f.error, uid: f.uid || null})))); } catch (e) {} }
// borra del servidor lo que se habia subido de un archivo que ya no se va a continuar
function dropPart(uid) { if (uid) fetch('/api/upload/' + encodeURIComponent(uid), {method: 'DELETE'}).catch(() => {}); }
function restoreFailed() {
  // al recargar la pagina se recuerda que archivos fallaron (para saber cuales volver a subir)
  let saved = []; try { saved = JSON.parse(localStorage.getItem('dp-upfailed') || '[]'); } catch (e) {}
  if (!saved.length) return;
  UP.failed = saved.map(f => ({...f, file: null}));
  saved.forEach(f => { const row = makeRow(f); row.classList.add('failed'); const st = row.querySelector('.st'); st.textContent = f.error; st.className = 'st err'; row.querySelector('.bar div').className = 'crit'; });
  $('#uploads').classList.remove('hidden'); updUpTitle();
  $('#upRetryHint').classList.remove('hidden');
}
$('#upRetry').onclick = retryFailed;
$('#upCopyFailed').onclick = () => copy(failedText());
$('#upDropFailed').onclick = () => { UP.failed.forEach(f => { dropPart(f.uid); f.row && dropRow(f.row); }); UP.failed = []; $('#upRetryHint').classList.add('hidden'); updUpTitle(); maybeHide(); };

function upAuto() { return $('#upAuto').checked; }
try { $('#upAuto').checked = localStorage.getItem('dp-upauto') !== '0'; } catch (e) { $('#upAuto').checked = true; }
$('#upAuto').onchange = () => { try { localStorage.setItem('dp-upauto', upAuto() ? '1' : '0'); } catch (e) {} if (upAuto()) cleanDone(); };
function dropRow(row) { row.parentNode && row.parentNode.removeChild(row); }
function autoClear(row) { setTimeout(() => { row.classList.add('fade'); setTimeout(() => { dropRow(row); maybeHide(); }, 400); }, 1500); }
// «Limpiar» solo quita lo ya subido: los errores se quedan hasta que los reintentes o descartes
function cleanDone() { $$('#upList .up-item.done').forEach(dropRow); maybeHide(); }
function maybeHide() {
  if (!active && !queue.length && !$('#upList').children.length && !UP.failed.length) {
    $('#uploads').classList.add('hidden'); Object.assign(UP, {total: 0, done: 0, skipped: 0, bytesTotal: 0, bytesDone: 0});
  }
}
$('#upClean').onclick = cleanDone;
$('#upMin').onclick = () => $('#uploads').classList.toggle('min');
$('#upClose').onclick = () => {
  if (active || queue.length) { $('#uploads').classList.add('min'); return toast('Las subidas siguen en segundo plano'); }
  if (UP.failed.length) { $('#uploads').classList.add('min'); return toast('Hay archivos con error: reinténtalos o pulsa «Descartar»'); }
  $('#uploads').classList.add('hidden'); $('#upList').innerHTML = ''; maybeHide();
};
window.addEventListener('beforeunload', e => { if (active || queue.length) { e.preventDefault(); e.returnValue = ''; } });
const uploadBase = () => S.view === 'drive' && !S.q ? S.path : '';
$('#fileInput').onchange = e => { const fs = [...e.target.files].map(f => ({file: f, rel: f.name})); e.target.value = ''; if (S.view !== 'drive') go('drive'); enqueue(fs, uploadBase()); };
$('#dirInput').onchange = e => { const fs = [...e.target.files].map(f => ({file: f, rel: f.webkitRelativePath || f.name})); e.target.value = ''; if (S.view !== 'drive') go('drive'); enqueue(fs, uploadBase()); };

/* arrastrar y soltar desde el escritorio (tambien carpetas) */
async function readEntries(entry, prefix, out) {
  if (entry.isFile) { await new Promise(r => entry.file(f => { out.push({file: f, rel: prefix + f.name}); r(); }, r)); return; }
  if (entry.isDirectory) {
    const reader = entry.createReader(); let batch;
    do { batch = await new Promise(r => reader.readEntries(r, () => r([]))); for (const e of batch) await readEntries(e, prefix + entry.name + '/', out); } while (batch.length);
  }
}
(() => {
  const main = $('.main'); let depth = 0;
  const ext = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  main.addEventListener('dragenter', e => { if (!ext(e) || S.view !== 'drive') return; depth++; $('#dropHint').classList.remove('hidden'); });
  main.addEventListener('dragleave', e => { if (!ext(e)) return; if (--depth <= 0) { depth = 0; $('#dropHint').classList.add('hidden'); } });
  main.addEventListener('dragover', e => { if (ext(e) && S.view === 'drive') e.preventDefault(); });
  main.addEventListener('drop', async e => {
    if (!ext(e) || S.view !== 'drive') return; e.preventDefault(); depth = 0; $('#dropHint').classList.add('hidden');
    const out = [], entries = [...e.dataTransfer.items].map(i => i.webkitGetAsEntry?.()).filter(Boolean);
    if (entries.length) { for (const en of entries) await readEntries(en, '', out); }
    else [...e.dataTransfer.files].forEach(f => out.push({file: f, rel: f.name}));
    enqueue(out, uploadBase());
  });
})();

/* ---------- usuarios (admin) ---------- */
async function renderUsers() {
  crumbs(); $('#emptyTrash').classList.add('hidden'); updateSel();
  const {users} = await api('/api/admin/users');
  updateBadge(users.filter(u => u.status === 'pending').length);
  const st = {approved: 'Aprobado', pending: 'Pendiente', blocked: 'Bloqueado'};
  $('#content').innerHTML = `<div style="display:flex;justify-content:flex-end;margin:12px 0 4px"><button class="btn primary" id="addUser">${ic('plus')} Crear usuario</button></div><div class="tablewrap"><table class="list users"><thead><tr><th>Usuario</th><th>Estado</th><th>Rol</th><th>Usado</th><th>Cuota (GB, 0 = sin límite)</th><th></th></tr></thead><tbody>` +
    users.map(u => `<tr data-id="${u.id}"><td><div style="display:flex;align-items:center;gap:10px">${avatarHtml(u.username, u.avatar, 'sm')}<b>${esc(u.username)}</b></div></td><td><span class="pill ${u.status}">${st[u.status]}</span></td>
      <td><select data-f="role"><option value="0">Usuario</option><option value="1" ${u.is_admin ? 'selected' : ''}>Admin</option></select></td>
      <td class="c-m">${fmtSize(u.used)}</td>
      <td><input data-f="quota" type="number" min="0" step="0.5" value="${+(u.quota / 1073741824).toFixed(2)}"></td>
      <td><div class="acts">${u.status !== 'approved' ? '<button class="btn small primary" data-a="approve">Aprobar</button>' : '<button class="btn small" data-a="block">Bloquear</button>'}
      <button class="btn small" data-a="pass">Contraseña</button><button class="btn small danger" data-a="del">Eliminar</button></div></td></tr>`).join('') + `</tbody></table></div>
    <p class="c-m" style="margin-top:16px">Los nuevos registros quedan <b>pendientes</b> hasta que los apruebes aquí.</p>`;
  $('#addUser').onclick = addUserDialog;
  const upd = async (id, body) => { try { await api('/api/admin/users/' + id, {json: body}); toast('Guardado'); renderUsers(); } catch (e) { toast(e.message); renderUsers(); } };
  $$('.users tr[data-id]').forEach(tr => {
    const id = tr.dataset.id, name = tr.querySelector('b').textContent;
    tr.querySelector('[data-f="role"]').onchange = e => upd(id, {is_admin: e.target.value === '1'});
    tr.querySelector('[data-f="quota"]').onchange = e => upd(id, {quota_gb: parseFloat(e.target.value.replace(',', '.')) || 0});
    tr.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      const a = b.dataset.a;
      if (a === 'approve') upd(id, {status: 'approved'});
      if (a === 'block') upd(id, {status: 'blocked'});
      if (a === 'pass') { const pw = await promptDialog('Nueva contraseña para ' + name, '', 'Guardar'); if (pw) upd(id, {password: pw}); }
      if (a === 'del') {
        const p = dialog(`<h3>Eliminar a ${esc(name)}</h3><p>Se eliminará la cuenta. Si no borras sus archivos, se apartan a la carpeta <code>archivo/</code> de los datos para que una cuenta nueva con el mismo nombre no los vea.</p><label><input type="checkbox" id="delFiles" style="width:auto"> Borrar también todos sus archivos del disco</label>
          <div class="actions"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="delOk">Eliminar</button></div>`);
        $('#delOk').onclick = async () => { const f = $('#delFiles').checked ? 1 : 0; closeDialog(); try { const r = await api(`/api/admin/users/${id}?files=${f}`, {method: 'DELETE'}); toast(r && r.archived ? 'Eliminado. Archivos guardados en archivo/' + r.archived : 'Eliminado'); renderUsers(); } catch (e) { toast(e.message); } };
        await p;
      }
    });
  });
}

async function addUserDialog() {
  const p = dialog(`<h3>Crear usuario</h3><form id="nuf">
    <label>Usuario</label><input id="nuName" autocapitalize="none" autocomplete="off" required>
    <label>Contraseña (mínimo 6 caracteres)</label><input id="nuPass" type="text" autocomplete="off" required>
    <label>Cuota en GB (0 = sin límite)</label><input id="nuQuota" type="number" min="0" step="0.5" value="0">
    <label style="display:flex;align-items:center;gap:8px"><input id="nuAdmin" type="checkbox" style="width:auto"> Administrador</label>
    <div class="actions"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary">Crear</button></div></form>`);
  $('#nuf').onsubmit = async e => {
    e.preventDefault();
    try {
      await api('/api/admin/users', {json: {username: $('#nuName').value.trim(), password: $('#nuPass').value,
        quota_gb: parseFloat($('#nuQuota').value.replace(',', '.')) || 0, is_admin: $('#nuAdmin').checked}});
      toast('Usuario creado'); closeDialog(); renderUsers();
    } catch (err) { toast(err.message); }
  };
  return p;
}

/* ---------- estado de la Pi ---------- */
function setBar(id, pct, warn = 75, crit = 90) { const b = $(id); b.style.width = Math.min(100, Math.max(0, pct)) + '%'; b.className = pct >= crit ? 'crit' : pct >= warn ? 'warn' : ''; }
async function loadStats() {
  try {
    const s = await api('/api/stats');
    LIVE.push({t: Date.now(), cpu: s.cpu, mem: s.mem ? s.mem.used / s.mem.total * 100 : null, temp: s.temp});
    if (LIVE.length > 60) LIVE.shift();
    if (S.view === 'panel') paintLive();
    $('#stUser').textContent = fmtSize(s.used) + (s.quota ? ' de ' + fmtSize(s.quota) : '');
    setBar('#barUser', s.quota ? s.used / s.quota * 100 : 0);
    $('#stDisk').textContent = fmtSize(s.disk.free) + ' libres'; setBar('#barDisk', s.disk.used / s.disk.total * 100);
    if (s.cpu != null) { $('#stCpu').textContent = Math.round(s.cpu) + '%'; setBar('#barCpu', s.cpu); }
    if (s.temp != null) { $('#stTemp').textContent = s.temp.toFixed(1).replace('.', ',') + ' °C'; setBar('#barTemp', (s.temp - 30) / 55 * 100, 60, 80); }
    else $('#stTemp').closest('.stat').classList.add('hidden');
    if (s.mem) { $('#stMem').textContent = fmtSize(s.mem.used) + ' / ' + fmtSize(s.mem.total); setBar('#barMem', s.mem.used / s.mem.total * 100); }
  } catch (e) {}
}
let statsTick = 0;
setInterval(() => { statsTick++; if (!document.hidden && S.me && (S.view === 'panel' || statsTick % 2 === 0)) loadStats(); }, 5000);

/* ---------- barra superior, menus y tema ---------- */
$('#newBtn').onclick = () => $('#newMenu').classList.toggle('hidden');
$('#newMenu').onclick = e => {
  const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return; $('#newMenu').classList.add('hidden'); closeSidebar();
  if (a === 'upload') $('#fileInput').click(); if (a === 'uploadDir') $('#dirInput').click(); if (a === 'mkdir') mkdirDialog();
};
$('#quickBtn').onclick = () => { $('#userMenu').classList.add('hidden'); $('#quickMenu').classList.toggle('hidden'); };
$('#quickMenu').onclick = e => {
  const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return; $('#quickMenu').classList.add('hidden');
  if (a === 'upload') $('#fileInput').click(); if (a === 'uploadDir') $('#dirInput').click(); if (a === 'mkdir') mkdirDialog();
  if (['panel', 'recent', 'shared', 'trash'].includes(a)) go(a);
  if (a === 'webdav') webdavDialog();
  if (a === 'reload') { load(); loadStats(); toast('Actualizado', 1200); }
};
$('#userBtn').onclick = () => { $('#quickMenu').classList.add('hidden'); $('#userMenu').classList.toggle('hidden'); };
$('#userMenu').onclick = async e => {
  const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return; $('#userMenu').classList.add('hidden');
  if (a === 'logout') { await api('/api/logout', {method: 'POST'}); S.me = null; showAuth(); }
  if (a === 'webdav') webdavDialog(); if (a === 'password') passwordDialog();
  if (a === 'avatar') $('#avatarInput').click();
  if (a === 'avatarDel') { await api('/api/avatar', {method: 'DELETE'}); S.me.avatar = 0; paintAvatars(); toast('Foto quitada'); }
};
$('#nav').onclick = e => { const a = e.target.closest('[data-view]'); if (a) go(a.dataset.view); };
$('#gridBtn').onclick = () => setMode('grid'); $('#listBtn').onclick = () => setMode('list');
function setMode(m) { S.mode = m; try { localStorage.setItem('dp-mode', m); } catch (e) {} if (S.view !== 'users' && S.view !== 'panel') render(); }
let searchT;
$('#search').addEventListener('input', e => { clearTimeout(searchT); searchT = setTimeout(() => {
  S.q = e.target.value.trim(); if (S.q && (S.view === 'users' || S.view === 'trash' || S.view === 'shared' || S.view === 'panel')) { S.view = 'drive'; $$('#nav a').forEach(a => a.classList.remove('active')); }
  if (!S.q) return route(); load(); }, 300); });
const THEMES = ['auto', 'light', 'dark'], TNAME = {auto: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: oscuro'}, TICON = {auto: 'auto', light: 'sun', dark: 'moon'};
function paintTheme() { const t = document.documentElement.dataset.theme || 'auto'; const b = $('#themeBtn'); b.title = TNAME[t]; b.innerHTML = ic(TICON[t]); }
$('#themeBtn').onclick = () => { const t = THEMES[(THEMES.indexOf(document.documentElement.dataset.theme || 'auto') + 1) % 3]; document.documentElement.dataset.theme = t; try { localStorage.setItem('dp-theme', t); } catch (e) {} paintTheme(); toast(TNAME[t], 1500); };
$('#menuBtn').onclick = () => { $('#sidebar').classList.add('open'); $('#scrim').classList.remove('hidden'); };
$('#scrim').onclick = closeSidebar;
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').classList.add('hidden'); }

/* ---------- panel de actividad (graficos) ---------- */
const LIVE = [];
const KIND_NAME = {folder:'Carpetas', image:'Imágenes', video:'Vídeos', audio:'Audio', pdf:'PDF', archive:'Comprimidos', doc:'Documentos',
  sheet:'Hojas de cálculo', slides:'Presentaciones', text:'Texto y código', file:'Otros'};
const KIND_ONE = {image:'Imagen', video:'Vídeo', audio:'Audio', pdf:'Documento PDF', archive:'Archivo comprimido', doc:'Documento',
  sheet:'Hoja de cálculo', slides:'Presentación', text:'Texto o código', file:'Archivo'};
const ACT = {upload:['cloudUp','Subido'], mkdir:['folderAdd','Carpeta creada'], rename:['edit','Nombre cambiado'], move:['move','Movido'],
  delete:['trash','Enviado a la papelera'], restore:['restore','Restaurado'], purge:['forever','Borrado para siempre'], share:['share','Compartido']};
const fmtNum = n => (n || 0).toLocaleString('es-ES');
function ago(t) {
  const s = Date.now() / 1000 - t;
  if (s < 60) return 'ahora'; if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h';
  if (s < 7 * 86400) { const d = Math.floor(s / 86400); return d === 1 ? 'ayer' : 'hace ' + d + ' días'; }
  return new Date(t * 1000).toLocaleDateString('es-ES', {day: 'numeric', month: 'short'});
}
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
let panelMode = (() => { try { return localStorage.getItem('dp-panel-mode') || 'count'; } catch (e) { return 'count'; } })();
let panelData = null;

async function renderPanel() {
  crumbs(); $('#emptyTrash').classList.add('hidden'); updateSel();
  const c = $('#content');
  if (!panelData) c.innerHTML = `<div class="empty">Calculando…</div>`;
  let d;
  try { d = await api('/api/dashboard'); } catch (e) { c.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (S.view !== 'panel') return;
  panelData = d;
  if (d.history && LIVE.length < d.history.length) { LIVE.length = 0; d.history.forEach(h => LIVE.push(h)); }
  const up30 = d.uploads.reduce((a, x) => a + x.size, 0), upN = d.uploads.reduce((a, x) => a + x.count, 0);
  const kpi = (icon, v, l) => `<div class="card kpi c3"><div class="k-ic">${ic(icon)}</div><div><div class="k-v">${v}</div><div class="k-l">${l}</div></div></div>`;
  c.innerHTML = `<div class="dash">
    ${kpi('file', fmtNum(d.files), `archivos en ${fmtNum(d.folders)} carpetas`)}
    ${kpi('storage', fmtSize(d.used), d.quota ? `usados de ${fmtSize(d.quota)} (${Math.round(d.used / d.quota * 100)} %)` : 'usados (sin límite)')}
    ${kpi('cloudUp', fmtSize(up30), `subidos en 30 días (${fmtNum(upN)} archivos)`)}
    ${kpi('trash', fmtSize(d.trash.size), `en la papelera · ${fmtNum(d.shares)} ${d.shares === 1 ? "compartido" : "compartidos"}`)}

    <div class="card c8"><div class="card-head"><div><h4>Archivos subidos por día</h4><div class="sub">Últimos 30 días</div></div>
      <div class="seg" id="upMode"><button data-m="count">Archivos</button><button data-m="size">Tamaño</button></div></div>
      <div id="upChart"></div></div>
    <div class="card c4"><h4>Uso del disco</h4><div class="sub">${fmtSize(d.disk.total)} en total · ${fmtSize(d.disk.free)} libres</div>${spaceDonut(d)}</div>

    <div class="card c6"><h4>Tipos de archivo</h4><div class="sub">Cuánto ocupa cada tipo</div>${kindBars(d.kinds)}</div>
    <div class="card c6"><h4>Estado de la Raspberry Pi</h4><div class="sub">En directo, se actualiza cada 5 segundos</div><div id="liveBox"></div></div>

    <div class="card c7"><h4>Actividad reciente</h4><div class="sub">Lo último que has hecho</div>${actionChips(d.actions)}${feedHtml(d.recent)}</div>
    <div class="card c5"><h4>Archivos más grandes</h4><div class="sub">Los que más espacio ocupan</div>${largestHtml(d.largest)}</div>
    ${d.users ? `<div class="card c12"><h4>Espacio por usuario</h4><div class="sub">Solo lo ven los administradores</div>${usersBars(d.users)}</div>` : ''}
  </div><div class="dash-foot">Actualizado ${new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'})}</div>`;
  paintUploads(); paintLive();
  $('#upMode').onclick = e => { const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return; panelMode = m; try { localStorage.setItem('dp-panel-mode', m); } catch (er) {} paintUploads(); };
  c.querySelectorAll('[data-open]').forEach(el => el.onclick = () => { const p = el.dataset.open; go('drive', p.split('/').slice(0, -1).join('/')); });
}

function paintUploads() {
  const d = panelData, box = $('#upChart'); if (!box) return;
  $$('#upMode button').forEach(b => b.classList.toggle('on', b.dataset.m === panelMode));
  const key = panelMode, vals = d.uploads.map(x => x[key]), max = niceMax(Math.max(...vals));
  const lab = v => key === 'size' ? fmtSize(v).replace(/,0 /, ' ') : fmtNum(v);
  const grid = [0.5, 1].map(f => `<div class="gl" style="bottom:${f * 100}%"><span>${lab(max * f)}</span></div>`).join('') + `<div class="gl" style="bottom:0;border:0"><span>0</span></div>`;
  const day = s => new Date(s + 'T12:00:00').toLocaleDateString('es-ES', {weekday: 'short', day: 'numeric', month: 'short'});
  const bars = d.uploads.map(x => `<div class="b ${x[key] ? '' : 'zero'}" data-tip="<div class='tt'>${esc(day(x.day))}</div><b>${fmtNum(x.count)}</b> archivos · <b>${fmtSize(x.size)}</b>"><div style="height:${x[key] / max * 100}%"></div></div>`).join('');
  const sh = s => new Date(s + 'T12:00:00').toLocaleDateString('es-ES', {day: 'numeric', month: 'short'});
  const u = d.uploads;
  box.innerHTML = `<div class="vbars">${grid}${bars}</div><div class="xlab"><span>${sh(u[0].day)}</span><span>${sh(u[Math.floor(u.length / 2)].day)}</span><span>Hoy</span></div>` +
    (vals.some(Boolean) ? '' : `<div class="dash-empty">No has subido nada en los últimos 30 días.</div>`);
}

function spaceDonut(d) {
  const tot = (d.disk.used + d.disk.free) || 1, mine = Math.min(d.used, d.disk.used), other = Math.max(0, d.disk.used - mine);
  const segs = [['Mis archivos', mine, 'var(--s1)'], ['Otros datos del disco', other, 'var(--s2)'], ['Libre', d.disk.free, 'var(--free)']];
  const R = 60, C = 2 * Math.PI * R, gap = 2;
  let off = 0;
  const arcs = segs.map(([n, v, col]) => {
    const len = v / tot * C; const a = `<circle r="${R}" cx="75" cy="75" stroke="${col}" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}"><title>${n}: ${fmtSize(v)}</title></circle>`;
    off += len; return len > 0 ? a : '';
  }).join('');
  return `<div class="donut-row"><div class="donut"><svg viewBox="0 0 150 150">${arcs}</svg><div class="mid"><b>${Math.round(d.disk.used / tot * 100)} %</b><span>ocupado</span></div></div>
    <div class="legend">${segs.map(([n, v, col]) => `<div><i class="sw" style="background:${col}"></i>${n}<b>${fmtSize(v)}</b></div>`).join('')}</div></div>`;
}

function hbars(rows) {
  const max = Math.max(1, ...rows.map(r => r.v));
  return `<div class="hbars">${rows.map(r => `<div class="hb" data-tip="${esc(r.tip)}"><div class="l">${r.icon}<span>${esc(r.label)}</span></div><div class="track"><div style="width:${r.v / max * 100}%"></div></div><div class="v">${r.vl}</div></div>`).join('')}</div>`;
}
function kindBars(kinds) {
  if (!kinds.length) return `<div class="dash-empty">Todavía no hay archivos.</div>`;
  const top = kinds.slice(0, 7), rest = kinds.slice(7);
  if (rest.length) top.push({kind: 'file', count: rest.reduce((a, k) => a + k.count, 0), size: rest.reduce((a, k) => a + k.size, 0), other: true});
  return hbars(top.map(k => ({label: k.other ? 'Resto' : KIND_NAME[k.kind] || k.kind, icon: ic(k.kind, 'ic-' + k.kind), v: k.size, vl: fmtSize(k.size),
    tip: `<div class='tt'>${KIND_NAME[k.kind] || k.kind}</div><b>${fmtNum(k.count)}</b> archivos · <b>${fmtSize(k.size)}</b>`})));
}
function usersBars(users) {
  return hbars(users.map(u => ({label: u.username, icon: avatarHtml(u.username, u.avatar, 'sm'), v: u.used, vl: fmtSize(u.used),
    tip: `<div class='tt'>${esc(u.username)}</div><b>${fmtSize(u.used)}</b>${u.quota ? ' de ' + fmtSize(u.quota) : ' (sin límite)'}`})));
}
function actionChips(a) {
  const ks = Object.keys(ACT).filter(k => a[k]);
  if (!ks.length) return '';
  return `<div class="chips">${ks.map(k => `<span class="chip">${ACT[k][1]}: <b>${fmtNum(a[k])}</b></span>`).join('')}<span class="chip">en 30 días</span></div>`;
}
function feedHtml(rows) {
  if (!rows.length) return `<div class="dash-empty">Aún no hay actividad. Aquí verás lo que vayas subiendo, moviendo o borrando.</div>`;
  return `<div class="feed">${rows.map(r => { const [icon, label] = ACT[r.action] || ['file', r.action]; const name = r.path.split('/').pop();
    return `<div class="f" title="${esc(r.path)}"><div class="a-ic">${ic(icon, r.action === 'upload' ? 'ic-' + r.kind : '')}</div><div class="t"><div>${esc(name || '/')}</div><small>${label}${r.size ? ' · ' + fmtSize(r.size) : ''}</small></div><div class="when">${ago(r.at)}</div></div>`; }).join('')}</div>`;
}
function largestHtml(rows) {
  if (!rows.length) return `<div class="dash-empty">Todavía no hay archivos.</div>`;
  return `<div class="feed">${rows.map(r => `<div class="f" data-open="${esc(r.path)}" style="cursor:pointer" title="Abrir su carpeta: ${esc(r.path)}"><div class="a-ic">${ic(r.kind, 'ic-' + r.kind)}</div><div class="t"><div>${esc(r.name)}</div><small>${esc('/' + r.path.split('/').slice(0, -1).join('/'))}</small></div><div class="when"><b>${fmtSize(r.size)}</b></div></div>`).join('')}</div>`;
}

function paintLive() {
  const box = $('#liveBox'); if (!box) return;
  const pts = LIVE.slice(-60), n = 60;
  const last = pts[pts.length - 1] || {};
  const line = (k, col) => {
    const p = pts.map((x, i) => x[k] == null ? null : [((n - pts.length + i) / (n - 1)) * 100, 100 - Math.max(0, Math.min(100, x[k]))]).filter(Boolean);
    return p.length ? `<path d="M${p.map(q => q.join(',')).join('L')}" stroke="${col}"/>` : '';
  };
  const grid = [0, 50, 100].map(v => `<div class="gl" style="top:${100 - v}%"><span>${v}%</span></div>`).join('');
  box.innerHTML = `<div class="live" id="liveChart">${grid}<svg viewBox="0 0 100 100" preserveAspectRatio="none">${line('cpu', 'var(--s1)')}${line('mem', 'var(--s2)')}</svg><div class="cross hidden"></div></div>
    <div class="live-legend"><span><i class="ln" style="background:var(--s1)"></i>CPU <b>${last.cpu != null ? Math.round(last.cpu) + ' %' : '—'}</b></span>
    <span><i class="ln" style="background:var(--s2)"></i>RAM <b>${last.mem != null ? Math.round(last.mem) + ' %' : '—'}</b></span>
    ${last.temp != null ? `<span>Temperatura <b>${last.temp.toFixed(1).replace('.', ',')} °C</b></span>` : ''}
    ${pts.length < 3 ? '<span>Recogiendo datos…</span>' : ''}</div>`;
  const ch = $('#liveChart'), cross = ch.querySelector('.cross');
  ch.onmousemove = e => {
    const r = ch.getBoundingClientRect(), f = (e.clientX - r.left) / r.width, i = Math.round(f * (n - 1)) - (n - pts.length);
    const x = pts[i]; if (!x) { cross.classList.add('hidden'); hideTip(); return; }
    cross.classList.remove('hidden'); cross.style.left = ((n - pts.length + i) / (n - 1) * 100) + '%';
    showTip(`<div class='tt'>${new Date(x.t).toLocaleTimeString('es-ES')}</div>CPU <b>${x.cpu != null ? Math.round(x.cpu) + ' %' : '—'}</b> · RAM <b>${x.mem != null ? Math.round(x.mem) + ' %' : '—'}</b>${x.temp != null ? ` · <b>${x.temp.toFixed(1).replace('.', ',')} °C</b>` : ''}`, e);
  };
  ch.onmouseleave = () => { cross.classList.add('hidden'); hideTip(); };
}

/* tooltip comun de los graficos */
const tipEl = Object.assign(document.createElement('div'), {className: 'viz-tip hidden'}); document.body.appendChild(tipEl);
function showTip(html, e) {
  tipEl.innerHTML = html; tipEl.classList.remove('hidden');
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  tipEl.style.left = Math.max(8, Math.min(e.clientX + 14, innerWidth - w - 8)) + 'px';
  tipEl.style.top = (e.clientY - h - 12 < 8 ? e.clientY + 16 : e.clientY - h - 12) + 'px';
}
function hideTip() { tipEl.classList.add('hidden'); }
document.addEventListener('mousemove', e => { if (e.target.closest?.('#liveChart')) return; const t = e.target.closest?.('[data-tip]'); t ? showTip(t.dataset.tip, e) : hideTip(); });
document.addEventListener('touchstart', e => { const t = e.target.closest?.('[data-tip]'); if (t) { const p = e.touches[0]; showTip(t.dataset.tip, {clientX: p.clientX, clientY: p.clientY}); } else hideTip(); }, {passive: true});

/* ---------- propiedades (como en Windows) ---------- */
async function propsDialog(items) {
  if (!items.length) return;
  const one = items.length === 1 ? items[0] : null;
  const title = one ? esc(one.name) : items.length + ' elementos';
  const icon = one ? ic(one.dir ? 'folder' : one.kind, 'ic-' + (one.dir ? 'folder' : one.kind)) : ic('file', 'ic-file');
  const p = dialog(`<div class="props"><div class="props-head">${icon}<b>${title}</b></div><div id="propsBody"><div class="calc">Calculando el tamaño…</div></div>
    <div class="actions"><button class="btn primary" data-close>Cerrar</button></div></div>`);
  let q;
  if (S.view === 'shared' && !S.share) q = one ? `paths=&share=${one.share_id}` : null;
  else q = items.map(i => 'paths=' + enc(i.path)).join('&') + shareQ();
  if (!q) { $('#propsBody').innerHTML = '<p>Elige un solo elemento.</p>'; return p; }
  try {
    const r = await api('/api/props?' + q);
    const body = $('#propsBody'); if (!body) return p;
    const rows = [];
    if (one) rows.push(['Tipo', r.dir ? 'Carpeta' : KIND_ONE[r.kind] || 'Archivo']);
    if (one && r.location != null) rows.push(['Ubicación', esc(r.location)]);
    rows.push(['Tamaño', `<b>${fmtSize(r.size)}</b> <span class="c-m">(${fmtNum(r.size)} bytes)</span>`]);
    if (!one || r.dir) rows.push(['Contiene', `${fmtNum(r.files)} archivos, ${fmtNum(r.folders)} carpetas`]);
    if (one) rows.push(['Modificado', fmtDate(r.mtime)], ['Añadido', fmtDate(r.ctime)]);
    let kinds = '';
    if ((!one || r.dir) && r.kinds.length) {
      kinds = `<label>Qué hay dentro</label>` + hbars(r.kinds.slice(0, 6).map(k => ({label: KIND_NAME[k.kind] || k.kind, icon: ic(k.kind, 'ic-' + k.kind), v: k.size, vl: fmtSize(k.size),
        tip: `<div class='tt'>${KIND_NAME[k.kind] || k.kind}</div><b>${fmtNum(k.count)}</b> archivos · <b>${fmtSize(k.size)}</b>`})));
    }
    body.innerHTML = `<dl>${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>${kinds}`;
  } catch (e) { const b = $('#propsBody'); if (b) b.innerHTML = `<p>${esc(e.message)}</p>`; }
  return p;
}

paintIcons(); paintTheme(); start(); restoreFailed();
