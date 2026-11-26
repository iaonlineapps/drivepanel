'use strict';
/* DrivePanel - descargar carpetas tal cual (sin .zip)
   Igual que al subir una carpeta, pero al revés: se bajan los archivos uno a uno y se
   vuelven a crear sus subcarpetas en el equipo.
   - Chrome y Edge en el ordenador: se elige una carpeta del equipo y se escribe ahí
     directamente (File System Access API). Lo que ya esté con el mismo tamaño se salta, así
     que si se corta basta con volver a descargarla en el mismo sitio.
   - App de Android (1.6.5 o más nueva): la app pone cada archivo en su panel de descargas y
     los guarda en Descargas/<carpeta>/<subcarpetas> del móvil.
   - Navegador de un móvil Android: ofrece abrirla en la app.
   - Otros navegadores (Firefox, Safari...): se descargan uno detrás de otro, todos juntos.
   El .zip de siempre sigue estando como opción. */

const FS_OK = typeof window.showDirectoryPicker === 'function' && window.isSecureContext !== false;
// Chrome o Edge en el ordenador abriendo DrivePanel por http://IP (sin https): el navegador
// esconde showDirectoryPicker. Se activa una vez con chrome://flags y ya funciona.
const CHROMIUM_PC = !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) && /Chrome\//.test(navigator.userAgent);
const FS_FLAG = !FS_OK && CHROMIUM_PC && window.isSecureContext === false;
const APP_OK = () => !!(window.DPAndroid && typeof window.DPAndroid.downloadFolder === 'function');
const DL_PARALLEL = 3, DL_TRIES = 6;
const DL = {jobs: [], queue: [], active: 0, total: 0, done: 0, skipped: 0, failed: [], bytesTotal: 0, bytesDone: 0,
            samples: [], cancelled: false, title: '', ctrl: new Set()};

function zipUrlOf(items, share) {
  return '/api/zip?' + items.map(i => 'paths=' + enc(i.path)).join('&') + (share ? `&share=${share}` : '');
}
function dlFileUrl(path, share) { return `/api/file?path=${enc(path)}${share ? `&share=${share}` : ''}&download=1`; }

