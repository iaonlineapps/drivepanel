'use strict';
/* DrivePanel - documentos: ver y editar PDF, Word (.docx), Excel (.xlsx, .csv) y texto.
   Todo se hace en el navegador con las librerías de /static/vendor (se cargan solo al abrir
   un documento). La Raspberry Pi solo guarda el archivo: no hace falta ningún programa extra.
   - PDF: pdf.js. Se puede escribir texto, dibujar o firmar, resaltar, poner imágenes y rellenar formularios.
   - Word: docx-preview para verlo igual que en Word; al editar, mammoth lo pasa a una página
     editable y docx lo vuelve a guardar como .docx.
   - Excel: ExcelJS lee y guarda el .xlsx (solo cambia las celdas que se tocan, el resto del
     formato se queda como estaba) y x-spreadsheet es la hoja editable. CSV con lo mismo. */
const OFFICE = (() => {
  const V = '/static/vendor/';
  const IN_APP = /DrivePanelAndroid\//.test(navigator.userAgent);

  /* iconos que solo usa el editor */
  Object.assign(P, {
    save: 'M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z',
    print: 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z',
    undo: 'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z',
    redo: 'M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z',
    bold: 'M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z',
    italic: 'M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z',
    underline: 'M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z',
    strike: 'M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z',
    alignL: 'M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z',
    alignC: 'M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z',
    alignR: 'M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z',
    alignJ: 'M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z',
    ul: 'M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z',
    ol: 'M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z',
    clearFmt: 'M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z',
    textColor: 'M11 3L5.5 17h2.25l1.12-3h6.25l1.12 3h2.25L13 3h-2zm-1.38 9L12 5.67 14.38 12H9.62z',
    marker: 'M17.75 7L14 3.25l-10 10V17h3.75l10-10zm2.96-2.96a.996.996 0 000-1.41L18.37.29a.996.996 0 00-1.41 0L15 2.25 18.75 6l1.96-1.96zM0 20h24v4H0z',
    table: 'M3 3v18h18V3H3zm8 16H5v-6h6v6zm0-8H5V5h6v6zm8 8h-6v-6h6v6zm0-8h-6V5h6v6z',
    textT: 'M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z',
    pen: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    pointer: 'M13.64 21.97c-.5.24-1.1.03-1.33-.47l-2.18-4.74-2.51 2.02c-.17.14-.38.22-.62.22a1 1 0 01-1-1V3a1 1 0 011-1c.24 0 .47.09.64.23l11.5 9.64c.43.36.48.99.13 1.41-.15.18-.36.3-.57.34l-3.16.62 2.2 4.73c.26.5.02 1.09-.48 1.32l-3.62 1.68z',
    zoomIn: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm2.5-4h-2v2H9v-2H7V9h2V7h1v2h2v1z',
    zoomOut: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z',
    copyFile: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
    docAdd: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z',
  });

  /* ---------- carga de librerías (una vez) ---------- */
  const libs = {};
  function lib(file, global) {
    return libs[file] ||= new Promise((ok, ko) => {
      const s = document.createElement('script'); s.src = V + file;
      // docx-preview y docx usan el mismo nombre global ("docx"): se guarda cada uno al cargarlo
      s.onload = () => ok(global ? window[global] : true);
      s.onerror = () => { delete libs[file]; ko(new Error(t('No se ha podido cargar el editor. Revisa la conexión.'))); };
      document.head.appendChild(s);
    });
  }
  function css(file) {
    if (document.querySelector(`link[data-v="${file}"]`)) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = V + file; l.dataset.v = file; document.head.appendChild(l);
  }
  const DocxPreview = () => lib('jszip.min.js', 'JSZip').then(() => lib('docx-preview.min.js', 'docx'));
  const Mammoth = () => lib('mammoth.browser.min.js', 'mammoth');
  const DocxLib = () => lib('docx.min.js', 'docx');
  const ExcelJS = () => lib('exceljs.min.js', 'ExcelJS');
  async function XS() {
    css('xspreadsheet/xspreadsheet.css');
    const x = await lib('xspreadsheet/xspreadsheet.js', 'x_spreadsheet');
    if (LANG === 'es' && !x.$messages?.es) x.locale('es', XS_ES);
    return x;
  }
  let pdfjs;
  async function PDFJS() {
    if (pdfjs) return pdfjs;
    css('pdfjs/pdf_viewer.css');
    const lib = await import(V + 'pdfjs/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = V + 'pdfjs/pdf.worker.min.mjs';
    await import(V + 'pdfjs/pdf_viewer.min.mjs');
    return (pdfjs = {lib, viewer: globalThis.pdfjsViewer});
  }

  /* ---------- tipos que se pueden abrir ---------- */
  function typeOf(it) {
    if (!it || it.dir) return null;
    const e = extOf(it.name);
    if (e === '.pdf') return 'pdf';
    if (e === '.docx') return 'docx';
    if (e === '.xlsx' || e === '.xlsm') return 'xlsx';
    if (e === '.csv' || e === '.tsv') return 'csv';
    if (it.kind === 'text' && it.size < 2e6) return 'text';
    return null;
  }
  const FORMATS = {pdf: ['.pdf'], docx: ['.docx'], xlsx: ['.xlsx', '.csv'], csv: ['.csv', '.xlsx'], text: []};
  const ICON = {pdf: 'pdf', docx: 'doc', xlsx: 'sheet', csv: 'sheet', text: 'text'};
  const MIME = {'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.csv': 'text/csv', '.pdf': 'application/pdf'};

  /* ---------- estado del documento abierto ---------- */
  let O = null;
  const el = id => document.getElementById(id);
  const dirOf = p => p.split('/').slice(0, -1).join('/');
  const baseName = n => n.replace(/\.[^.]+$/, '');
  const fUrl = (o, dl) => `/api/file?path=${enc(o.path)}${o.share ? '&share=' + o.share : ''}${dl ? '&download=1' : ''}`;

  function setDirty(v) {
    if (!O) return; O.dirty = v;
    el('ofState').textContent = O.ro ? t('Solo lectura') : (v ? t('Cambios sin guardar') : (O.savedOnce ? t('Guardado') : ''));
    el('ofState').className = v ? 'dirty' : '';
  }
  function header() {
    el('ofName').textContent = O.name; el('ofName').title = O.path;
    el('ofIcon').innerHTML = svg(ICON[O.type]); el('ofIcon').className = 'ic-' + ICON[O.type];
    el('ofSave').classList.toggle('hidden', O.ro || O.type === 'docx' && !O.editing);
    setDirty(O.dirty);
  }

  async function open(it, opts = {}) {
    const type = typeOf(it); if (!type) return false;
    if (O && !(await closeAsk())) return true;
    O = {it, type, name: it.name, path: it.path, share: opts.share ?? S.share, ro: !!(opts.share ?? S.share), dirty: false,
      lossy: false, confirmed: !!opts.isNew, savedOnce: false, editing: false, cleanup: []};
    O.dir = dirOf(it.path);
    document.body.classList.add('office-open');
    el('office').classList.remove('hidden'); el('ofMenu').classList.add('hidden');
    header(); el('ofTools').innerHTML = ''; el('ofBody').innerHTML = `<div class="of-loading">${t('Cargando…')}</div>`;
    try { await OPEN[type](opts); } catch (e) { console.error(e); failed(e); }
    header();
    return true;
  }
  function failed(e) {
    el('ofTools').innerHTML = '';
    el('ofBody').innerHTML = `<div class="of-fail">${ic(ICON[O.type], 'big-ic')}<p><b>${t('No se ha podido abrir este documento')}</b></p><p class="np-why">${esc(e?.message || '')}</p>
      <a class="btn primary" href="${fUrl(O, true)}">${t('Descargar ({size})', {size: fmtSize(O.it.size)})}</a></div>`;
    paintIcons(el('ofBody')); O.ro = true; header();
  }
  async function fetchBuf(o = O) {
    const r = await fetch(fUrl(o), {cache: 'no-store'});
    if (r.status === 401) { showAuth(); throw new Error(t('Sesión caducada')); }
    if (!r.ok) throw new Error('Error ' + r.status);
    return r.arrayBuffer();
  }
  function cleanup() { (O?.cleanup || []).forEach(f => { try { f(); } catch (e) {} }); }
  function doClose() {
    cleanup(); O = null;
    el('office').classList.add('hidden'); el('ofBody').innerHTML = ''; el('ofTools').innerHTML = '';
    document.body.classList.remove('office-open');
    if (S.view === 'drive' || S.view === 'recent' || S.view === 'shared') load();
  }
  async function closeAsk() {
    if (!O || !O.dirty) return true;
    const p = dialog(`<h3>${t('Hay cambios sin guardar')}</h3><p>${t('Si sales ahora, se perderán los cambios que no has guardado.')}</p>
      <div class="actions"><button class="btn" data-close>${t('Seguir editando')}</button><button class="btn danger" data-close="ok">${t('Salir sin guardar')}</button></div>`);
    return !!(await p);
  }
  async function close() { if (await closeAsk()) doClose(); }

  /* ---------- guardar ---------- */
  async function upload(blob, dir, name, conflict) {
    const r = await fetch(`/api/upload?path=${enc(dir)}&name=${enc(name)}&conflict=${conflict}`, {method: 'PUT', body: blob, headers: {'Content-Type': 'application/octet-stream'}});
    let d = null; try { d = await r.json(); } catch (e) {}
    if (r.status === 401) { showAuth(); throw new Error(t('Sesión caducada')); }
    if (!r.ok) throw new Error((d && typeof d.detail === 'string' && d.detail) || 'Error ' + r.status);
    return d;
  }
  async function askLossy() {
    const p = dialog(`<h3>${t('¿Reemplazar el original?')}</h3>
      <p>${O.type === 'docx' ? t('Se guardan los textos, títulos, listas, tablas, imágenes y enlaces. Si el documento tenía un diseño complicado (columnas, encabezados, cuadros de texto), puede cambiar un poco.')
        : t('Se guardan los datos, las fórmulas y el formato de las celdas. Si el libro tenía gráficos o tablas dinámicas, puede que se pierdan.')}</p>
      <p>${t('Si no estás seguro, guarda una copia y el original se queda como estaba.')}</p>
      <div class="actions"><button class="btn" data-close>${t('Cancelar')}</button><button class="btn" id="lzRep">${t('Reemplazar')}</button><button class="btn primary" id="lzCopy">${t('Guardar una copia')}</button></div>`);
    el('lzRep').onclick = () => closeDialog('replace'); el('lzCopy').onclick = () => closeDialog('copy');
    return p;
  }
  async function copyDialog() {
    const fmts = FORMATS[O.type] || [];
    const cur = extOf(O.name), opts = fmts.length ? fmts : [cur];
    const def = baseName(O.name) + ' ' + t('(copia)');
    const p = dialog(`<h3>${t('Guardar una copia')}</h3><form id="cpF">
      <label>${t('Nombre')}</label><input id="cpN" value="${esc(def)}">
      ${opts.length > 1 ? `<label>${t('Formato')}</label><select id="cpX">${opts.map(x => `<option value="${x}">${x.slice(1).toUpperCase()}</option>`).join('')}</select>` : ''}
      <p class="muted" style="font-size:13px">${O.ro ? t('Se guarda en Mi unidad.') : t('Se guarda en la misma carpeta.')}</p>
      <div class="actions"><button type="button" class="btn" data-close>${t('Cancelar')}</button><button class="btn primary">${t('Guardar')}</button></div></form>`);
    el('cpF').onsubmit = e => { e.preventDefault(); const n = el('cpN').value.trim(); if (n) closeDialog({name: n + (el('cpX')?.value || opts[0]), ext: el('cpX')?.value || opts[0]}); };
    return p;
  }
  async function save(asCopy = false) {
    if (!O || O.busy) return;
    if (O.ro) asCopy = true;
    if (!asCopy && O.lossy && !O.confirmed) {
      const c = await askLossy(); if (!c) return;
      if (c === 'copy') asCopy = true; else O.confirmed = true;
    }
    let dir = O.dir, name = O.name, ext = extOf(O.name), conflict = 'overwrite';
    if (asCopy) {
      const c = await copyDialog(); if (!c) return;
      name = c.name; ext = c.ext; conflict = 'rename'; if (O.ro) dir = '';
    }
    O.busy = true; const btn = el('ofSave'); btn.disabled = true;
    const was = el('ofState').textContent; el('ofState').textContent = t('Guardando…');
    try {
      const blob = await O.export(ext);
      const r = await upload(blob, dir, name, conflict);
      const sameFmt = ext === extOf(O.name);
      if (asCopy && !sameFmt) { toast(t('Copia guardada: {name}', {name: r.name})); el('ofState').textContent = was; return; }
      if (asCopy) {  // a partir de ahora se edita la copia
        O.name = r.name; O.dir = dir; O.path = (dir ? dir + '/' : '') + r.name; O.share = null; O.ro = false; O.confirmed = true;
        toast(t('Copia guardada: {name}', {name: r.name}));
      } else toast(t('Guardado'), 1500);
      O.savedOnce = true; setDirty(false); header();
      if (O.afterSave) await O.afterSave().catch(e => console.error(e));
      loadStats?.();
    } catch (e) { el('ofState').textContent = was; toast(t('No se ha podido guardar: {msg}', {msg: e.message}), 5000); }
    finally { if (O) O.busy = false; btn.disabled = false; }
  }
  function download() {
    const go = () => { const u = fUrl(O, true); if (typeof ANDROID_WEB !== 'undefined' && ANDROID_WEB) appOrHere(u, O.name); else location.href = u; };
    if (O.dirty) toast(t('Se descarga la última versión guardada. Guarda antes para llevarte los cambios.'), 4000);
    go();
  }
  function printDoc() { document.body.classList.add('of-printing'); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('of-printing'), 500); }, 50); }
  function menu() {
    const m = el('ofMenu'); if (!m.classList.contains('hidden')) return m.classList.add('hidden');
    const opts = [];
    if (!O.ro && O.export) opts.push(['save', 'save', 'Guardar']);
    if (O.export) opts.push(['copy', 'copyFile', O.ro ? 'Guardar una copia en Mi unidad' : 'Guardar una copia…']);
    opts.push(['download', 'download', 'Descargar']);
    if (O.print && !IN_APP) opts.push(['print', 'print', O.type === 'pdf' ? 'Imprimir' : 'Imprimir o guardar como PDF']);
    m.innerHTML = opts.map(o => `<button data-of="${o[0]}">${ic(o[1])}${t(o[2])}</button>`).join('');
    m.classList.remove('hidden');
  }
  el('ofMenu').addEventListener('click', e => {
    const a = e.target.closest('[data-of]')?.dataset.of; if (!a) return; el('ofMenu').classList.add('hidden');
    if (a === 'save') save(); if (a === 'copy') save(true); if (a === 'download') download(); if (a === 'print') (O.print || printDoc)();
  });
  document.addEventListener('click', e => { if (!e.target.closest('#ofMore') && !e.target.closest('#ofMenu')) el('ofMenu').classList.add('hidden'); });
  paintIcons(el('office')); el('ofSave').querySelector('i').dataset.i = 'save'; el('ofSave').querySelector('i').innerHTML = svg('save');
  el('ofClose').onclick = close; el('ofSave').onclick = () => save(); el('ofMore').onclick = menu;
  document.addEventListener('keydown', e => {
    if (!O) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (O.export) save(); }
    if (e.key === 'Escape' && $('#dialog').classList.contains('hidden') && !e.target.closest?.('.x-spreadsheet, .pdfViewer, .of-page, textarea')) close();
  }, true);
  window.addEventListener('beforeunload', e => { if (O?.dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* barra de herramientas: [icono, título, acción] o '|' para separar */
  function tools(list) {
    const bar = el('ofTools');
    bar.innerHTML = list.map(x => typeof x === 'string' ? (x === '|' ? '<span class="sep"></span>' : x)
      : `<button class="tb" data-tb="${x[0]}" title="${esc(t(x[1]))}">${ic(x[2] || x[0])}${x[3] ? `<span>${esc(t(x[3]))}</span>` : ''}</button>`).join('');
    paintIcons(bar);
    return bar;
  }

  /* ================= PDF ================= */
  const OPEN = {};
  OPEN.pdf = async () => {
    const {lib, viewer: V2} = await PDFJS();
    const body = el('ofBody');
    body.innerHTML = '<div class="of-pdf"><div id="ofPdfC" class="of-pdf-c"><div class="pdfViewer"></div></div></div>';
    const container = el('ofPdfC');
    const eventBus = new V2.EventBus(), linkService = new V2.PDFLinkService({eventBus});
    const pv = new V2.PDFViewer({container, eventBus, linkService, annotationMode: lib.AnnotationMode.ENABLE_FORMS,
      annotationEditorMode: O.ro ? lib.AnnotationEditorType.DISABLE : lib.AnnotationEditorType.NONE, removePageBorders: false,
      imageResourcesPath: V + 'pdfjs/images/', supportsPinchToZoom: true,
      annotationEditorHighlightColors: 'yellow=#FFFF98,green=#53FFBC,blue=#80EBFF,pink=#FFCBE6,red=#FF4F5F'});
    linkService.setViewer(pv);
    const T = lib.AnnotationEditorType, PT = lib.AnnotationEditorParamsType;
    let mode = T.NONE, color = '#e53935', size = 14, thick = 3;
    const bar = tools([
      ['p-none', 'Seleccionar y rellenar formularios', 'pointer'],
      ...(O.ro ? [] : [['p-text', 'Escribir texto', 'textT', 'Texto'], ['p-ink', 'Dibujar o firmar', 'pen', 'Dibujar'],
        ['p-hl', 'Resaltar texto', 'marker', 'Resaltar'], ['p-img', 'Poner una imagen', 'image', 'Imagen'],
        `<label class="tb color" title="${esc(t('Color'))}"><input type="color" id="pColor" value="${color}"></label>`,
        `<select id="pSize" class="tb-sel" title="${esc(t('Tamaño'))}"></select>`]),
      '|', ['p-out', 'Alejar', 'zoomOut'], `<span id="pZoom" class="tb-txt">100%</span>`, ['p-in', 'Acercar', 'zoomIn'],
      '|', `<span id="pPage" class="tb-txt"></span>`]);
    const sizeSel = el('pSize');
    const fillSize = () => {
      if (!sizeSel) return;
      const ink = mode === T.INK, cur = ink ? thick : size;
      const vals = ink ? [1, 2, 3, 5, 8, 12] : [10, 12, 14, 18, 24, 32, 48];
      sizeSel.innerHTML = vals.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${ink ? t('Grosor {n}', {n: v}) : v + ' pt'}</option>`).join('');
      sizeSel.classList.toggle('hidden', !(mode === T.FREETEXT || mode === T.INK));
      el('pColor').parentElement.classList.toggle('hidden', !(mode === T.FREETEXT || mode === T.INK));
    };
    const params = () => {
      if (mode === T.FREETEXT) { eventBus.dispatch('switchannotationeditorparams', {source: null, type: PT.FREETEXT_COLOR, value: color}); eventBus.dispatch('switchannotationeditorparams', {source: null, type: PT.FREETEXT_SIZE, value: size}); }
      if (mode === T.INK) { eventBus.dispatch('switchannotationeditorparams', {source: null, type: PT.INK_COLOR, value: color}); eventBus.dispatch('switchannotationeditorparams', {source: null, type: PT.INK_THICKNESS, value: thick}); }
    };
    const setMode = m => {
      mode = m;
      try { pv.annotationEditorMode = {mode: m}; } catch (e) {}
      bar.querySelectorAll('[data-tb^="p-"]').forEach(b => b.classList.toggle('on', b.dataset.tb === {[T.NONE]: 'p-none', [T.FREETEXT]: 'p-text', [T.INK]: 'p-ink', [T.HIGHLIGHT]: 'p-hl', [T.STAMP]: 'p-img'}[m]));
      fillSize(); setTimeout(params, 50);
      container.classList.toggle('drawing', m === T.INK);
    };
    bar.onclick = e => {
      const b = e.target.closest('[data-tb]')?.dataset.tb; if (!b) return;
      if (b === 'p-none') setMode(T.NONE); if (b === 'p-text') setMode(T.FREETEXT); if (b === 'p-ink') setMode(T.INK); if (b === 'p-hl') setMode(T.HIGHLIGHT);
      if (b === 'p-img') { setMode(T.STAMP); setTimeout(() => eventBus.dispatch('switchannotationeditorparams', {source: null, type: PT.CREATE, value: null}), 80); }
      if (b === 'p-in') pv.increaseScale(); if (b === 'p-out') pv.decreaseScale();
    };
    el('pColor')?.addEventListener('input', e => { color = e.target.value; params(); });
    sizeSel?.addEventListener('change', e => { if (mode === T.INK) thick = +e.target.value; else size = +e.target.value; params(); });
    eventBus.on('scalechanging', e => { el('pZoom').textContent = Math.round(e.scale * 100) + '%'; });
    eventBus.on('pagechanging', e => { el('pPage').textContent = `${e.pageNumber} / ${pv.pagesCount}`; });
    eventBus.on('pagesinit', () => { pv.currentScaleValue = container.clientWidth < 700 ? 'page-width' : 'auto'; el('pPage').textContent = `1 / ${pv.pagesCount}`; });
    const ro = new ResizeObserver(() => { if (['page-width', 'auto'].includes(pv.currentScaleValue)) pv.currentScaleValue = pv.currentScaleValue; });
    ro.observe(container); O.cleanup.push(() => ro.disconnect());

    let doc, task;
    const load = async () => {
      const old = task;
      task = lib.getDocument({url: fUrl(O), cMapUrl: V + 'pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: V + 'pdfjs/standard_fonts/',
        wasmUrl: V + 'pdfjs/wasm/', iccUrl: V + 'pdfjs/iccs/', isEvalSupported: false, enableXfa: false, disableAutoFetch: false});
      task.onPassword = (cb, reason) => {
        const p = dialog(`<h3>${t('Este PDF tiene contraseña')}</h3><form id="pwF">${reason === 2 ? `<p class="np-why">${t('Contraseña incorrecta')}</p>` : ''}<input id="pwV" type="password" autocomplete="off">
          <div class="actions"><button type="button" class="btn" data-close>${t('Cancelar')}</button><button class="btn primary">${t('Abrir')}</button></form>`);
        el('pwF').onsubmit = e => { e.preventDefault(); closeDialog(el('pwV').value); };
        p.then(v => v == null ? task.destroy() : cb(v));
      };
      doc = await task.promise;
      doc.annotationStorage.onSetModified = () => setDirty(true);
      doc.annotationStorage.onResetModified = () => {};
      pv.setDocument(doc); linkService.setDocument(doc, null);
      if (old) old.destroy().catch(() => {});
    };
    await load();
    O.cleanup.push(() => { try { pv.setDocument(null); } catch (e) {} task?.destroy().catch(() => {}); });
    O.export = async () => new Blob([await doc.saveDocument()], {type: 'application/pdf'});
    // después de guardar se vuelve a abrir el archivo guardado (las anotaciones quedan dentro y se pueden seguir cambiando)
    O.afterSave = async () => {
      const page = pv.currentPageNumber, scale = pv.currentScaleValue, m = mode;
      setMode(T.NONE); await load();
      eventBus.on('pagesinit', () => { pv.currentScaleValue = scale; pv.currentPageNumber = page; if (m !== T.NONE) setTimeout(() => setMode(m), 200); }, {once: true});
    };
    O.print = () => {  // se imprime la versión guardada con el visor del navegador
      const w = window.open(fUrl(O), '_blank'); if (!w) location.href = fUrl(O);
    };
    if (!O.ro) setMode(T.NONE); else bar.querySelector('[data-tb="p-none"]').classList.add('on');
  };

  /* ================= Word (.docx) ================= */
  const PAGE_STYLE = 'Normal';
  OPEN.docx = async (opts) => {
    if (opts.isNew) return docxEdit(null);
    const buf = await fetchBuf();
    O.buf = buf;
    const dp = await DocxPreview();
    const body = el('ofBody');
    body.innerHTML = '<div class="of-scroll of-docview"><div id="ofDocx"></div></div>';
    tools(O.ro ? ['<span class="tb-txt">' + esc(t('Vista del documento')) + '</span>'] : [['d-edit', 'Editar el documento', 'edit', 'Editar']]);
    el('ofTools').onclick = e => { if (e.target.closest('[data-tb="d-edit"]')) docxEdit(O.buf); };
    await dp.renderAsync(buf.slice(0), el('ofDocx'), null, {className: 'docx', inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true,
      ignoreWidth: false, experimental: true, useBase64URL: true, renderHeaders: true, renderFooters: true, renderComments: false});
    fitPages();
    O.print = printDoc;
    // se puede guardar una copia sin editarla (por ejemplo desde una carpeta compartida)
    O.export = async () => new Blob([O.buf], {type: MIME['.docx']});
    const ro = new ResizeObserver(fitPages); ro.observe(body); O.cleanup.push(() => ro.disconnect());
  };
  // en el móvil las páginas de Word (21 cm) no caben: se reducen para que quepan a lo ancho
  function fitPages() {
    const w = el('ofDocx'); if (!w) return;
    const page = w.querySelector('section.docx'); if (!page) return;
    w.style.zoom = ''; const avail = w.parentElement.clientWidth - 16, pw = page.offsetWidth + 40;
    if (pw > avail) w.style.zoom = String(Math.max(0.3, avail / pw));
  }

  async function docxEdit(buf) {
    const body = el('ofBody');
    body.innerHTML = `<div class="of-loading">${t('Preparando el documento para editarlo…')}</div>`;
    let html = '';
    if (buf) {
      const m = await Mammoth();
      const r = await m.convertToHtml({arrayBuffer: buf.slice(0)}, {styleMap: ['u => u', 'strike => s', "p[style-name='Title'] => h1.title:fresh", "p[style-name='Subtitle'] => h2.subtitle:fresh"], includeDefaultStyleMap: true});
      html = r.value; O.lossy = !O.confirmed;
    }
    O.editing = true;
    body.innerHTML = `<div class="of-scroll of-docedit">${buf ? `<div class="of-note">${ic('info')}<span>${t('Estás editando. Se conservan los textos, títulos, listas, tablas, imágenes y enlaces; algunos diseños complicados pueden simplificarse al guardar.')}</span></div>` : ''}
      <div id="ofPage" class="of-page" contenteditable="${O.ro ? 'false' : 'true'}" spellcheck="true">${html || '<p><br></p>'}</div></div>`;
    paintIcons(body);
    const page = el('ofPage');
    // el HTML de mammoth no trae scripts, pero por si acaso no se deja nada que pueda ejecutar código
    page.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(x => x.remove());
    page.querySelectorAll('*').forEach(x => [...x.attributes].forEach(a => { if (/^on/i.test(a.name) || (a.name === 'href' && /^\s*javascript:/i.test(a.value))) x.removeAttribute(a.name); }));
    const bar = tools([
      ['undo', 'Deshacer'], ['redo', 'Rehacer'], '|',
      `<select id="dStyle" class="tb-sel" title="${esc(t('Estilo del párrafo'))}">
        <option value="p">${t('Texto normal')}</option><option value="h1">${t('Título 1')}</option><option value="h2">${t('Título 2')}</option>
        <option value="h3">${t('Título 3')}</option><option value="blockquote">${t('Cita')}</option></select>`,
      `<select id="dSize" class="tb-sel" title="${esc(t('Tamaño de letra'))}"><option value="">${t('Tamaño')}</option>${[8, 10, 11, 12, 14, 18, 24, 36].map(v => `<option value="${v}">${v}</option>`).join('')}</select>`,
      '|', ['bold', 'Negrita (Ctrl+B)'], ['italic', 'Cursiva (Ctrl+I)'], ['underline', 'Subrayado (Ctrl+U)'], ['strike', 'Tachado'],
      `<label class="tb color" title="${esc(t('Color del texto'))}">${ic('textColor')}<input type="color" id="dColor" value="#d32f2f"></label>`,
      `<label class="tb color" title="${esc(t('Color de resaltado'))}">${ic('marker')}<input type="color" id="dHl" value="#ffeb3b"></label>`,
      '|', ['alignL', 'Alinear a la izquierda'], ['alignC', 'Centrar'], ['alignR', 'Alinear a la derecha'], ['alignJ', 'Justificar'],
      '|', ['ul', 'Lista con viñetas'], ['ol', 'Lista numerada'], '|', ['table', 'Insertar tabla'], ['image', 'Insertar imagen'], ['link', 'Insertar enlace'],
      '|', ['clearFmt', 'Quitar formato']]);
    paintIcons(bar);
    const ex = (c, v = null) => { page.focus(); document.execCommand(c, false, v); setDirty(true); };
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    bar.addEventListener('mousedown', e => { if (e.target.closest('button.tb')) e.preventDefault(); });  // no perder la selección
    let saved = null;
    const keep = () => { const s = getSelection(); if (s.rangeCount && page.contains(s.anchorNode)) saved = s.getRangeAt(0).cloneRange(); };
    const back = () => { if (!saved) return; const s = getSelection(); s.removeAllRanges(); s.addRange(saved); };
    document.addEventListener('selectionchange', keep); O.cleanup.push(() => document.removeEventListener('selectionchange', keep));
    bar.onclick = async e => {
      const b = e.target.closest('[data-tb]')?.dataset.tb; if (!b || O.ro) return;
      const cmd = {undo: 'undo', redo: 'redo', bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough', alignL: 'justifyLeft',
        alignC: 'justifyCenter', alignR: 'justifyRight', alignJ: 'justifyFull', ul: 'insertUnorderedList', ol: 'insertOrderedList', clearFmt: 'removeFormat'}[b];
      if (cmd) { back(); return ex(cmd); }
      if (b === 'table') {
        const v = await promptDialog(t('Insertar tabla: filas x columnas'), '3 x 3', t('Insertar')); if (!v) return;
        const [r, c] = v.split(/[^0-9]+/).map(Number); if (!(r > 0 && c > 0)) return;
        const n = Math.min(r, 100), m = Math.min(c, 20);
        back(); ex('insertHTML', `<table class="of-table"><tbody>${Array.from({length: n}, () => `<tr>${'<td><br></td>'.repeat(m)}</tr>`).join('')}</tbody></table><p><br></p>`);
      }
      if (b === 'image') {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/gif';
        inp.onchange = () => { const f = inp.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { back(); ex('insertHTML', `<img src="${fr.result}" alt="">`); }; fr.readAsDataURL(f); };
        inp.click();
      }
      if (b === 'link') {
        const sel = saved ? saved.toString() : '';
        const v = await promptDialog(t('Dirección del enlace'), 'https://', t('Insertar')); if (!v || !/^(https?:|mailto:)/i.test(v)) return;
        back(); if (sel) ex('createLink', v); else ex('insertHTML', `<a href="${esc(v)}">${esc(v)}</a>`);
      }
    };
    el('dStyle').onchange = e => { back(); ex('formatBlock', '<' + e.target.value + '>'); e.target.blur(); };
    el('dSize').onchange = e => {
      const v = e.target.value; if (!v) return; back();
      document.execCommand('styleWithCSS', false, true); ex('fontSize', '7');
      page.querySelectorAll('font[size="7"], span[style*="xxx-large"]').forEach(f => { const s = document.createElement('span'); s.style.fontSize = v + 'pt'; s.innerHTML = f.innerHTML; f.replaceWith(s); });
      e.target.value = '';
    };
    el('dColor').oninput = e => { back(); document.execCommand('styleWithCSS', false, true); ex('foreColor', e.target.value); };
    el('dHl').oninput = e => { back(); document.execCommand('styleWithCSS', false, true); ex('hiliteColor', e.target.value); };
    page.addEventListener('input', () => setDirty(true));
    // pegar: solo texto con formato sencillo, sin estilos raros de otras webs
    page.addEventListener('paste', e => {
      const h = e.clipboardData?.getData('text/html'); if (!h) return;
      e.preventDefault();
      const d = new DOMParser().parseFromString(h, 'text/html');
      d.querySelectorAll('script,style,iframe,object,embed,link,meta,svg,form,input,button').forEach(x => x.remove());
      d.body.querySelectorAll('*').forEach(x => { [...x.attributes].forEach(a => { if (!['href', 'src', 'colspan', 'rowspan'].includes(a.name)) x.removeAttribute(a.name); }); if (x.tagName === 'A' && !/^(https?:|mailto:)/i.test(x.getAttribute('href') || '')) x.removeAttribute('href'); if (x.tagName === 'IMG' && !/^data:image\//.test(x.getAttribute('src') || '')) x.remove(); });
      document.execCommand('insertHTML', false, d.body.innerHTML);
    });
    const upd = () => {
      const s = getSelection(); if (!s.rangeCount || !page.contains(s.anchorNode)) return;
      let n = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
      const blk = n.closest('h1,h2,h3,blockquote,p,li,div,td'); const tg = blk && page.contains(blk) ? blk.tagName.toLowerCase() : 'p';
      el('dStyle').value = ['h1', 'h2', 'h3', 'blockquote'].includes(tg) ? tg : 'p';
      for (const [b, c] of [['bold', 'bold'], ['italic', 'italic'], ['underline', 'underline'], ['strike', 'strikeThrough'], ['ul', 'insertUnorderedList'], ['ol', 'insertOrderedList']]) {
        let on = false; try { on = document.queryCommandState(c); } catch (e) {} bar.querySelector(`[data-tb="${b}"]`)?.classList.toggle('on', on);
      }
    };
    document.addEventListener('selectionchange', upd); O.cleanup.push(() => document.removeEventListener('selectionchange', upd));
    O.export = () => htmlToDocx(page);
    O.print = printDoc;
    header();
    if (!buf) { page.focus(); }
  }

  /* HTML de la página editable → .docx (con la librería docx) */
  async function htmlToDocx(page) {
    const D = await DocxLib();
    const pageColor = rgbHex(getComputedStyle(page).color), basePx = parseFloat(getComputedStyle(page).fontSize);
    const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'TABLE', 'BLOCKQUOTE', 'PRE', 'HR', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER']);
    const HEAD = {H1: D.HeadingLevel.HEADING_1, H2: D.HeadingLevel.HEADING_2, H3: D.HeadingLevel.HEADING_3, H4: D.HeadingLevel.HEADING_4, H5: D.HeadingLevel.HEADING_5, H6: D.HeadingLevel.HEADING_6};
    const ALIGN = {center: D.AlignmentType.CENTER, right: D.AlignmentType.RIGHT, end: D.AlignmentType.RIGHT, justify: D.AlignmentType.JUSTIFIED};
    let listInst = 0;
    const isBlock = n => n.nodeType === 1 && BLOCK.has(n.tagName);

    function fmt(textNode) {
      const e = textNode.parentElement, cs = getComputedStyle(e), o = {};
      if (+cs.fontWeight >= 600 || cs.fontWeight === 'bold') o.bold = true;
      if (cs.fontStyle === 'italic') o.italics = true;
      let u = false, s = false, bg = null;
      for (let x = e; x && x !== page && !isBlock(x); x = x.parentElement) {
        const xs = getComputedStyle(x), d = xs.textDecorationLine || '';
        if (x.tagName === 'U' || d.includes('underline')) u = true;
        if (['S', 'STRIKE', 'DEL'].includes(x.tagName) || d.includes('line-through')) s = true;
        if (!bg && xs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(xs.backgroundColor)) bg = rgbHex(xs.backgroundColor);
      }
      if (u) o.underline = {}; if (s) o.strike = true;
      if (bg) o.shading = {type: D.ShadingType.CLEAR, color: 'auto', fill: bg};
      if (e.closest('a')) o.style = 'Hyperlink';
      const c = rgbHex(cs.color); if (c && c !== pageColor && !e.closest('a')) o.color = c;
      const px = parseFloat(cs.fontSize); if (px && Math.abs(px - basePx) > 0.5 && !e.closest('h1,h2,h3,h4,h5,h6')) o.size = Math.round(px * 0.75 * 2);
      if (cs.fontFamily && /mono|courier/i.test(cs.fontFamily)) o.font = 'Courier New';
      return o;
    }
    function imgRun(img) {
      const m = /^data:image\/(png|jpe?g|gif|bmp);base64,(.*)$/i.exec(img.getAttribute('src') || ''); if (!m) return null;
      const bin = atob(m[2]), data = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
      let w = img.width || img.naturalWidth || 300, h = img.height || img.naturalHeight || 200;
      if (w > 600) { h = Math.round(h * 600 / w); w = 600; }
      const type = m[1].toLowerCase().replace('jpeg', 'jpg');
      return new D.ImageRun({type, data, transformation: {width: w, height: h}});
    }
    function runs(nodes, out) {
      for (const n of nodes) {
        if (n.nodeType === 3) { const txt = n.data.replace(/[\r\n\t]+/g, ' '); if (txt) out.push(new D.TextRun({text: txt, ...fmt(n)})); }
        else if (n.nodeType !== 1) continue;
        else if (n.tagName === 'BR') out.push(new D.TextRun({break: 1}));
        else if (n.tagName === 'IMG') { const r = imgRun(n); if (r) out.push(r); }
        else if (n.tagName === 'A' && /^(https?:|mailto:)/i.test(n.getAttribute('href') || '')) {
          const kids = runs(n.childNodes, []).filter(k => k instanceof D.TextRun);
          out.push(new D.ExternalHyperlink({link: n.getAttribute('href'), children: kids.length ? kids : [new D.TextRun({text: n.textContent, style: 'Hyperlink'})]}));
        }
        else if (!['SCRIPT', 'STYLE'].includes(n.tagName)) runs(n.childNodes, out);
      }
      return out;
    }
    function para(nodes, blk, ctx) {
      const children = runs(nodes, []);
      // quitar espacios sobrantes al principio y al final del párrafo
      const o = {children};
      const tag = blk?.tagName;
      if (HEAD[tag]) o.heading = blk.classList.contains('title') ? D.HeadingLevel.TITLE : HEAD[tag];
      const al = blk ? ALIGN[getComputedStyle(blk).textAlign] : null; if (al) o.alignment = al;
      if (ctx.list) {
        if (ctx.list.type === 'UL') o.bullet = {level: ctx.list.level};
        else o.numbering = {reference: 'dp-num', level: ctx.list.level, instance: ctx.list.inst};
      }
      if (tag === 'BLOCKQUOTE' || ctx.quote) o.style = 'IntenseQuote';
      return new D.Paragraph(o);
    }
    function container(elm, ctx, out, blk) {
      let inl = [];
      const flush = () => { if (inl.length) { if (inl.some(n => n.nodeType === 1 || n.data.trim())) out.push(para(inl, blk, ctx)); inl = []; } };
      for (const n of elm.childNodes) {
        if (n.nodeType === 3 || (n.nodeType === 1 && !isBlock(n))) inl.push(n);
        else if (n.nodeType === 1) { flush(); block(n, ctx, out); }
      }
      flush();
      if (blk && blk !== page && !out.length) out.push(para([], blk, ctx));
    }
    function block(n, ctx, out) {
      const tag = n.tagName;
      if (tag === 'UL' || tag === 'OL') {
        const lvl = ctx.list ? Math.min(ctx.list.level + 1, 4) : 0;
        const inst = tag === 'OL' ? ++listInst : 0;
        for (const li of n.children) {
          if (li.tagName === 'LI') { const before = out.length; container(li, {...ctx, list: {type: tag, level: lvl, inst}}, out, li); if (out.length === before) out.push(para([], li, {...ctx, list: {type: tag, level: lvl, inst}})); }
          else block(li, ctx, out);
        }
      } else if (tag === 'TABLE') out.push(table(n, ctx));
      else if (tag === 'HR') out.push(new D.Paragraph({thematicBreak: true, children: []}));
      else container(n, tag === 'BLOCKQUOTE' ? {...ctx, quote: true} : ctx, out, n);
    }
    function table(tb, ctx) {
      const rows = [];
      for (const tr of tb.querySelectorAll(':scope > tr, :scope > tbody > tr, :scope > thead > tr, :scope > tfoot > tr')) {
        const cells = [];
        for (const td of tr.children) {
          if (!['TD', 'TH'].includes(td.tagName)) continue;
          const kids = []; container(td, {...ctx, list: null}, kids, td);
          const o = {children: kids.length ? kids : [new D.Paragraph({children: []})]};
          if (td.colSpan > 1) o.columnSpan = td.colSpan; if (td.rowSpan > 1) o.rowSpan = td.rowSpan;
          const bg = getComputedStyle(td).backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) o.shading = {type: D.ShadingType.CLEAR, color: 'auto', fill: rgbHex(bg)};
          cells.push(new D.TableCell(o));
        }
        if (cells.length) rows.push(new D.TableRow({children: cells}));
      }
      if (!rows.length) return new D.Paragraph({children: []});
      return new D.Table({rows, width: {size: 100, type: D.WidthType.PERCENTAGE}});
    }
    const children = [];
    container(page, {list: null}, children, null);
    const levels = [0, 1, 2, 3, 4].map(l => ({level: l, format: [D.LevelFormat.DECIMAL, D.LevelFormat.LOWER_LETTER, D.LevelFormat.LOWER_ROMAN, D.LevelFormat.DECIMAL, D.LevelFormat.LOWER_LETTER][l],
      text: `%${l + 1}.`, alignment: D.AlignmentType.START, style: {paragraph: {indent: {left: 720 * (l + 1), hanging: 360}}}}));
    const doc = new D.Document({
      creator: 'DrivePanel', styles: {default: {document: {run: {font: 'Calibri', size: 22}}}},
      numbering: {config: [{reference: 'dp-num', levels}]},
      sections: [{properties: {}, children: children.length ? children : [new D.Paragraph({children: []})]}]});
    return D.Packer.toBlob(doc);
  }
  function rgbHex(c) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c || ''); if (!m) return null;
    if (m[4] !== undefined && +m[4] === 0) return null;
    return [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  /* ================= Hojas de cálculo (.xlsx, .csv) ================= */
  // funciones que sabe calcular la hoja del navegador; si una celda usa otras, se enseña el
  // resultado que guardó Excel y la fórmula se conserva tal cual mientras no se toque la celda
  const XS_FN = new Set(['SUM', 'AVERAGE', 'MAX', 'MIN', 'IF', 'AND', 'OR', 'CONCAT']);
  OPEN.xlsx = async (opts) => sheetOpen('xlsx', opts);
  OPEN.csv = async (opts) => sheetOpen('csv', opts);
  async function sheetOpen(kind, opts) {
    const [X] = await Promise.all([XS(), kind === 'xlsx' ? ExcelJS() : null]);
    let data, wb = null, csvSep = ',';
    if (kind === 'xlsx') {
      const EJ = await ExcelJS(); wb = new EJ.Workbook();
      if (opts.isNew) wb.addWorksheet(t('Hoja1')); else await wb.xlsx.load(await fetchBuf());
      data = wb.worksheets.filter(ws => ws.state !== 'veryHidden').map(ws => wsToData(ws));
      O.lossy = !O.confirmed && !opts.isNew;
    } else {
      const txt = opts.isNew ? '' : new TextDecoder().decode(await fetchBuf()).replace(/^﻿/, '');
      csvSep = extOf(O.name) === '.tsv' ? '\t' : detectSep(txt);
      data = [csvToData(txt, csvSep, baseName(O.name))];
    }
    O.wb = wb;
    O.snap = JSON.stringify(data);  // cómo estaba al abrir, para saber qué celdas se han tocado
    const body = el('ofBody');
    body.innerHTML = '<div id="ofSheet" class="of-sheet"></div>';
    tools([`<span class="tb-txt hint">${esc(t(O.ro ? 'Vista de la hoja de cálculo' : (TOUCH ? 'Toca dos veces una celda para escribir. Las fórmulas empiezan por =' : 'Haz doble clic en una celda para escribir. Las fórmulas empiezan por =')))}</span>`]);
    const box = el('ofSheet');
    const xs = X(box, {mode: O.ro ? 'read' : 'edit', showToolbar: !O.ro, showGrid: true, showContextmenu: !O.ro, showBottomBar: true,
      view: {height: () => box.clientHeight, width: () => box.clientWidth},
      row: {len: 100, height: 25}, col: {len: 26, width: 100, indexWidth: 50, minWidth: 40},
      style: {bgcolor: '#ffffff', align: 'left', valign: 'middle', textwrap: false, strike: false, underline: false, color: '#0a0a0a', font: {name: 'Arial', size: 10, bold: false, italic: false}}});
    xs.loadData(data);
    xs.change(() => setDirty(true));
    O.xs = xs;
    const ro = new ResizeObserver(() => { try { xs.reRender(); } catch (e) {} }); ro.observe(box); O.cleanup.push(() => ro.disconnect());
    O.export = async ext => {
      const now = xs.getData();
      if (ext === '.csv' || ext === '.tsv') return new Blob([dataToCsv(now[0], ext === '.tsv' ? '\t' : (kind === 'csv' ? csvSep : (LANG === 'es' ? ';' : ',')))], {type: 'text/csv'});
      const EJ = await ExcelJS();
      let book = O.wb;
      if (!book) { book = new EJ.Workbook(); }
      dataToWb(book, now, JSON.parse(O.snap));
      return new Blob([await book.xlsx.writeBuffer()], {type: MIME['.xlsx']});
    };
    O.afterSave = async () => { O.snap = JSON.stringify(xs.getData()); };
    O.print = null;  // la hoja tiene su propio botón de imprimir en la barra
  }
  const colName = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const argbHex = c => c && typeof c.argb === 'string' && c.argb.length >= 6 ? '#' + c.argb.slice(-6).toLowerCase() : null;
  function cellText(cell) {
    const v = cell.value;
    if (v == null) return '';
    if (typeof v === 'object') {
      if (v.formula || v.sharedFormula) {
        const f = cell.formula || v.formula;
        const fns = (f || '').toUpperCase().match(/[A-Z][A-Z0-9.]*(?=\()/g) || [];
        if (f && fns.every(x => XS_FN.has(x)) && !/[!\[]/.test(f)) return '=' + f;
        return resText(v.result, cell);
      }
      if (v.richText) return v.richText.map(r => r.text).join('');
      if (v.text !== undefined) return typeof v.text === 'object' ? (v.text.richText || []).map(r => r.text).join('') : String(v.text);
      if (v.error) return v.error;
      if (v instanceof Date) return fmtCellDate(v, cell);
    }
    if (typeof v === 'number') return numText(v, cell);
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return String(v);
  }
  function resText(r, cell) { if (r == null) return ''; if (r instanceof Date) return fmtCellDate(r, cell); if (typeof r === 'object') return r.error || ''; return typeof r === 'number' ? numText(r, cell) : String(r); }
  function numText(v, cell) {
    const f = cell.numFmt || '';
    if (/%/.test(f)) return String(+(v * 100).toFixed(4)) + '%';
    return String(+v.toPrecision(15));
  }
  function fmtCellDate(d, cell) {
    const p = n => String(n).padStart(2, '0');
    const hasTime = /h|s/i.test(cell.numFmt || '') || d.getUTCHours() || d.getUTCMinutes();
    const ds = LANG === 'es' ? `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}` : `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
    return hasTime ? ds + ` ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : ds;
  }
  function cellStyle(cell) {
    const s = {}, f = cell.font || {}, a = cell.alignment || {}, fl = cell.fill, b = cell.border || {};
    const font = {};
    if (f.bold) font.bold = true; if (f.italic) font.italic = true; if (f.size) font.size = f.size; if (f.name) font.name = f.name;
    if (Object.keys(font).length) s.font = font;
    if (f.underline) s.underline = true; if (f.strike) s.strike = true;
    const c = argbHex(f.color); if (c && c !== '#000000') s.color = c;
    if (fl && fl.type === 'pattern' && fl.pattern === 'solid') { const bg = argbHex(fl.fgColor); if (bg) s.bgcolor = bg; }
    if (['left', 'center', 'right'].includes(a.horizontal)) s.align = a.horizontal;
    if (a.vertical) s.valign = a.vertical === 'middle' ? 'middle' : a.vertical === 'top' ? 'top' : 'bottom';
    if (a.wrapText) s.textwrap = true;
    const bd = {};
    for (const k of ['top', 'bottom', 'left', 'right']) if (b[k]?.style) bd[k] = [['medium', 'thick', 'double', 'dashed', 'dotted'].includes(b[k].style) ? b[k].style : 'thin', argbHex(b[k].color) || '#000000'];
    if (Object.keys(bd).length) s.border = bd;
    return Object.keys(s).length ? s : null;
  }
  function wsToData(ws) {
    const styles = [], skey = {}, rows = {}, merges = [];
    const sid = st => { const k = JSON.stringify(st); if (!(k in skey)) { skey[k] = styles.length; styles.push(st); } return skey[k]; };
    let maxR = 0, maxC = 0;
    ws.eachRow({includeEmpty: true}, (row, r) => {
      const cells = {};
      row.eachCell({includeEmpty: false}, (cell, c) => {
        if (cell.isMerged && cell.master !== cell) return;
        const o = {text: cellText(cell)}, st = cellStyle(cell);
        if (st) o.style = sid(st);
        if (o.text || o.style !== undefined) { cells[c - 1] = o; maxC = Math.max(maxC, c); }
      });
      const ro = {cells}; if (row.height) ro.height = Math.round(row.height * 4 / 3);
      if (Object.keys(cells).length || row.height) { rows[r - 1] = ro; maxR = Math.max(maxR, r); }
    });
    for (const m of Object.keys(ws._merges || {})) {
      const rg = ws._merges[m].model || ws._merges[m]; if (!rg || !rg.top) continue;
      const a = colName(rg.left - 1) + rg.top, b = colName(rg.right - 1) + rg.bottom; merges.push(a + ':' + b);
      const cr = rows[rg.top - 1]?.cells?.[rg.left - 1] || ((rows[rg.top - 1] ||= {cells: {}}).cells[rg.left - 1] = {text: ''});
      cr.merge = [rg.bottom - rg.top, rg.right - rg.left];
    }
    rows.len = Math.max(100, maxR + 30);
    const cols = {len: Math.max(26, maxC + 5)};
    (ws.columns || []).forEach((col, i) => { if (col && col.width) cols[i] = {width: Math.round(col.width * 7 + 5)}; });
    const d = {name: ws.name, styles, merges, rows, cols};
    const fr = ws.views?.[0]; if (fr && fr.state === 'frozen' && (fr.xSplit || fr.ySplit)) d.freeze = colName(fr.xSplit || 0) + ((fr.ySplit || 0) + 1);
    return d;
  }
  function parseVal(txt) {
    const s = txt.trim();
    if (s === '') return null;
    if (s[0] === '=') return {formula: s.slice(1)};
    if (/^-?\d+([.,]\d+)?%$/.test(s)) return {num: parseFloat(s.replace(',', '.')) / 100, fmt: '0%'};
    if (/^-?\d+(,\d+)?$/.test(s) || /^-?\d*\.\d+$/.test(s)) return {num: parseFloat(s.replace(',', '.'))};
    if (/^(TRUE|FALSE|VERDADERO|FALSO)$/i.test(s)) return {bool: /^(TRUE|VERDADERO)$/i.test(s)};
    return {str: txt};
  }
  function applyStyle(cell, st) {
    st = st || {};
    const f = {...(cell.font || {})};
    f.bold = !!st.font?.bold; f.italic = !!st.font?.italic; f.underline = !!st.underline; f.strike = !!st.strike;
    if (st.font?.size) f.size = st.font.size; if (st.font?.name) f.name = st.font.name;
    if (st.color) f.color = {argb: 'FF' + st.color.replace('#', '').toUpperCase()}; else if (f.color?.argb) delete f.color;
    cell.font = f;
    if (st.bgcolor && st.bgcolor.toLowerCase() !== '#ffffff') cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF' + st.bgcolor.replace('#', '').toUpperCase()}};
    else if (cell.fill?.pattern === 'solid') cell.fill = {type: 'pattern', pattern: 'none'};
    const a = {...(cell.alignment || {})};
    if (st.align) a.horizontal = st.align; else delete a.horizontal;
    if (st.valign) a.vertical = st.valign; if (st.textwrap) a.wrapText = true; else delete a.wrapText;
    cell.alignment = a;
    if (st.border) { const b = {}; for (const k in st.border) b[k] = {style: st.border[k][0], color: {argb: 'FF' + String(st.border[k][1]).replace('#', '').toUpperCase()}}; cell.border = b; }
    else if (cell.border && Object.keys(cell.border).length) cell.border = {};
  }
  function dataToWb(book, sheets, snaps) {
    const used = new Set(), list = book.worksheets.filter(ws => ws.state !== 'veryHidden');
    const pairs = sheets.map(d => { const ws = list.find(w => w.name === d.name && !used.has(w)); if (ws) used.add(ws); return [d, ws]; });
    for (const p of pairs) if (!p[1]) { const ws = list.find(w => !used.has(w)); if (ws) { used.add(ws); p[1] = ws; } }
    for (const ws of list) if (!used.has(ws)) book.removeWorksheet(ws.id);
    pairs.forEach(([d, ws], idx) => {
      if (!ws) ws = book.addWorksheet(d.name || t('Hoja') + (idx + 1));
      else if (ws.name !== d.name && d.name) ws.name = d.name.slice(0, 31);
      const snap = snaps.find(s => s.name === (ws.name)) || {rows: {}, styles: [], merges: [], cols: {}};
      const st = i => i == null ? null : d.styles?.[i], sst = i => i == null ? null : snap.styles?.[i];
      const keys = new Set();
      const collect = rows => { for (const r in rows) { if (r === 'len') continue; for (const c in rows[r].cells || {}) keys.add(r + ':' + c); } };
      collect(d.rows); collect(snap.rows);
      for (const k of keys) {
        const [r, c] = k.split(':').map(Number);
        const now = d.rows?.[r]?.cells?.[c] || {}, was = snap.rows?.[r]?.cells?.[c] || {};
        const cell = ws.getCell(r + 1, c + 1);
        if ((now.text || '') !== (was.text || '')) {
          const v = parseVal(now.text || '');
          if (!v) cell.value = null;
          else if ('formula' in v) cell.value = {formula: v.formula};
          else if ('num' in v) { cell.value = v.num; if (v.fmt) cell.numFmt = v.fmt; }
          else if ('bool' in v) cell.value = v.bool;
          else cell.value = v.str;
        }
        if (JSON.stringify(st(now.style)) !== JSON.stringify(sst(was.style))) applyStyle(cell, st(now.style));
      }
      // celdas combinadas
      const mNow = new Set(d.merges || []), mWas = new Set(snap.merges || []);
      for (const m of mWas) if (!mNow.has(m)) { try { ws.unMergeCells(m); } catch (e) {} }
      for (const m of mNow) if (!mWas.has(m)) { try { ws.mergeCells(m); } catch (e) {} }
      // anchos de columna y altos de fila que se hayan cambiado
      for (const c in d.cols || {}) { if (c === 'len') continue; const w = d.cols[c]?.width; if (w && w !== snap.cols?.[c]?.width) ws.getColumn(+c + 1).width = Math.max(1, (w - 5) / 7); }
      for (const r in d.rows || {}) { if (r === 'len') continue; const h = d.rows[r]?.height; if (h && h !== snap.rows?.[r]?.height) ws.getRow(+r + 1).height = h * 0.75; }
      if (d.freeze && d.freeze !== snap.freeze && d.freeze !== 'A1') {
        const m = /^([A-Z]+)(\d+)$/.exec(d.freeze); if (m) { let x = 0; for (const ch of m[1]) x = x * 26 + ch.charCodeAt(0) - 64; ws.views = [{state: 'frozen', xSplit: x - 1, ySplit: +m[2] - 1}]; }
      } else if (d.freeze === 'A1' && snap.freeze && snap.freeze !== 'A1') ws.views = [];
    });
    book.calcProperties = {...(book.calcProperties || {}), fullCalcOnLoad: true};  // Excel recalcula las fórmulas al abrirlo
  }
  function detectSep(txt) {
    const line = txt.split(/\r?\n/).slice(0, 5).join('\n');
    const cnt = ch => (line.match(new RegExp('\\' + ch, 'g')) || []).length;
    return [';', ',', '\t'].sort((a, b) => cnt(b) - cnt(a))[0] || ',';
  }
  function parseCsv(txt, sep) {
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"' && f === '') q = true;
      else if (ch === sep) { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += ch;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  function csvToData(txt, sep, name) {
    const rows = {}; let maxC = 0;
    parseCsv(txt, sep).forEach((r, i) => { const cells = {}; r.forEach((v, j) => { if (v !== '') cells[j] = {text: v}; }); rows[i] = {cells}; maxC = Math.max(maxC, r.length); });
    rows.len = Math.max(100, Object.keys(rows).length + 30);
    return {name: (name || t('Hoja1')).slice(0, 31), rows, cols: {len: Math.max(26, maxC + 5)}, styles: [], merges: []};
  }
  function dataToCsv(d, sep) {
    let maxR = -1, maxC = -1;
    for (const r in d.rows || {}) { if (r === 'len') continue; for (const c in d.rows[r].cells || {}) if ((d.rows[r].cells[c].text || '') !== '') { maxR = Math.max(maxR, +r); maxC = Math.max(maxC, +c); } }
    const q = v => /["\r\n]/.test(v) || v.includes(sep) ? '"' + v.replace(/"/g, '""') + '"' : v;
    const out = [];
    for (let r = 0; r <= maxR; r++) { const row = []; for (let c = 0; c <= maxC; c++) row.push(q(String(d.rows?.[r]?.cells?.[c]?.text ?? ''))); out.push(row.join(sep)); }
    return out.join('\r\n') + (out.length ? '\r\n' : '');
  }

  /* ================= Texto ================= */
  OPEN.text = async (opts) => {
    const txt = opts.isNew ? '' : new TextDecoder().decode(await fetchBuf());
    el('ofBody').innerHTML = `<div class="of-textwrap"><textarea id="ofText" class="of-text" spellcheck="false" ${O.ro ? 'readonly' : ''}></textarea></div>`;
    tools([`<span class="tb-txt hint">${esc(t(O.ro ? 'Vista del texto' : 'Escribe directamente. Ctrl+S para guardar.'))}</span>`]);
    const ta = el('ofText'); ta.value = txt;
    ta.addEventListener('input', () => setDirty(true));
    ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '\t'); } });
    O.export = async () => new Blob([ta.value], {type: 'text/plain'});
    O.print = printDoc;
    if (opts.isNew) ta.focus();
  };

  /* ================= crear documentos nuevos ================= */
  const NEW = {
    docx: {name: 'Documento sin título', ext: '.docx', make: async () => { const D = await DocxLib(); return D.Packer.toBlob(new D.Document({creator: 'DrivePanel', styles: {default: {document: {run: {font: 'Calibri', size: 22}}}}, sections: [{children: [new D.Paragraph({children: []})]}]})); }},
    xlsx: {name: 'Hoja de cálculo sin título', ext: '.xlsx', make: async () => { const EJ = await ExcelJS(); const wb = new EJ.Workbook(); wb.addWorksheet(t('Hoja1')); return new Blob([await wb.xlsx.writeBuffer()]); }},
    text: {name: 'Documento de texto sin título', ext: '.txt', make: async () => new Blob([''])},
  };
  async function create(kind) {
    const n = NEW[kind];
    const name = await promptDialog(t({docx: 'Nuevo documento de Word', xlsx: 'Nueva hoja de cálculo', text: 'Nuevo documento de texto'}[kind]), t(n.name), t('Crear'));
    if (!name) return;
    const full = extOf(name) === n.ext ? name : name + n.ext;
    const dir = S.view === 'drive' && !S.share ? S.path : '';
    try {
      const blob = await n.make();
      const r = await upload(blob, dir, full, 'rename');
      const path = (dir ? dir + '/' : '') + r.name;
      if (S.view !== 'drive' || S.share) go('drive', dir); else load();
      open({name: r.name, path, dir: false, size: blob.size, kind: kind === 'text' ? 'text' : kind === 'docx' ? 'doc' : 'sheet', mtime: Date.now() / 1000}, {share: null, isNew: true});
    } catch (e) { toast(e.message); }
  }

  /* textos de la hoja de cálculo en español */
  const XS_ES = {
    toolbar: {undo: 'Deshacer', redo: 'Rehacer', print: 'Imprimir', paintformat: 'Copiar formato', clearformat: 'Quitar formato', format: 'Formato', fontName: 'Fuente', fontSize: 'Tamaño de letra', fontBold: 'Negrita', fontItalic: 'Cursiva', underline: 'Subrayado', strike: 'Tachado', color: 'Color del texto', bgcolor: 'Color de relleno', border: 'Bordes', merge: 'Combinar celdas', align: 'Alineación horizontal', valign: 'Alineación vertical', textwrap: 'Ajustar texto', freeze: 'Inmovilizar', autofilter: 'Filtro', formula: 'Funciones', more: 'Más'},
    contextmenu: {copy: 'Copiar', cut: 'Cortar', paste: 'Pegar', pasteValue: 'Pegar solo valores', pasteFormat: 'Pegar solo formato', hide: 'Ocultar', insertRow: 'Insertar fila', insertColumn: 'Insertar columna', deleteSheet: 'Eliminar hoja', deleteRow: 'Eliminar fila', deleteColumn: 'Eliminar columna', deleteCell: 'Eliminar celda', deleteCellText: 'Borrar el texto', validation: 'Validación de datos', cellprintable: 'Permitir exportar', cellnonprintable: 'No exportar', celleditable: 'Permitir editar', cellnoneditable: 'No permitir editar'},
    print: {size: 'Tamaño del papel', orientation: 'Orientación', orientations: ['Horizontal', 'Vertical']},
    format: {normal: 'Normal', text: 'Texto', number: 'Número', percent: 'Porcentaje', rmb: 'RMB', usd: 'Dólares', eur: 'Euros', date: 'Fecha', time: 'Hora', datetime: 'Fecha y hora', duration: 'Duración'},
    formula: {sum: 'Suma', average: 'Promedio', max: 'Máximo', min: 'Mínimo', _if: 'SI', and: 'Y', or: 'O', concat: 'Concatenar'},
    validation: {required: 'es obligatorio', notMatch: 'no cumple la regla', between: 'está entre {} y {}', notBetween: 'no está entre {} y {}', notIn: 'no está en la lista', equal: 'es igual a {}', notEqual: 'no es igual a {}', lessThan: 'es menor que {}', lessThanEqual: 'es menor o igual que {}', greaterThan: 'es mayor que {}', greaterThanEqual: 'es mayor o igual que {}'},
    error: {pasteForMergedCell: 'No se puede hacer en celdas combinadas'},
    calendar: {weeks: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], months: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']},
    button: {next: 'Siguiente', cancel: 'Cancelar', remove: 'Quitar', save: 'Guardar', ok: 'Aceptar'},
    sort: {desc: 'Ordenar Z → A', asc: 'Ordenar A → Z'}, filter: {empty: 'vacío'},
    dataValidation: {mode: 'Modo', range: 'Rango de celdas', criteria: 'Criterio', modeType: {cell: 'Celda', column: 'Columna', row: 'Fila'}, type: {list: 'Lista', number: 'Número', date: 'Fecha', phone: 'Teléfono', email: 'Correo'}, operator: {be: 'entre', nbe: 'no entre', lt: 'menor que', lte: 'menor o igual que', gt: 'mayor que', gte: 'mayor o igual que', eq: 'igual a', neq: 'distinto de'}},
  };

  return {can: it => !!typeOf(it), open, create, isOpen: () => !!O, close};
})();