/* Al pulsar Descargar con alguna carpeta (o varios elementos) */
async function downloadFolders(items, opts = {}) {
  const share = opts.share !== undefined ? opts.share : S.share, name = items.length === 1 ? items[0].name || t('Mi unidad') : t('{n} elementos', {n: items.length});
  let tree;
  try { tree = await api('/api/tree?' + items.map(i => 'paths=' + enc(i.path)).join('&') + (share ? `&share=${share}` : '')); }
  catch (e) { return toast(e.message); }
  const nDirs = Math.max(0, tree.dirs.length - items.filter(i => i.dir).length);
  const info = t('{files} archivos en {folders} subcarpetas · {size}', {files: fmtNum(tree.files.length), folders: fmtNum(nDirs), size: fmtSize(tree.size)});
  const zip = zipUrlOf(items, share), zipName = (items.length === 1 ? items[0].name || 'mi-unidad' : 'DrivePanel') + '.zip';
  if (opts.auto && APP_OK()) return toApp(tree, name, share);
  const big = tree.size > 2 * 1024 ** 3 || tree.files.length > 500;
  const opt = (c, icon, title, sub, primary) => `<button class="btn dl-opt${primary ? ' primary' : ''}" data-c="${c}">${ic(icon)}<span><b>${title}</b><small>${sub}</small></span></button>`;
  let main;
  if (APP_OK()) main = opt('app', 'folder', t('Tal cual, con sus subcarpetas'), t('Archivo a archivo, como al subirla. Se guarda en Descargas/{name} del móvil y se ve en el panel de descargas.', {name: esc(name)}), true);
  else if (FS_OK) main = opt('fs', 'folder', t('Tal cual, con sus subcarpetas'), t('Archivo a archivo, como al subirla. Eliges en qué carpeta de tu equipo se guarda. Si se corta, vuelve a descargarla en el mismo sitio y sigue por donde iba.'), true);
  else if (FS_FLAG) main = opt('flag', 'folder', t('Tal cual, con sus subcarpetas'), t('Archivo a archivo, como al subirla. Como entras por http:// (sin candado), Chrome no lo deja hasta que lo actives una vez. Te explico cómo: es un minuto.'), true);
  else if (typeof ANDROID_WEB !== 'undefined' && ANDROID_WEB) main = opt('intent', 'folder', t('Tal cual, con la app DrivePanel'), t('La app la baja archivo a archivo con sus subcarpetas a Descargas/{name}. Necesitas la app 1.6.5 o más nueva.', {name: esc(name)}), true);
  else main = opt('seq', 'download', t('Archivo a archivo (sin subcarpetas)'), t('Este navegador no deja crear carpetas: los archivos se guardan todos juntos en Descargas. Para conservar las subcarpetas usa Chrome o Edge en el ordenador, o la app de Android.'), false);
  const p = dialog(`<h3>${t('Descargar {name}', {name: esc(name)})}</h3><p>${info}</p>
    <div class="choice-list dl-choices">${main}
      ${opt('zip', 'archive', t('En un solo archivo .zip'), big ? t('Lo de siempre, pero con carpetas tan grandes es mejor la opción de arriba: el .zip no se puede continuar si se corta.') : t('Lo de siempre: todo junto en un .zip.'), false)}
    </div><div class="actions"><button class="btn" data-close>${t('Cancelar')}</button></div>`);
  $('#dialogBox').querySelectorAll('[data-c]').forEach(b => b.onclick = () => closeDialog(b.dataset.c));
  const c = await p;
  if (!c) return;
  if (c === 'zip') { if (typeof ANDROID_WEB !== 'undefined' && ANDROID_WEB) return appOrHere(zip, zipName); location.href = zip; return; }
  if (!tree.files.length && c !== 'fs') return toast(t('La carpeta está vacía'));
  if (c === 'app') return toApp(tree, name, share);
  if (c === 'intent') return location.href = folderIntent(items, share, name);
  if (c === 'seq') return sequential(tree, share);
  if (c === 'flag') return flagHelp();
  if (c === 'fs') return toDisk(tree, share, name);
}

/* ---------- Android: la app hace las descargas ---------- */
function toApp(tree, name, share) {
  const files = tree.files.map(f => ({url: new URL(dlFileUrl(f.path, share), location.href).href, rel: f.rel, size: f.size}));
  try { window.DPAndroid.downloadFolder(JSON.stringify({name, files, dirs: tree.dirs})); }
  catch (e) { toast(t('La app no ha podido empezar la descarga') + ': ' + e.message); }
}
// desde el navegador del móvil: abre la app, que carga la web con ?bajar=... y sigue con toApp
function folderIntent(items, share, name) {
  const q = new URLSearchParams(); items.forEach(i => q.append('bajar', i.path)); if (share) q.set('share', share);
  return appIntent(location.origin + '/?' + q.toString(), name);
}
(function autoFromApp() {
  const q = new URLSearchParams(location.search), paths = q.getAll('bajar');
  if (!paths.length) return;
  const share = +q.get('share') || null;
  history.replaceState(null, '', location.pathname + location.hash);
  let n = 0;
  const wait = setInterval(() => {  // cuando ya se ha entrado en la cuenta
    if (++n > 120) return clearInterval(wait);
    if (typeof S === 'undefined' || !S.me) return;
    clearInterval(wait);
    downloadFolders(paths.map(p => ({path: p, name: p.split('/').pop(), dir: true})), {share, auto: true});
  }, 500);
})();

/* ---------- Chrome/Edge por http://: activar la opcion una vez ---------- */
function flagHelp() {
  const edge = /Edg\//.test(navigator.userAgent), flags = (edge ? 'edge' : 'chrome') + '://flags/#unsafely-treat-insecure-origin-as-secure';
  const row = (txt, id) => `<div class="dl-copy"><code>${esc(txt)}</code><button class="btn small" data-copy="${id}">${t('Copiar')}</button></div>`;
  dialog(`<h3>${t('Activar la descarga tal cual en {b}', {b: edge ? 'Edge' : 'Chrome'})}</h3>
    <p>${t('Solo hay que hacerlo una vez en este ordenador.')}</p>
    <ol class="dl-steps">
      <li>${t('Copia esto, pégalo en la barra de direcciones de una pestaña nueva y pulsa Intro:')}${row(flags, 'f')}</li>
      <li>${t('En el recuadro de «Insecure origins treated as secure» pega esta dirección:')}${row(location.origin, 'o')}</li>
      <li>${t('A la derecha cambia «Disabled» por «Enabled» y pulsa el botón «Relaunch» de abajo.')}</li>
      <li>${t('Vuelve aquí y pulsa otra vez Descargar en la carpeta.')}</li>
    </ol>
    <p style="font-size:13px;color:var(--muted)">${t('Esto le dice al navegador que tu DrivePanel de casa es de confianza aunque no tenga https. Solo afecta a esta dirección.')}</p>
    <div class="actions"><button class="btn primary" data-close>${t('Entendido')}</button></div>`);
  $('#dialogBox').querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { copy(b.dataset.copy === 'f' ? flags : location.origin); b.textContent = t('Copiado'); });
}

/* ---------- otros navegadores: uno detrás de otro ---------- */
async function sequential(tree, share) {
  if (tree.files.length > 30 && !await confirmDialog(t('Descargar {n} archivos', {n: fmtNum(tree.files.length)}),
      t('El navegador puede preguntarte si permites descargar varios archivos: di que sí.'), t('Descargar'))) return;
  for (let i = 0; i < tree.files.length; i++) {
    const a = document.createElement('a'); a.href = dlFileUrl(tree.files[i].path, share); a.download = tree.files[i].rel.split('/').pop();
    document.body.appendChild(a); a.click(); a.remove();
    toast(t('Descargando {i} de {n}', {i: i + 1, n: tree.files.length}), 2500);
    await new Promise(r => setTimeout(r, 1200));
  }
}

/* ---------- Chrome / Edge: directo a una carpeta del equipo ---------- */
async function toDisk(tree, share, name) {
  if (DL.active || DL.queue.length) return toast(t('Ya hay una descarga de carpeta en marcha'));
  let root;
  try { root = await window.showDirectoryPicker({id: 'dp-bajar', mode: 'readwrite', startIn: 'downloads'}); }
  catch (e) { if (e.name !== 'AbortError') toast(t('No se ha podido abrir la carpeta del equipo') + ': ' + e.message); return; }
  const dirs = new Map([['', root]]);
  const dirOf = async rel => {  // crea (si no está) la carpeta y sus padres
    if (dirs.has(rel)) return dirs.get(rel);
    const i = rel.lastIndexOf('/'), parent = await dirOf(i < 0 ? '' : rel.slice(0, i));
    const h = await parent.getDirectoryHandle(rel.slice(i + 1), {create: true}); dirs.set(rel, h); return h;
  };
  try { for (const d of tree.dirs) await dirOf(d); }
  catch (e) { return toast(t('No se ha podido crear la carpeta en tu equipo') + ': ' + e.message); }
  Object.assign(DL, {queue: [], active: 0, total: tree.files.length, done: 0, skipped: 0, failed: [], bytesTotal: tree.size,
                     bytesDone: 0, samples: [], cancelled: false, title: name, root: root.name, started: Date.now()});
  $('#dlList').innerHTML = '';
  tree.files.forEach(f => DL.queue.push({...f, share, dirOf}));
  $('#dlPanel').classList.remove('hidden', 'min', 'finished');
  dlUpdate(); dlPump();
}

function dlPump() {
  while (!DL.cancelled && DL.active < DL_PARALLEL && DL.queue.length) {
    const job = DL.queue.shift(); DL.active++;
    dlOne(job).then(res => {
      DL.active--;
      if (res.ok) { if (res.skipped) DL.skipped++; else DL.done++; }
      else if (!DL.cancelled) DL.failed.push({...job, error: res.error});
      dlUpdate(); dlPump();
    });
  }
  if (!DL.active && !DL.queue.length) dlFinish();
}

function dlRow(job) {
  const row = document.createElement('div'); row.className = 'up-item';
  row.innerHTML = `<div class="r"><span class="ell" title="${esc(job.rel)}">${esc(job.rel)}</span><span class="st">0%</span></div><div class="bar"><div></div></div>`;
  $('#dlList').prepend(row); return row;
}

async function dlOne(job) {
  const i = job.rel.lastIndexOf('/'), fname = job.rel.slice(i + 1);
  let dir;
  try { dir = await job.dirOf(i < 0 ? '' : job.rel.slice(0, i)); } catch (e) { return {ok: false, error: e.message}; }
  // si ya está con el mismo tamaño, se salta (así se puede continuar una descarga cortada)
  try { const old = await (await dir.getFileHandle(fname)).getFile(); if (old.size === job.size) { DL.bytesDone += job.size; return {ok: true, skipped: true}; } } catch (e) { /* no está */ }
  job.row = job.row || dlRow(job); DL.current = job.rel;
  const st = job.row.querySelector('.st'), bar = job.row.querySelector('.bar div');
  job.row.classList.remove('failed'); st.className = 'st';
  let w, offset = 0, tries = 0;
  try { w = await (await dir.getFileHandle(fname, {create: true})).createWritable(); }
  catch (e) { return dlFail(job, e.message); }
  const ctrl = new AbortController(); DL.ctrl.add(ctrl);
  try {
    while (true) {
      if (DL.cancelled) throw new DOMException('cancel', 'AbortError');
      let r;
      try {
        r = await fetch(dlFileUrl(job.path, job.share), {credentials: 'same-origin', signal: ctrl.signal, headers: offset ? {Range: `bytes=${offset}-`} : {}});
        if (offset && r.status === 200) { await w.truncate(0); await w.seek(0); DL.bytesDone -= offset; offset = 0; }  // el servidor no sigue: desde el principio
        if (!r.ok) { const err = new Error(r.status === 404 ? t('Ya no existe en el servidor') : `Error ${r.status}`); err.fatal = r.status === 404 || r.status === 401 || r.status === 403; throw err; }
        const rd = r.body.getReader();
        while (true) {
          const {done, value} = await rd.read();
          if (done) break;
          await w.write(value); offset += value.length; DL.bytesDone += value.length; tries = 0;
          const pct = job.size ? offset / job.size * 100 : 100; bar.style.width = pct + '%'; st.textContent = Math.floor(pct) + '%';
        }
        if (offset < job.size) throw new Error(t('Error de red'));
        break;
      } catch (e) {
        if (e.name === 'AbortError' || e.fatal || ++tries >= DL_TRIES) throw e;
        const wait = [2, 5, 10, 20, 40][tries - 1] || 60;
        for (let s = wait; s > 0 && !DL.cancelled; s--) { st.textContent = t('Error de red') + '. ' + t('Reintento {i}/{n} en {s}s', {i: tries, n: DL_TRIES - 1, s}); await new Promise(z => setTimeout(z, 1000)); }
      }
    }
    await w.close();
  } catch (e) {
    try { await w.abort(); } catch (x) {}
    DL.bytesDone -= offset;
    DL.ctrl.delete(ctrl);
    if (DL.cancelled) { dropDlRow(job.row); return {ok: false}; }
    return dlFail(job, e.message === 'Failed to fetch' ? t('Error de red') : e.message);
  }
  DL.ctrl.delete(ctrl);
  st.textContent = t('Listo'); st.className = 'st ok'; bar.style.width = '100%';
  const row = job.row; setTimeout(() => { row.classList.add('fade'); setTimeout(() => dropDlRow(row), 400); }, 1200);
  return {ok: true};
}
function dlFail(job, error) {
  if (job.row) { const st = job.row.querySelector('.st'); st.textContent = error; st.className = 'st err'; job.row.querySelector('.bar div').className = 'crit'; job.row.classList.add('failed'); }
  return {ok: false, error};
}
function dropDlRow(row) { row && row.parentNode && row.parentNode.removeChild(row); }

function dlUpdate() {
  const busy = DL.active || DL.queue.length, n = DL.done + DL.skipped + DL.failed.length;
  const parts = [busy ? t('Descargando {i} de {n}', {i: Math.min(n + 1, DL.total), n: fmtNum(DL.total)}) : t('{n} descargados', {n: fmtNum(DL.done)})];
  if (DL.skipped) parts.push(t('{n} ya estaban', {n: fmtNum(DL.skipped)}));
  if (DL.failed.length) parts.push(t('{n} con error', {n: DL.failed.length}));
  $('#dlTitle').textContent = parts.join(' · ');
  $('#dlTitle').title = DL.title;
  $('#dlTotalBar').style.width = (DL.bytesTotal ? DL.bytesDone / DL.bytesTotal * 100 : 100) + '%';
  const nf = DL.failed.length;
  $('#dlFailBox').classList.toggle('hidden', !nf || busy);
  $('#dlFailCount').textContent = nf === 1 ? t('1 archivo no se ha podido descargar') : t('{n} archivos no se han podido descargar', {n: nf});
}
setInterval(() => {
  const busy = DL.active || DL.queue.length, box = $('#dlSpeed');
  if (!box) return;
  if (!busy) { box.classList.add('hidden'); DL.samples.length = 0; return; }
  box.classList.remove('hidden');
  const r = rateOf(DL.samples, Date.now(), DL.bytesDone), left = Math.max(0, DL.bytesTotal - DL.bytesDone);
  $('#dlPct').textContent = Math.floor(DL.bytesTotal ? Math.min(100, DL.bytesDone / DL.bytesTotal * 100) : 0) + '%';
  $('#dlWhere').textContent = DL.root ? `${DL.root}/${DL.title}` : DL.title;
  $('#dlNow').textContent = DL.current || '…'; $('#dlNow').title = DL.current || '';
  $('#dlRate').textContent = r == null ? t('Midiendo velocidad…') : fmtRate(r);
  $('#dlEta').textContent = r ? fmtEta(left / r) || '—' : t('Calculando…');
  $('#dlLeft').textContent = `${fmtNum(Math.max(0, DL.total - DL.done - DL.skipped - DL.failed.length))} (${fmtSize(left)})`;
  $('#dlBytes').textContent = t('{a} de {b}', {a: fmtSize(DL.bytesDone), b: fmtSize(DL.bytesTotal)});
  $('#dlTotalBar').style.width = (DL.bytesTotal ? DL.bytesDone / DL.bytesTotal * 100 : 0) + '%';
}, 1000);

function dlFinish() {
  if (DL.finished === DL.started) return; DL.finished = DL.started;
  dlUpdate(); $('#dlPanel').classList.add('finished');
  if (DL.cancelled) return;
  const secs = Math.round((Date.now() - DL.started) / 1000);
  toast(DL.failed.length ? t('Descarga terminada con {n} errores', {n: DL.failed.length})
    : t('«{name}» descargada: {n} archivos en {time}', {name: DL.title, n: fmtNum(DL.done + DL.skipped), time: fmtEta(secs) || '1 s'}), 5000);
}

$('#dlMin').onclick = () => $('#dlPanel').classList.toggle('min');
$('#dlCancel').onclick = async () => {
  if (!(DL.active || DL.queue.length)) return;
  if (!await confirmDialog(t('Cancelar la descarga'), t('Lo que ya se ha descargado se queda en tu equipo. Si la vuelves a descargar en el mismo sitio, sigue por donde iba.'), t('Cancelar la descarga'))) return;
  DL.cancelled = true; DL.queue.length = 0; DL.ctrl.forEach(c => c.abort());
};
$('#dlClose').onclick = () => {
  if (DL.active || DL.queue.length) { $('#dlPanel').classList.add('min'); return toast(t('La descarga sigue: no cierres esta pestaña')); }
  $('#dlPanel').classList.add('hidden'); $('#dlList').innerHTML = '';
};
$('#dlRetry').onclick = () => {
  const again = DL.failed.splice(0); if (!again.length) return;
  DL.cancelled = false; DL.started = Date.now();
  again.forEach(j => { if (j.row) j.row.querySelector('.st').textContent = t('En cola'); DL.queue.push(j); });
  $('#dlPanel').classList.remove('finished'); dlUpdate(); dlPump();
};
$('#dlCopyFailed').onclick = () => copy(DL.failed.map(f => `${f.rel}\t${f.error}`).join('\n'));
window.addEventListener('beforeunload', e => { if (DL.active || DL.queue.length) { e.preventDefault(); e.returnValue = ''; } });
