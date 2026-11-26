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
    if (['.xls', '.ods', '.fods', '.xlsb'].includes(e)) return 'oldsheet';
    if (e === '.odt') return 'odt';
    if (e === '.doc' || e === '.rtf') return 'olddoc';
    if (e === '.pptx' || e === '.odp') return 'slides';
    if (e === '.mdb' || e === '.accdb') return 'access';
    if (it.kind === 'text' && it.size < 2e6) return 'text';
    return null;
  }
  // formatos en los que se puede guardar (el primero es el del propio archivo, si se puede)
  const FORMATS = {pdf: ['.pdf'], docx: ['.docx', '.odt'], odt: ['.odt', '.docx'], olddoc: ['.docx', '.odt'], xlsx: ['.xlsx', '.ods', '.csv'], csv: ['.csv', '.xlsx', '.ods'],
    oldsheet: ['.xlsx', '.ods', '.xls', '.csv'], slides: [], access: ['.xlsx'], text: []};
  const ICON = {pdf: 'pdf', docx: 'doc', odt: 'doc', olddoc: 'doc', xlsx: 'sheet', csv: 'sheet', oldsheet: 'sheet', slides: 'slides', access: 'sheet', text: 'text'};
  const MIME = {'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.odt': 'application/vnd.oasis.opendocument.text',
    '.ods': 'application/vnd.oasis.opendocument.spreadsheet', '.xls': 'application/vnd.ms-excel',
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
    el('ofSave').classList.toggle('hidden', O.ro || O.viewOnly);
    el('ofPrint').classList.toggle('hidden', !O.print || IN_APP);
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
      <p>${['docx', 'odt'].includes(O.type) ? t('Se guardan los textos, títulos, listas, tablas, imágenes y enlaces. Si el documento tenía un diseño complicado (columnas, encabezados, cuadros de texto), puede cambiar un poco.')
        : O.type === 'oldsheet' && extOf(O.name) === '.xls' ? t('En el formato antiguo de Excel (.xls) se guardan los datos y las hojas, pero las fórmulas se quedan como su resultado y se pierden los colores. Para conservar las fórmulas, guarda una copia en .xlsx.')
        : O.type === 'oldsheet' ? t('Se guardan los datos, las fórmulas y las hojas, pero no los colores ni los bordes.')
        : t('Se guardan los datos, las fórmulas y el formato de las celdas. Si el libro tenía gráficos o tablas dinámicas, puede que se pierdan.')}</p>
      <p>${t('Si no estás seguro, guarda una copia y el original se queda como estaba.')}</p>
      <div class="actions"><button class="btn" data-close>${t('Cancelar')}</button><button class="btn" id="lzRep">${t('Reemplazar')}</button><button class="btn primary" id="lzCopy">${t('Guardar una copia')}</button></div>`);
    el('lzRep').onclick = () => closeDialog('replace'); el('lzCopy').onclick = () => closeDialog('copy');
    return p;
  }
  async function copyDialog() {
    const fmts = FORMATS[O.type] || [];
    const cur = extOf(O.name), opts = fmts.length ? (fmts.includes(cur) && cur !== '.xls' ? [cur, ...fmts.filter(x => x !== cur)] : fmts) : [cur];
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
    if (O.ro || (O.copyOnly && !O.confirmed)) asCopy = true;
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
      if (asCopy && !sameFmt && !O.copyOnly) { toast(t('Copia guardada: {name}', {name: r.name})); el('ofState').textContent = was; return; }
      if (asCopy) {  // a partir de ahora se edita la copia
        O.name = r.name; O.dir = dir; O.path = (dir ? dir + '/' : '') + r.name; O.share = null; O.ro = false; O.confirmed = true; O.copyOnly = false;
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
  /* ---------- vista previa de impresión ----------
     Se ven las páginas tal como saldrán en el papel elegido (tamaño, orientación y márgenes)
     y «Imprimir» imprime exactamente esas páginas. Cada documento da sus páginas con O.pages(caja),
     donde caja es el hueco útil del papel en píxeles (96 por pulgada). */
  const PAPER = {A4: [210, 297], A5: [148, 210], A3: [297, 420], Carta: [215.9, 279.4], Oficio: [215.9, 355.6]};
  const MARGINS = {normal: 20, estrecho: 10, ninguno: 0};
  const MM = 96 / 25.4;
  let pvSeq = 0;
  async function printPreview() {
    if (!O || !O.pages) return;
    const st = {paper: 'A4', orient: 'portrait', margin: O.pagesMargin || 'normal'};
    try { Object.assign(st, JSON.parse(localStorage.getItem('dp-print') || '{}'), O.pagesMargin ? {margin: O.pagesMargin} : {}); } catch (e) {}
    if (O.pagesOrient) st.orient = O.pagesOrient;
    if (!PAPER[st.paper]) st.paper = 'A4';
    el('ofPv')?.remove();
    const pv = document.createElement('div'); pv.id = 'ofPv'; pv.className = 'of-pv';
    const opt = (o, cur) => Object.entries(o).map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(t(l))}</option>`).join('');
    pv.innerHTML = `<div class="of-top"><button class="icon-btn" id="pvClose" title="${esc(t('Cerrar'))}">${svg('left')}</button>
      <div class="of-title"><b>${t('Vista previa de impresión')}</b><span id="pvInfo"></span></div><span class="grow"></span>
      <button class="btn primary small" id="pvPrint">${ic('print')}<span>${t('Imprimir')}</span></button></div>
      <div class="of-tools pv-tools">
        <label>${t('Papel')} <select id="pvPaper" class="tb-sel">${opt({A4: 'A4 (folio)', A5: 'A5 (cuartilla)', A3: 'A3', Carta: 'Carta', Oficio: 'Oficio'}, st.paper)}</select></label>
        <label>${t('Orientación')} <select id="pvOr" class="tb-sel">${opt({portrait: 'Vertical', landscape: 'Horizontal'}, st.orient)}</select></label>
        <label>${t('Márgenes')} <select id="pvMg" class="tb-sel">${opt({normal: 'Normales (2 cm)', estrecho: 'Estrechos (1 cm)', ninguno: 'Sin márgenes'}, st.margin)}</select></label>
      </div>
      <div class="pv-scroll" id="pvScroll"><div class="pv-pages" id="pvPages"></div></div>`;
    el('office').appendChild(pv); paintIcons(pv);
    const close = () => pv.remove();
    el('pvClose').onclick = close;
    const dims = () => { let [w, h] = PAPER[st.paper]; if (st.orient === 'landscape') [w, h] = [h, w]; return [w, h, MARGINS[st.margin]]; };
    const fit = () => { const [w] = dims(); const box = el('pvPages'); if (box) box.style.zoom = String(Math.min(1, (el('pvScroll').clientWidth - 24) / (w * MM))); };
    const render = async () => {
      const seq = ++pvSeq, [w, h, m] = dims();
      try { localStorage.setItem('dp-print', JSON.stringify({paper: st.paper, orient: st.orient, margin: O.pagesMargin ? undefined : st.margin})); } catch (e) {}
      const box = {w: (w - 2 * m) * MM, h: (h - 2 * m) * MM};
      const holder = el('pvPages'); holder.innerHTML = `<div class="pv-wait">${t('Preparando las páginas…')}</div>`; holder.style.zoom = '';
      el('pvPrint').disabled = true;
      let pages;
      try { pages = await O.pages(box, pv); } catch (e) { console.error(e); holder.innerHTML = `<div class="pv-wait">${esc(e.message)}</div>`; return; }
      if (seq !== pvSeq || !pv.isConnected) return;
      holder.innerHTML = '';
      for (const c of pages) {
        const pg = document.createElement('div'); pg.className = 'pv-page';
        pg.style.cssText = `width:${w}mm;height:${h}mm;padding:${m}mm`;
        const inner = document.createElement('div'); inner.className = 'pv-in'; inner.appendChild(c); pg.appendChild(inner); holder.appendChild(pg);
      }
      el('pvInfo').textContent = pages.length === 1 ? t('1 página') : t('{n} páginas', {n: pages.length});
      el('pvPrint').disabled = false; fit();
    };
    el('pvPaper').onchange = e => { st.paper = e.target.value; render(); };
    el('pvOr').onchange = e => { st.orient = e.target.value; render(); };
    el('pvMg').onchange = e => { st.margin = e.target.value; render(); };
    el('pvPrint').onclick = () => {
      const [w, h] = dims();
      let css = el('pvAtPage'); if (!css) { css = document.createElement('style'); css.id = 'pvAtPage'; document.head.appendChild(css); }
      css.textContent = `@page{size:${w}mm ${h}mm;margin:0}`;
      document.body.classList.add('pv-printing'); el('pvPages').style.zoom = '';
      setTimeout(() => { window.print(); setTimeout(() => { document.body.classList.remove('pv-printing'); fit(); }, 300); }, 50);
    };
    const ro = new ResizeObserver(fit); ro.observe(el('pvScroll'));
    await render();
  }
  // reparte bloques (párrafos, títulos, tablas, listas) en páginas sin cortar líneas por la mitad;
  // las listas y tablas largas se parten por elementos o filas
  function flowPages(nodes, box, cls, host) {
    const meas = document.createElement('div'); meas.className = 'pv-measure'; host.appendChild(meas);
    const pages = [];
    const newPage = () => { const d = document.createElement('div'); d.className = cls + ' pv-flow'; d.style.width = box.w + 'px'; meas.appendChild(d); pages.push(d); return d; };
    let cur = newPage();
    const fits = () => cur.scrollHeight <= box.h + 1;
    const place = n => {
      cur.appendChild(n);
      if (fits()) return;
      cur.removeChild(n);
      const isTable = n.tagName === 'TABLE', isList = n.tagName === 'UL' || n.tagName === 'OL';
      if (isTable || isList) {
        const head = isTable && n.tHead && n.tBodies.length ? n.tHead : null;  // la fila de títulos se repite en cada página
        const items = isTable ? [...n.querySelectorAll(head ? ':scope > tr, :scope > tbody > tr' : ':scope > tr, :scope > tbody > tr, :scope > thead > tr')] : [...n.children];
        if (items.length > 1) {
          let count = 0, shell, body;
          const mk = () => { shell = n.cloneNode(false); if (isTable) { if (head) shell.appendChild(head.cloneNode(true)); body = document.createElement('tbody'); shell.appendChild(body); } else { body = shell; if (n.tagName === 'OL') shell.start = (n.start || 1) + count; } cur.appendChild(shell); };
          mk();
          for (const it of items) {
            const c = it.cloneNode(true); body.appendChild(c);
            if (!fits()) {
              body.removeChild(c);
              if (body.children.length) { cur = newPage(); mk(); body.appendChild(c); }
              else { body.appendChild(c); }  // no cabe ni solo: se queda (se corta)
              if (!fits() && body.children.length === 1 && cur.children.length > 1) { cur.removeChild(shell); cur = newPage(); mk(); body.appendChild(c); }
            }
            count++;
          }
          return;
        }
      }
      if (cur.childNodes.length) { cur = newPage(); cur.appendChild(n); }
      else cur.appendChild(n);
      if (!fits()) cur = newPage();  // bloque más alto que una página: ocupa la suya entera
    };
    for (const n of nodes) place(n);
    if (!cur.childNodes.length && pages.length > 1) { pages.pop(); cur.remove(); }
    pages.forEach(p => p.remove()); meas.remove();
    return pages;
  }
  // páginas de un PDF: cada una se dibuja ajustada al papel (con lo escrito o dibujado aunque no esté guardado)
  async function pdfPages(doc, lib, box) {
    const out = [], n = Math.min(doc.numPages, 300), q = 2;
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i), v1 = page.getViewport({scale: 1});
      const sc = Math.min(box.w / v1.width, box.h / v1.height), vp = page.getViewport({scale: sc * q});
      const cv = document.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      await page.render({canvasContext: ctx, canvas: cv, viewport: vp, intent: 'print', annotationMode: lib.AnnotationMode.ENABLE_STORAGE,
        printAnnotationStorage: doc.annotationStorage.print}).promise;
      const img = new Image(); img.style.width = vp.width / q + 'px'; img.style.height = vp.height / q + 'px'; img.className = 'pv-img';
      img.src = URL.createObjectURL(await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92)));
      cv.width = cv.height = 0;
      out.push(img);
    }
    return out;
  }
  // páginas de Word tal como las dibuja docx-preview, reducidas si no caben en el papel
  function docxViewPages(box) {
    return [...el('ofDocx').querySelectorAll('section.docx')].map(sec => {
      const cs = getComputedStyle(sec), w = parseFloat(cs.width), h = Math.max(parseFloat(cs.height), parseFloat(cs.minHeight) || 0);
      const sc = Math.min(1, box.w / w, box.h / h);
      const wrap = document.createElement('div'); wrap.className = 'docx-wrapper pv-docx'; wrap.style.cssText = `width:${w * sc}px;height:${h * sc}px`;
      const c = sec.cloneNode(true); c.style.transform = `scale(${sc})`; c.style.transformOrigin = '0 0'; c.style.margin = '0'; c.style.boxShadow = 'none';
      wrap.appendChild(c); return wrap;
    });
  }
  function menu() {
    const m = el('ofMenu'); if (!m.classList.contains('hidden')) return m.classList.add('hidden');
    const opts = [];
    if (!O.ro && O.export) opts.push(['save', 'save', 'Guardar']);
    if (O.export) opts.push(['copy', 'copyFile', O.ro ? 'Guardar una copia en Mi unidad' : 'Guardar una copia…']);
    opts.push(['download', 'download', 'Descargar']);
    if (O.print && !IN_APP) opts.push(['print', 'print', 'Imprimir o guardar como PDF']);
    m.innerHTML = opts.map(o => `<button data-of="${o[0]}">${ic(o[1])}${t(o[2])}</button>`).join('');
    m.classList.remove('hidden');
  }
  el('ofMenu').addEventListener('click', e => {
    const a = e.target.closest('[data-of]')?.dataset.of; if (!a) return; el('ofMenu').classList.add('hidden');
    if (a === 'save') save(); if (a === 'copy') save(true); if (a === 'download') download(); if (a === 'print') O.print?.();
  });
  document.addEventListener('click', e => { if (!e.target.closest('#ofMore') && !e.target.closest('#ofMenu')) el('ofMenu').classList.add('hidden'); });
  paintIcons(el('office')); el('ofSave').querySelector('i').dataset.i = 'save'; el('ofSave').querySelector('i').innerHTML = svg('save');
  el('ofPrint').querySelector('i').innerHTML = svg('print');
  el('ofClose').onclick = close; el('ofSave').onclick = () => save(); el('ofPrint').onclick = () => O?.print?.(); el('ofMore').onclick = menu;
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
    // imprimir: el PDF tal como se ve ahora (con lo que se haya escrito o dibujado, aunque no esté guardado)
    O.pages = box => pdfPages(doc, lib, box); O.pagesMargin = 'ninguno'; O.print = printPreview;
    if (!O.ro) setMode(T.NONE); else bar.querySelector('[data-tb="p-none"]').classList.add('on');
  };

  /* ================= Word (.docx) ================= */
  const PAGE_STYLE = 'Normal';
  OPEN.docx = async (opts) => {
    if (opts.isNew) return docEdit('', {fmt: '.docx', note: false});
    const buf = await fetchBuf();
    O.buf = buf; O.viewOnly = true;
    const dp = await DocxPreview();
    const body = el('ofBody');
    body.innerHTML = '<div class="of-scroll of-docview"><div id="ofDocx"></div></div>';
    tools(O.ro ? ['<span class="tb-txt">' + esc(t('Vista del documento')) + '</span>'] : [['d-edit', 'Editar el documento', 'edit', 'Editar']]);
    el('ofTools').onclick = async e => {
      if (!e.target.closest('[data-tb="d-edit"]')) return;
      el('ofBody').innerHTML = `<div class="of-loading">${t('Preparando el documento para editarlo…')}</div>`;
      const m = await Mammoth();
      const r = await m.convertToHtml({arrayBuffer: O.buf.slice(0)}, {styleMap: ['u => u', 'strike => s', "p[style-name='Title'] => h1.title:fresh", "p[style-name='Subtitle'] => h2.subtitle:fresh"], includeDefaultStyleMap: true});
      O.lossy = !O.confirmed; docEdit(r.value, {fmt: '.docx'});
    };
    await dp.renderAsync(buf.slice(0), el('ofDocx'), null, {className: 'docx', inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true,
      ignoreWidth: false, experimental: true, useBase64URL: true, renderHeaders: true, renderFooters: true, renderComments: false});
    fitPages();
    O.pages = box => docxViewPages(box); O.pagesMargin = 'ninguno'; O.print = printPreview;
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

  // página editable para Word, LibreOffice Writer (.odt) y los .doc / .rtf antiguos.  o.fmt: formato al guardar
  async function docEdit(html, o = {}) {
    const body = el('ofBody');
    O.editing = true; O.viewOnly = false;
    const note = o.note === false ? '' : (o.noteText || t('Estás editando. Se conservan los textos, títulos, listas, tablas, imágenes y enlaces; algunos diseños complicados pueden simplificarse al guardar.'));
    body.innerHTML = `<div class="of-scroll of-docedit">${note ? `<div class="of-note">${ic('info')}<span>${esc(note)}</span></div>` : ''}
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
    O.export = ext => (ext || o.fmt) === '.odt' ? htmlToOdt(page) : htmlToDocx(page);
    O.pages = (box, host) => flowPages([...page.childNodes].filter(n => n.nodeType === 1 || n.data.trim()).map(n => n.nodeType === 1 ? n.cloneNode(true) : Object.assign(document.createElement('p'), {textContent: n.data})), box, 'of-page', host);
    O.pagesMargin = null; O.print = printPreview;
    header();
    if (!html) { page.focus(); }
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
    } else if (kind === 'sheetjs') {
      const r = await sheetjsData(await fetchBuf());
      data = r.data; O.sjsOrig = r.orig;
      O.lossy = !O.confirmed;
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
      if (kind === 'sheetjs' || ext === '.ods' || ext === '.xls') return dataToSheetjs(now, O.sjsOrig || [], ext || extOf(O.name));
      const EJ = await ExcelJS();
      let book = O.wb;
      if (!book) { book = new EJ.Workbook(); }
      dataToWb(book, now, JSON.parse(O.snap));
      return new Blob([await book.xlsx.writeBuffer()], {type: MIME['.xlsx']});
    };
    O.afterSave = async () => { O.snap = JSON.stringify(xs.getData()); };
    O.print = () => xs.sheet.print.preview();  // vista previa de la hoja con su botón de imprimir
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
    O.pages = (box, host) => flowPages(ta.value.split('\n').map(l => Object.assign(document.createElement('div'), {textContent: l || '\u200b'})), box, 'pv-textpage', host);
    O.pagesMargin = null; O.print = printPreview;
    if (opts.isNew) ta.focus();
  };

  /* ================= LibreOffice Writer (.odt) ================= */
  const Zip = () => lib('jszip.min.js', 'JSZip');
  const xmlDoc = s => new DOMParser().parseFromString(s, 'application/xml');
  const lenPx = v => { const m = /^([\d.]+)(cm|mm|in|pt|px)?$/.exec(v || ''); if (!m) return null; return +m[1] * ({cm: 37.795, mm: 3.7795, in: 96, pt: 4 / 3, px: 1}[m[2] || 'px']); };
  function odfStyles(...docs) {
    const S2 = {}, L = {};
    for (const d of docs) {
      if (!d) continue;
      for (const st of d.getElementsByTagName('style:style')) {
        const tp = st.getElementsByTagName('style:text-properties')[0], pp = st.getElementsByTagName('style:paragraph-properties')[0], o = {parent: st.getAttribute('style:parent-style-name')};
        if (tp) {
          if (tp.getAttribute('fo:font-weight') === 'bold') o.bold = true;
          if (tp.getAttribute('fo:font-style') === 'italic') o.italic = true;
          const u = tp.getAttribute('style:text-underline-style'); if (u && u !== 'none') o.underline = true;
          const l = tp.getAttribute('style:text-line-through-style'); if (l && l !== 'none') o.strike = true;
          const c = tp.getAttribute('fo:color'); if (c && c !== '#000000') o.color = c;
          const bg = tp.getAttribute('fo:background-color'); if (bg && bg !== 'transparent') o.bg = bg;
          const fs = tp.getAttribute('fo:font-size'); if (fs && /pt$/.test(fs)) o.size = parseFloat(fs);
        }
        if (pp) { const a = pp.getAttribute('fo:text-align'); if (a) o.align = {end: 'right', right: 'right', center: 'center', justify: 'justify'}[a]; }
        S2[st.getAttribute('style:name')] = o;
      }
      for (const ls of d.getElementsByTagName('text:list-style')) {
        const first = [...ls.children].find(x => x.getAttribute('text:level') === '1');
        L[ls.getAttribute('style:name')] = first && first.localName === 'list-level-style-number' && first.getAttribute('style:num-format') ? 'ol' : 'ul';
      }
    }
    const get = (n, seen = 0) => { const o = S2[n]; if (!o || seen > 8) return {}; return {...(o.parent ? get(o.parent, seen + 1) : {}), ...o}; };
    return {get, list: n => L[n]};
  }
  async function odtToHtml(buf) {
    const Z = await Zip(), zip = await Z.loadAsync(buf);
    const content = xmlDoc(await zip.file('content.xml').async('string'));
    const styles = zip.file('styles.xml') ? xmlDoc(await zip.file('styles.xml').async('string')) : null;
    const st = odfStyles(styles, content);
    const imgs = {};
    for (const f of Object.keys(zip.files)) if (/\.(png|jpe?g|gif|bmp)$/i.test(f)) imgs[f] = f;
    const css = o => [o.bold && 'font-weight:bold', o.italic && 'font-style:italic', (o.underline || o.strike) && `text-decoration:${[o.underline && 'underline', o.strike && 'line-through'].filter(Boolean).join(' ')}`,
      o.color && `color:${o.color}`, o.bg && `background-color:${o.bg}`, o.size && `font-size:${o.size}pt`].filter(Boolean).join(';');
    async function inline(node) {
      let h = '';
      for (const n of node.childNodes) {
        if (n.nodeType === 3) { h += esc(n.data); continue; }
        if (n.nodeType !== 1) continue;
        const ln = n.localName;
        if (ln === 's') h += '&nbsp;'.repeat(+(n.getAttribute('text:c') || 1));
        else if (ln === 'tab') h += '&emsp;';
        else if (ln === 'line-break') h += '<br>';
        else if (ln === 'span') { const c = css(st.get(n.getAttribute('text:style-name'))); const inner = await inline(n); h += c ? `<span style="${c}">${inner}</span>` : inner; }
        else if (ln === 'a') { const href = n.getAttribute('xlink:href') || ''; const inner = await inline(n); h += /^(https?:|mailto:)/i.test(href) ? `<a href="${esc(href)}">${inner}</a>` : inner; }
        else if (ln === 'frame') {
          const im = n.getElementsByTagName('draw:image')[0], href = im?.getAttribute('xlink:href');
          if (href && zip.file(href)) {
            const ext = href.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
            const b64 = await zip.file(href).async('base64'), w = lenPx(n.getAttribute('svg:width'));
            h += `<img src="data:image/${ext};base64,${b64}" alt=""${w ? ` width="${Math.round(Math.min(w, 640))}"` : ''}>`;
          } else { const tb = n.getElementsByTagName('draw:text-box')[0]; if (tb) h += await blocks(tb); }
        }
        else if (['note', 'annotation', 'bookmark', 'bookmark-start', 'bookmark-end', 'soft-page-break', 'sequence-decls', 'tracked-changes'].includes(ln)) continue;
        else h += await inline(n);
      }
      return h;
    }
    async function blocks(node, listType) {
      let h = '';
      for (const n of node.children) {
        const ln = n.localName, o = st.get(n.getAttribute('text:style-name'));
        const al = o.align ? ` style="text-align:${o.align}"` : '';
        if (ln === 'h') { const lv = Math.min(3, +(n.getAttribute('text:outline-level') || 1)); h += `<h${lv}${al}>${await inline(n) || '<br>'}</h${lv}>`; }
        else if (ln === 'p') {
          const sn = (n.getAttribute('text:style-name') || '') + ' ' + (st.get(n.getAttribute('text:style-name')).parent || '');
          const inner = await inline(n), c = css(o);
          if (/\bTitle\b/.test(sn)) h += `<h1 class="title"${al}>${inner || '<br>'}</h1>`;
          else if (/Quotations/.test(sn)) h += `<blockquote>${inner}</blockquote>`;
          else h += `<p${al}>${c && inner ? `<span style="${c}">${inner}</span>` : inner || '<br>'}</p>`;
        }
        else if (ln === 'list') {
          const tag = st.list(n.getAttribute('text:style-name')) || listType || 'ul';
          let items = '';
          for (const li of n.children) if (li.localName === 'list-item' || li.localName === 'list-header') {
            let inner = '';
            for (const c of li.children) inner += c.localName === 'p' || c.localName === 'h' ? (inner && !/<\/(ul|ol)>$/.test(inner) ? '<br>' : '') + await inline(c) : await blocks({children: [c]}, tag);
            items += `<li>${inner || '<br>'}</li>`;
          }
          h += `<${tag}>${items}</${tag}>`;
        }
        else if (ln === 'table') {
          let rows = '';
          const trs = [...n.getElementsByTagName('table:table-row')].filter(r => r.closest ? true : true);
          for (const tr of trs) {
            if (tr.parentElement.closest?.('table\\:table') && false) continue;
            let tds = '';
            for (const td of tr.children) {
              if (td.localName !== 'table-cell') continue;
              const cs = +(td.getAttribute('table:number-columns-spanned') || 1), rs = +(td.getAttribute('table:number-rows-spanned') || 1);
              tds += `<td${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}>${await blocks(td) || '<br>'}</td>`;
            }
            rows += `<tr>${tds}</tr>`;
          }
          h += `<table class="of-table"><tbody>${rows}</tbody></table>`;
        }
        else if (['section', 'index-body', 'table-of-content', 'alphabetical-index', 'illustration-index', 'table-index', 'object-index', 'user-index', 'bibliography'].includes(ln)) h += await blocks(n.localName === 'section' ? n : (n.getElementsByTagName('text:index-body')[0] || n), listType);
        else if (ln === 'frame' || ln === 'custom-shape') h += `<p>${await inline({childNodes: [n]})}</p>`;
      }
      return h;
    }
    const body = content.getElementsByTagName('office:text')[0];
    return body ? blocks(body) : '';
  }

  /* HTML de la página editable → .odt (LibreOffice Writer), escrito a mano con JSZip */
  async function htmlToOdt(page) {
    const Z = await Zip(), zip = new Z();
    const X = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
    const pageColor = rgbHex(getComputedStyle(page).color), basePx = parseFloat(getComputedStyle(page).fontSize);
    const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'TABLE', 'BLOCKQUOTE', 'PRE', 'HR', 'SECTION', 'ARTICLE']);
    const isBlock = n => n.nodeType === 1 && BLOCK.has(n.tagName);
    const tStyles = {}, pStyles = {}; let tN = 0, pN = 0, imgN = 0, tblN = 0;
    const pics = [];
    const tStyle = o => { const k = JSON.stringify(o); if (k === '{}') return null; return tStyles[k] ||= {name: 'T' + (++tN), o}; };
    const pStyle = (parent, align) => { if (!align) return parent; const k = parent + '|' + align; return (pStyles[k] ||= {name: 'P' + (++pN), parent, align}).name; };
    function fmt(textNode) {
      const e = textNode.parentElement, cs = getComputedStyle(e), o = {};
      if (+cs.fontWeight >= 600 || cs.fontWeight === 'bold') o.b = 1;
      if (cs.fontStyle === 'italic') o.i = 1;
      for (let x = e; x && x !== page && !isBlock(x); x = x.parentElement) {
        const xs = getComputedStyle(x), d = xs.textDecorationLine || '';
        if (x.tagName === 'U' || d.includes('underline')) o.u = 1;
        if (['S', 'STRIKE', 'DEL'].includes(x.tagName) || d.includes('line-through')) o.s = 1;
        if (!o.bg && xs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(xs.backgroundColor)) o.bg = '#' + rgbHex(xs.backgroundColor);
      }
      const c = rgbHex(cs.color); if (c && c !== pageColor && !e.closest('a')) o.c = '#' + c;
      const px = parseFloat(cs.fontSize); if (px && Math.abs(px - basePx) > 0.5 && !e.closest('h1,h2,h3,h4,h5,h6')) o.sz = Math.round(px * 0.75 * 2) / 2;
      return o;
    }
    const spaces = txt => X(txt).replace(/ {2,}/g, m => ' ' + `<text:s text:c="${m.length - 1}"/>`).replace(/\t/g, '<text:tab/>');
    function runs(nodes) {
      let h = '';
      for (const n of nodes) {
        if (n.nodeType === 3) { const txt = n.data.replace(/[\r\n]+/g, ' ').replace(/ /g, ' '); if (!txt) continue; const st = tStyle(fmt(n)); h += st ? `<text:span text:style-name="${st.name}">${spaces(txt)}</text:span>` : spaces(txt); }
        else if (n.nodeType !== 1) continue;
        else if (n.tagName === 'BR') h += '<text:line-break/>';
        else if (n.tagName === 'IMG') {
          const m = /^data:image\/(png|jpe?g|gif|bmp);base64,(.*)$/i.exec(n.getAttribute('src') || ''); if (!m) continue;
          const ext = m[1].toLowerCase().replace('jpeg', 'jpg'), file = `Pictures/img${++imgN}.${ext}`;
          zip.file(file, m[2], {base64: true}); pics.push([file, 'image/' + m[1].toLowerCase().replace('jpg', 'jpeg')]);
          let w = n.width || n.naturalWidth || 300, hh = n.height || n.naturalHeight || 200; if (w > 600) { hh = Math.round(hh * 600 / w); w = 600; }
          h += `<draw:frame draw:name="Imagen${imgN}" text:anchor-type="as-char" svg:width="${(w / 37.795).toFixed(3)}cm" svg:height="${(hh / 37.795).toFixed(3)}cm" draw:z-index="${imgN}"><draw:image xlink:href="${file}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`;
        }
        else if (n.tagName === 'A' && /^(https?:|mailto:)/i.test(n.getAttribute('href') || '')) h += `<text:a xlink:type="simple" xlink:href="${X(n.getAttribute('href'))}">${runs(n.childNodes)}</text:a>`;
        else if (!['SCRIPT', 'STYLE'].includes(n.tagName)) h += runs(n.childNodes);
      }
      return h;
    }
    const ALIGN = {center: 'center', right: 'end', end: 'end', justify: 'justify'};
    function para(nodes, blk) {
      const tag = blk?.tagName, al = blk ? ALIGN[getComputedStyle(blk).textAlign] : null, inner = runs(nodes);
      if (/^H[1-6]$/.test(tag)) {
        if (blk.classList.contains('title')) return `<text:p text:style-name="${pStyle('Title', al)}">${inner}</text:p>`;
        const lv = Math.min(+tag[1], 3);
        return `<text:h text:style-name="${pStyle('Heading_20_' + lv, al)}" text:outline-level="${lv}">${inner}</text:h>`;
      }
      return `<text:p text:style-name="${pStyle(tag === 'BLOCKQUOTE' || blk?.closest?.('blockquote') ? 'Quotations' : 'Standard', al)}">${inner}</text:p>`;
    }
    function container(elm, blk) {
      let out = '', inl = [];
      const flush = () => { if (inl.length) { if (inl.some(n => n.nodeType === 1 || n.data.trim())) out += para(inl, blk); inl = []; } };
      for (const n of elm.childNodes) {
        if (n.nodeType === 3 || (n.nodeType === 1 && !isBlock(n))) inl.push(n);
        else if (n.nodeType === 1) { flush(); out += block(n); }
      }
      flush();
      if (blk && blk !== page && !out) out = para([], blk);
      return out;
    }
    function block(n) {
      const tag = n.tagName;
      if (tag === 'UL' || tag === 'OL') {
        let items = '';
        for (const li of n.children) items += li.tagName === 'LI' ? `<text:list-item>${container(li, li)}</text:list-item>` : `<text:list-item>${block(li)}</text:list-item>`;
        return `<text:list text:style-name="${tag === 'OL' ? 'LNum' : 'LBul'}">${items}</text:list>`;
      }
      if (tag === 'TABLE') {
        const trs = [...n.querySelectorAll(':scope > tr, :scope > tbody > tr, :scope > thead > tr, :scope > tfoot > tr')];
        const cols = Math.max(1, ...trs.map(tr => [...tr.children].reduce((a, td) => a + (td.colSpan || 1), 0)));
        let rows = '';
        for (const tr of trs) {
          let cells = '';
          for (const td of tr.children) {
            if (!['TD', 'TH'].includes(td.tagName)) continue;
            const span = td.colSpan > 1 ? ` table:number-columns-spanned="${td.colSpan}"` : '', rs = td.rowSpan > 1 ? ` table:number-rows-spanned="${td.rowSpan}"` : '';
            cells += `<table:table-cell table:style-name="TCell" office:value-type="string"${span}${rs}>${container(td, td) || '<text:p/>'}</table:table-cell>` + '<table:covered-table-cell/>'.repeat(Math.max(0, (td.colSpan || 1) - 1));
          }
          rows += `<table:table-row>${cells}</table:table-row>`;
        }
        return `<table:table table:name="Tabla${++tblN}" table:style-name="TTable"><table:table-column table:number-columns-repeated="${cols}"/>${rows}</table:table>`;
      }
      if (tag === 'HR') return '<text:p text:style-name="Horizontal_20_Line"/>';
      return container(n, n);
    }
    const bodyXml = container(page, null) || '<text:p text:style-name="Standard"/>';
    const tProps = o => [o.b && 'fo:font-weight="bold" style:font-weight-asian="bold" style:font-weight-complex="bold"', o.i && 'fo:font-style="italic" style:font-style-asian="italic"',
      o.u && 'style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"', o.s && 'style:text-line-through-style="solid"',
      o.c && `fo:color="${o.c}"`, o.bg && `fo:background-color="${o.bg}"`, o.sz && `fo:font-size="${o.sz}pt"`].filter(Boolean).join(' ');
    const auto = Object.values(tStyles).map(s2 => `<style:style style:name="${s2.name}" style:family="text"><style:text-properties ${tProps(s2.o)}/></style:style>`).join('') +
      Object.values(pStyles).map(s2 => `<style:style style:name="${s2.name}" style:family="paragraph" style:parent-style-name="${s2.parent}"><style:paragraph-properties fo:text-align="${s2.align}"/></style:style>`).join('') +
      `<style:style style:name="TTable" style:family="table"><style:table-properties style:width="17cm" table:align="margins"/></style:style>
       <style:style style:name="TCell" style:family="table-cell"><style:table-cell-properties fo:padding="0.1cm" fo:border="0.5pt solid #9e9e9e"/></style:style>
       <text:list-style style:name="LBul">${[1, 2, 3, 4, 5].map(l => `<text:list-level-style-bullet text:level="${l}" text:bullet-char="${'•◦▪•◦'[l - 1]}"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.635cm" fo:margin-left="${(0.635 * l + 0.635).toFixed(3)}cm"/></style:list-level-properties></text:list-level-style-bullet>`).join('')}</text:list-style>
       <text:list-style style:name="LNum">${[1, 2, 3, 4, 5].map(l => `<text:list-level-style-number text:level="${l}" style:num-suffix="." style:num-format="${['1', 'a', 'i', '1', 'a'][l - 1]}"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.635cm" fo:margin-left="${(0.635 * l + 0.635).toFixed(3)}cm"/></style:list-level-properties></text:list-level-style-number>`).join('')}</text:list-style>`;
    const NSs = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"';
    const FONTS = '<office:font-face-decls><style:font-face style:name="Carlito" svg:font-family="Carlito, Calibri" style:font-family-generic="swiss"/></office:font-face-decls>';
    zip.file('mimetype', 'application/vnd.oasis.opendocument.text', {compression: 'STORE'});
    zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NSs} office:version="1.3">${FONTS}<office:automatic-styles>${auto}</office:automatic-styles><office:body><office:text>${bodyXml}</office:text></office:body></office:document-content>`);
    const head = (name, disp, size, color, lv) => `<style:style style:name="${name}" style:display-name="${disp}" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard"${lv ? ` style:default-outline-level="${lv}"` : ''} style:class="text"><style:paragraph-properties fo:margin-top="0.35cm" fo:margin-bottom="0.15cm" fo:keep-with-next="always"/><style:text-properties fo:font-size="${size}pt" fo:font-weight="${name === 'Title' ? 'normal' : 'bold'}" fo:color="${color}"/></style:style>`;
    zip.file('styles.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NSs} office:version="1.3">${FONTS}<office:styles>
      <style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0.21cm" fo:line-height="115%"/><style:text-properties style:font-name="Carlito" fo:font-size="11pt" fo:language="${LANG}" fo:country="${LANG === 'es' ? 'ES' : 'GB'}"/></style:default-style>
      <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
      ${head('Title', 'Title', 26, '#111111', 0)}${head('Heading_20_1', 'Heading 1', 20, '#1f3864', 1)}${head('Heading_20_2', 'Heading 2', 15, '#2f5496', 2)}${head('Heading_20_3', 'Heading 3', 12.5, '#1f3864', 3)}
      <style:style style:name="Quotations" style:display-name="Quotations" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="1cm" fo:margin-right="1cm"/><style:text-properties fo:font-style="italic" fo:color="#404040"/></style:style>
      <style:style style:name="Horizontal_20_Line" style:display-name="Horizontal Line" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:border-bottom="0.5pt solid #808080"/></style:style>
      </office:styles><office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin-top="2cm" fo:margin-bottom="2cm" fo:margin-left="2cm" fo:margin-right="2cm"/></style:page-layout></office:automatic-styles>
      <office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles></office:document-styles>`);
    zip.file('meta.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-meta ${NSs} office:version="1.3"><office:meta><meta:generator>DrivePanel</meta:generator></office:meta></office:document-meta>`);
    zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
      <manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/>
      <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
      ${pics.map(([f, m]) => `<manifest:file-entry manifest:full-path="${f}" manifest:media-type="${m}"/>`).join('')}</manifest:manifest>`);
    return zip.generateAsync({type: 'blob', mimeType: MIME['.odt'], compression: 'DEFLATE'});
  }
  OPEN.odt = async () => {
    const html = await odtToHtml(await fetchBuf());
    O.lossy = !O.confirmed;
    docEdit(html, {fmt: '.odt'});
  };

  /* ================= Word antiguo (.doc) y .rtf: se saca el texto ================= */
  // .doc (Word 97-2003): se lee la "tabla de piezas" del archivo para sacar el texto, sin formato
  async function docText(buf) {
    const XL = await lib('xlsx.full.min.js', 'XLSX');
    const cfb = XL.CFB.read(new Uint8Array(buf), {type: 'array'});
    const wd = XL.CFB.find(cfb, 'WordDocument'); if (!wd) throw new Error(t('No es un documento de Word válido'));
    const bytes = c => c instanceof Uint8Array ? c : Uint8Array.from(c || []);
    const W = bytes(wd.content), u16 = (b, o) => b[o] | (b[o + 1] << 8), u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
    const flags = u16(W, 0x0A);
    if (flags & 0x0100) throw new Error(t('Este documento tiene contraseña'));
    const tbl = XL.CFB.find(cfb, flags & 0x0200 ? '1Table' : '0Table'); if (!tbl) throw new Error(t('No es un documento de Word válido'));
    const T = bytes(tbl.content), fcClx = u32(W, 0x01A2), lcbClx = u32(W, 0x01A6);
    let i = fcClx, end = fcClx + lcbClx, txt = '';
    while (i < end && T[i] === 0x01) i += 3 + u16(T, i + 1);
    if (T[i] !== 0x02) throw new Error(t('No es un documento de Word válido'));
    const lcb = u32(T, i + 1), base = i + 5, n = (lcb - 4) / 12;
    const cp1252 = new TextDecoder('windows-1252'), u16le = new TextDecoder('utf-16le');
    for (let k = 0; k < n; k++) {
      const cpA = u32(T, base + k * 4), cpB = u32(T, base + (k + 1) * 4), pcd = base + (n + 1) * 4 + k * 8;
      let fc = u32(T, pcd + 2); const comp = (fc & 0x40000000) !== 0; fc &= 0x3FFFFFFF;
      const len = cpB - cpA;
      txt += comp ? cp1252.decode(W.subarray(fc / 2, fc / 2 + len)) : u16le.decode(W.subarray(fc, fc + len * 2));
    }
    // códigos de campo: \x13 instrucciones \x14 resultado \x15 → solo el resultado
    txt = txt.replace(/\x13[^\x13\x14\x15]*\x14([^\x15]*)\x15/g, '$1').replace(/\x13[^\x15]*\x15/g, '');
    const ccp = u32(W, 0x004C); if (ccp && ccp < txt.length) txt = txt.slice(0, ccp);  // solo el texto principal (sin notas ni encabezados)
    return txt.replace(/\x07\x07\r?/g, '\x01\r').replace(/\x07\r?/g, '\x01').replace(/[\x02-\x08\x0b\x0e-\x1f]/g, '').replace(/\x0c/g, '\r');
  }
  // .rtf: texto con negrita, cursiva y subrayado
  function rtfToHtml(src) {
    let i = 0, para = '';
    const stack = [], cur = {b: 0, i: 0, u: 0, skip: 0, uc: 1};
    const SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr', 'footnote', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'xmlnstbl', 'themedata', 'colorschememapping', 'latentstyles', 'datastore', 'object', 'filetbl', 'revtbl', 'pgdsctbl', 'mmathPr', 'fldinst']);
    const cp = new TextDecoder('windows-1252');
    const put = s => { if (cur.skip) return; let x = esc(s); if (cur.b) x = `<b>${x}</b>`; if (cur.i) x = `<i>${x}</i>`; if (cur.u) x = `<u>${x}</u>`; para += x; };
    const paras = [], endPara = () => { paras.push(para); para = ''; };
    while (i < src.length) {
      const ch = src[i];
      if (ch === '{') { stack.push({...cur}); i++; if (src.startsWith('\\*', i)) { cur.skip = 1; } continue; }
      if (ch === '}') { Object.assign(cur, stack.pop() || {}); i++; continue; }
      if (ch === '\\') {
        const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(src.slice(i, i + 40));
        if (m) {
          i += m[0].length; const w = m[1], arg = m[2] !== undefined ? +m[2] : null;
          if (SKIP.has(w)) cur.skip = 1;
          else if (w === 'par' || w === 'sect') endPara();
          else if (w === 'line') put('\n'), para = para.replace(/\n(<\/[biu]>)*$/, '<br>$1');
          else if (w === 'tab') put('\t');
          else if (w === 'cell') { if (!cur.skip) para += '\x01'; }
          else if (w === 'row') endPara();
          else if (w === 'b') cur.b = arg === 0 ? 0 : 1;
          else if (w === 'i') cur.i = arg === 0 ? 0 : 1;
          else if (w === 'ul') cur.u = 1; else if (w === 'ulnone') cur.u = 0;
          else if (w === 'plain') cur.b = cur.i = cur.u = 0;
          else if (w === 'uc') cur.uc = arg ?? 1;
          else if (w === 'u') { put(String.fromCharCode(arg < 0 ? arg + 65536 : arg)); for (let k = 0; k < cur.uc && i < src.length; k++) i += src[i] === '\\' && src[i + 1] === "'" ? 4 : 1; }
          else if (w === 'emdash') put('—'); else if (w === 'endash') put('–'); else if (w === 'bullet') put('•');
          else if (w === 'lquote') put('‘'); else if (w === 'rquote') put('’'); else if (w === 'ldblquote') put('“'); else if (w === 'rdblquote') put('”');
          continue;
        }
        const nx = src[i + 1];
        if (nx === "'") { put(cp.decode(new Uint8Array([parseInt(src.substr(i + 2, 2), 16)]))); i += 4; continue; }
        if (nx === '\n' || nx === '\r') { endPara(); i += 2; continue; }
        if (nx === '~') { put(' '); i += 2; continue; }
        put(nx || ''); i += 2; continue;
      }
      if (ch === '\r' || ch === '\n') { i++; continue; }
      put(ch); i++;
    }
    if (para) endPara();
    return withTables(paras);
  }
  // párrafos con separadores de celda (\x01) seguidos → una tabla
  function withTables(paras) {
    let h = '', rows = [];
    const flush = () => { if (rows.length) h += `<table>${rows.map(r => `<tr>${r.map(c => `<td>${c || '<br>'}</td>`).join('')}</tr>`).join('')}</table>`; rows = []; };
    for (const p2 of paras) {
      if (p2.includes('\x01')) { const cells = p2.split('\x01'); if (cells.length > 1 && !cells[cells.length - 1].replace(/<[^>]+>/g, '').trim()) cells.pop(); rows.push(cells); continue; }
      flush(); h += `<p>${p2 || '<br>'}</p>`;
    }
    flush();
    return h;
  }
  OPEN.olddoc = async () => {
    const buf = await fetchBuf(), e = extOf(O.name);
    let html;
    if (e === '.rtf') html = rtfToHtml(new TextDecoder('windows-1252').decode(buf));
    else {
      const head = new Uint8Array(buf.slice(0, 8));
      if (head[0] === 0x50 && head[1] === 0x4B) { O.type = 'docx'; return OPEN.docx({}); }  // en realidad es un .docx con otro nombre
      if (head[0] === 0x7B && head[1] === 0x5C) html = rtfToHtml(new TextDecoder('windows-1252').decode(buf));
      else html = withTables((await docText(buf)).split('\r').map(l => esc(l)));
    }
    O.copyOnly = true; O.confirmed = false;
    docEdit(html, {fmt: '.docx', noteText: e === '.rtf' ? t('Este formato antiguo se abre con el texto y la negrita, cursiva y subrayado. Al guardar se crea una copia en Word (.docx) o LibreOffice (.odt); el original no se toca.')
      : t('Los Word antiguos (.doc) se abren solo con el texto, sin el formato. Al guardar se crea una copia en Word (.docx) o LibreOffice (.odt); el original no se toca.')});
  };

  /* ================= Excel antiguo (.xls), LibreOffice Calc (.ods) ================= */
  // con SheetJS: se leen datos, fórmulas, hojas, celdas combinadas y anchos; los colores no
  async function sheetjsData(buf) {
    const XL = await lib('xlsx.full.min.js', 'XLSX');
    const wb = XL.read(new Uint8Array(buf), {type: 'array', cellFormula: true, cellDates: true, cellNF: true, cellStyles: false});
    const orig = [];
    const data = wb.SheetNames.map((name, si) => {
      const ws = wb.Sheets[name], rows = {}, map = {}; orig[si] = {name, map};
      if (!ws || !ws['!ref']) return {name, rows: {len: 100}, cols: {len: 26}, styles: [], merges: []};
      const rg = XL.utils.decode_range(ws['!ref']);
      for (let r = rg.s.r; r <= Math.min(rg.e.r, 20000); r++) for (let c = rg.s.c; c <= Math.min(rg.e.c, 500); c++) {
        const cell = ws[XL.utils.encode_cell({r, c})]; if (!cell) continue;
        let text;
        if (cell.f) { const fns = cell.f.toUpperCase().match(/[A-Z][A-Z0-9.]*(?=\()/g) || []; text = fns.every(x => XS_FN.has(x)) && !/[!\[]/.test(cell.f) ? '=' + cell.f : (cell.w ?? String(cell.v ?? '')); }
        else text = cell.t === 'd' ? fmtCellDate(cell.v, {numFmt: cell.z || ''}) : (cell.w ?? String(cell.v ?? ''));
        (rows[r] ||= {cells: {}}).cells[c] = {text}; map[r + ':' + c] = {cell, text};
      }
      const merges = (ws['!merges'] || []).map(m => { (rows[m.s.r] ||= {cells: {}}).cells[m.s.c] ||= {text: ''}; rows[m.s.r].cells[m.s.c].merge = [m.e.r - m.s.r, m.e.c - m.s.c]; return XL.utils.encode_range(m); });
      const cols = {len: Math.max(26, rg.e.c + 5)}; (ws['!cols'] || []).forEach((c2, i) => { if (c2 && (c2.wpx || c2.wch)) cols[i] = {width: Math.round(c2.wpx || c2.wch * 7 + 5)}; });
      rows.len = Math.max(100, rg.e.r + 30);
      return {name, rows, cols, styles: [], merges};
    });
    return {data, orig};
  }
  async function dataToSheetjs(sheets, orig, ext) {
    const XL = await lib('xlsx.full.min.js', 'XLSX');
    const wb = XL.utils.book_new();
    sheets.forEach((d, si) => {
      const o = orig.find(x => x.name === d.name) || orig[si] || {map: {}};
      const ws = {}; let maxR = 0, maxC = 0;
      for (const r in d.rows || {}) {
        if (r === 'len') continue;
        for (const c in d.rows[r].cells || {}) {
          const txt = d.rows[r].cells[c].text ?? ''; const was = o.map[r + ':' + c];
          let cell;
          if (was && was.text === txt) cell = {...was.cell};
          else { const v = parseVal(txt); if (!v) continue; cell = 'formula' in v ? {t: 'n', f: v.formula} : 'num' in v ? {t: 'n', v: v.num, ...(v.fmt ? {z: v.fmt} : {})} : 'bool' in v ? {t: 'b', v: v.bool} : {t: 's', v: v.str}; }
          if (cell.t === 'd' && ext === '.xls') { cell.t = 'n'; cell.v = (cell.v - new Date(Date.UTC(1899, 11, 30))) / 864e5; cell.z ||= 'dd/mm/yyyy'; }
          ws[XL.utils.encode_cell({r: +r, c: +c})] = cell; maxR = Math.max(maxR, +r); maxC = Math.max(maxC, +c);
        }
      }
      ws['!ref'] = XL.utils.encode_range({s: {r: 0, c: 0}, e: {r: maxR, c: maxC}});
      if (d.merges?.length) ws['!merges'] = d.merges.map(m => XL.utils.decode_range(m));
      const cols = []; for (const c in d.cols || {}) if (c !== 'len' && d.cols[c]?.width) cols[+c] = {wpx: d.cols[c].width}; if (cols.length) ws['!cols'] = cols;
      XL.utils.book_append_sheet(wb, ws, (d.name || 'Hoja' + (si + 1)).slice(0, 31));
    });
    const out = XL.write(wb, {type: 'array', bookType: {'.xls': 'biff8', '.ods': 'ods', '.xlsx': 'xlsx'}[ext] || 'xlsx', cellDates: ext !== '.xls'});
    return new Blob([out], {type: MIME[ext] || 'application/octet-stream'});
  }
  OPEN.oldsheet = async opts => sheetOpen('sheetjs', opts);

  /* ================= Presentaciones (.pptx y .odp): solo ver ================= */
  const EMU = 1 / 9525;  // EMU → px
  async function pptxSlides(zip) {
    const rd = async p2 => zip.file(p2) ? xmlDoc(await zip.file(p2).async('string')) : null;
    const rels = async p2 => { const d = await rd(p2.replace(/([^/]+)$/, '_rels/$1.rels')); const m = {}; if (d) for (const r of d.getElementsByTagName('Relationship')) m[r.getAttribute('Id')] = {target: new URL(r.getAttribute('Target'), 'http://x/' + p2).pathname.slice(1), type: r.getAttribute('Type')}; return m; };
    const pres = await rd('ppt/presentation.xml'), prel = await rels('ppt/presentation.xml');
    const sz = pres.getElementsByTagName('p:sldSz')[0], W = +sz.getAttribute('cx') * EMU, H = +sz.getAttribute('cy') * EMU;
    const theme = Object.values(prel).find(r => /theme$/.test(r.type)); const th = theme ? await rd(theme.target) : null;
    const scheme = {}; if (th) { const cs = th.getElementsByTagName('a:clrScheme')[0]; if (cs) for (const c of cs.children) { const v = c.getElementsByTagName('a:srgbClr')[0]?.getAttribute('val') || c.getElementsByTagName('a:sysClr')[0]?.getAttribute('lastClr'); if (v) scheme[c.localName] = '#' + v; } }
    Object.assign(scheme, {tx1: scheme.dk1, bg1: scheme.lt1, tx2: scheme.dk2, bg2: scheme.lt2});
    const color = n => { if (!n) return null; const s2 = n.getElementsByTagName('a:srgbClr')[0]; if (s2) return '#' + s2.getAttribute('val'); const sc = n.getElementsByTagName('a:schemeClr')[0]; if (sc) return scheme[sc.getAttribute('val')] || null; return null; };
    const direct = (n, tag) => [...(n?.children || [])].find(c => c.tagName === tag);
    const xfrm = sp => { const x = sp.getElementsByTagName('a:xfrm')[0] || sp.getElementsByTagName('p:xfrm')[0]; if (!x) return null; const o = direct(x, 'a:off'), e = direct(x, 'a:ext'); if (!o || !e) return null; return {x: +o.getAttribute('x') * EMU, y: +o.getAttribute('y') * EMU, w: +e.getAttribute('cx') * EMU, h: +e.getAttribute('cy') * EMU}; };
    const phOf = sp => { const ph = sp.getElementsByTagName('p:ph')[0]; return ph ? {type: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx')} : null; };
    const findPh = (doc, ph) => { if (!doc || !ph) return null; for (const sp of doc.getElementsByTagName('p:sp')) { const p2 = phOf(sp); if (p2 && ((ph.idx && p2.idx === ph.idx) || p2.type === ph.type || (ph.type === 'ctrTitle' && p2.type === 'title') || (ph.type === 'subTitle' && p2.type === 'body'))) return sp; } return null; };
    const order = [...pres.getElementsByTagName('p:sldId')].map(s2 => prel[s2.getAttribute('r:id')]?.target).filter(Boolean);
    const out = [];
    for (const path of order.slice(0, 300)) {
      const sd = await rd(path), sr = await rels(path);
      const layoutP = Object.values(sr).find(r => /slideLayout$/.test(r.type))?.target, layout = layoutP ? await rd(layoutP) : null;
      const masterP = layoutP ? Object.values(await rels(layoutP)).find(r => /slideMaster$/.test(r.type))?.target : null, master = masterP ? await rd(masterP) : null;
      const bgOf = d => { const bg = d?.getElementsByTagName('p:bg')[0]; return bg ? color(bg.getElementsByTagName('a:solidFill')[0]) : null; };
      const slide = {w: W, h: H, bg: bgOf(sd) || bgOf(layout) || bgOf(master) || '#ffffff', items: []};
      const media = async (relId, rmap) => { const r = rmap[relId]; if (!r || !zip.file(r.target)) return null; const ext = r.target.split('.').pop().toLowerCase(); if (!/^(png|jpe?g|gif|bmp|svg)$/.test(ext)) return null; return `data:image/${ext === 'svg' ? 'svg+xml' : ext.replace('jpg', 'jpeg')};base64,` + await zip.file(r.target).async('base64'); };
      const walk = async (tree, off = {dx: 0, dy: 0, sx: 1, sy: 1}) => {
        for (const n of tree.children) {
          const ln = n.tagName;
          if (ln === 'p:grpSp') {
            const g = n.getElementsByTagName('a:xfrm')[0]; let o2 = off;
            if (g) { const co = direct(g, 'a:chOff'), ce = direct(g, 'a:chExt'), x = xfrm(n); if (co && ce && x && +ce.getAttribute('cx')) { const sx = x.w / (+ce.getAttribute('cx') * EMU), sy = x.h / (+ce.getAttribute('cy') * EMU) || 1; o2 = {dx: off.dx + (x.x - +co.getAttribute('x') * EMU * sx) * off.sx, dy: off.dy + (x.y - +co.getAttribute('y') * EMU * sy) * off.sy, sx: off.sx * sx, sy: off.sy * sy}; } }
            await walk(n, o2); continue;
          }
          if (!['p:sp', 'p:pic', 'p:graphicFrame', 'p:cxnSp'].includes(ln)) continue;
          const ph = phOf(n);
          let box = xfrm(n) || xfrm(findPh(layout, ph) || document.createElement('x')) || xfrm(findPh(master, ph) || document.createElement('x'));
          if (!box) continue;
          box = {x: off.dx + box.x * off.sx, y: off.dy + box.y * off.sy, w: box.w * off.sx, h: box.h * off.sy};
          const it = {box};
          if (ln === 'p:pic') { const b = n.getElementsByTagName('a:blip')[0]; it.img = b ? await media(b.getAttribute('r:embed'), sr) : null; if (!it.img) continue; }
          else if (ln === 'p:graphicFrame') {
            const tb = n.getElementsByTagName('a:tbl')[0]; if (!tb) continue;
            it.table = [...tb.getElementsByTagName('a:tr')].map(tr => [...tr.getElementsByTagName('a:tc')].map(tc => [...tc.getElementsByTagName('a:p')].map(p2 => [...p2.getElementsByTagName('a:t')].map(x => x.textContent).join('')).join('\n')));
          } else {
            const spPr = direct(n, 'p:spPr'); it.fill = color(direct(spPr, 'a:solidFill')); const ln2 = spPr ? direct(spPr, 'a:ln') : null; it.line = ln2 && !direct(ln2, 'a:noFill') ? color(direct(ln2, 'a:solidFill')) : null;
            const geom = spPr?.getElementsByTagName('a:prstGeom')[0]?.getAttribute('prst'); it.round = geom === 'ellipse' ? '50%' : geom === 'roundRect' ? '12px' : '';
            const tx = n.getElementsByTagName('p:txBody')[0];
            if (tx) {
              const isTitle = ph && /title/i.test(ph.type);
              const anchor = tx.getElementsByTagName('a:bodyPr')[0]?.getAttribute('anchor');
              it.anchor = anchor === 'ctr' ? 'center' : anchor === 'b' ? 'flex-end' : (isTitle ? 'center' : 'flex-start');
              it.paras = [...tx.getElementsByTagName('a:p')].map(p2 => {
                const pPr = direct(p2, 'a:pPr'), algn = pPr?.getAttribute('algn');
                const bullet = !isTitle && ph && ph.type === 'body' && !pPr?.getElementsByTagName('a:buNone')[0];
                return {align: {ctr: 'center', r: 'right', just: 'justify'}[algn] || (ph?.type === 'ctrTitle' || ph?.type === 'subTitle' ? 'center' : 'left'), lvl: +(pPr?.getAttribute('lvl') || 0), bullet,
                  runs: [...p2.children].filter(r => r.tagName === 'a:r' || r.tagName === 'a:br' || r.tagName === 'a:fld').map(r => {
                    if (r.tagName === 'a:br') return {br: 1};
                    const rp = direct(r, 'a:rPr'); return {text: r.getElementsByTagName('a:t')[0]?.textContent || '', b: rp?.getAttribute('b') === '1', i: rp?.getAttribute('i') === '1', u: rp?.getAttribute('u') && rp.getAttribute('u') !== 'none',
                      sz: rp?.getAttribute('sz') ? +rp.getAttribute('sz') / 100 : null, color: color(direct(rp, 'a:solidFill'))};
                  })};
              });
              const msz = (st2, lvl = 1) => { const x = master?.getElementsByTagName('p:' + st2)[0]?.getElementsByTagName('a:lvl' + lvl + 'pPr')[0]?.getElementsByTagName('a:defRPr')[0]?.getAttribute('sz'); return x ? +x / 100 : null; };
              const tsz = msz('titleStyle'), bsz = msz('bodyStyle'), lsz = l => msz('bodyStyle', l + 1) || bsz;
              it.defSize = isTitle ? (ph.type === 'ctrTitle' ? Math.max(44, tsz || 0) : tsz || 36) : ph?.type === 'subTitle' ? 24 : ph ? (bsz || 20) : (msz('otherStyle') || 18);
              if (ph && !isTitle && ph.type !== 'subTitle') it.paras.forEach(p3 => { p3.lvlSize = lsz(p3.lvl); });
              const fref = direct(n, 'p:style') ? direct(direct(n, 'p:style'), 'a:fontRef') : null;  // color del texto según el estilo de la forma
              it.defColor = (fref && color(fref)) || scheme.tx1 || '#000';
            }
            if (!it.paras && !it.fill && !it.line) continue;
          }
          slide.items.push(it);
        }
      };
      const tree = sd.getElementsByTagName('p:spTree')[0]; if (tree) await walk(tree);
      out.push(slide);
    }
    return out;
  }
  async function odpSlides(zip) {
    const content = xmlDoc(await zip.file('content.xml').async('string'));
    const styles = zip.file('styles.xml') ? xmlDoc(await zip.file('styles.xml').async('string')) : null;
    // tamaño de la diapositiva: el del diseño de página de la página maestra que usan las diapositivas
    const mpName = content.getElementsByTagName('draw:page')[0]?.getAttribute('draw:master-page-name');
    const mp = [...(styles?.getElementsByTagName('style:master-page') || [])].find(m => m.getAttribute('style:name') === mpName);
    const plName = mp?.getAttribute('style:page-layout-name');
    const plEl = [...(styles?.getElementsByTagName('style:page-layout') || [])].find(l => l.getAttribute('style:name') === plName);
    const pl = plEl?.getElementsByTagName('style:page-layout-properties')[0] || styles?.getElementsByTagName('style:page-layout-properties')[0];
    const W = lenPx(pl?.getAttribute('fo:page-width')) || 1024, H = lenPx(pl?.getAttribute('fo:page-height')) || 768;
    const st = odfStyles(styles, content), out = [];
    for (const pg of [...content.getElementsByTagName('draw:page')].slice(0, 300)) {
      const slide = {w: W, h: H, bg: '#ffffff', items: []};
      for (const n of pg.children) {
        const box = {x: lenPx(n.getAttribute('svg:x')) || 0, y: lenPx(n.getAttribute('svg:y')) || 0, w: lenPx(n.getAttribute('svg:width')) || 0, h: lenPx(n.getAttribute('svg:height')) || 0};
        if (!box.w || !box.h) continue;
        const it = {box, anchor: 'flex-start', defSize: n.getAttribute('presentation:class') === 'title' ? 36 : 18, defColor: '#000'};
        const im = n.getElementsByTagName('draw:image')[0], href = im?.getAttribute('xlink:href');
        if (href && zip.file(href) && /\.(png|jpe?g|gif|bmp|svg)$/i.test(href)) { const ext = href.split('.').pop().toLowerCase(); it.img = `data:image/${ext === 'svg' ? 'svg+xml' : ext.replace('jpg', 'jpeg')};base64,` + await zip.file(href).async('base64'); }
        const ps = [...n.getElementsByTagName('text:p')];
        if (ps.length) {
          if (n.getAttribute('presentation:class') === 'title') it.anchor = 'center';
          it.paras = ps.map(p2 => ({align: st.get(p2.getAttribute('text:style-name')).align || 'left', lvl: 0, bullet: !!p2.closest?.('list-item') || p2.parentElement?.localName === 'list-item',
            runs: [...p2.childNodes].map(r => { if (r.nodeType === 3) return {text: r.data}; if (r.localName === 'line-break') return {br: 1}; const o = st.get(r.getAttribute?.('text:style-name')); return {text: r.textContent, b: o.bold, i: o.italic, u: o.underline, sz: o.size, color: o.color}; })}));
        }
        if (it.img || it.paras) slide.items.push(it);
      }
      out.push(slide);
    }
    return out;
  }
  function slideEl(s2) {
    const d = document.createElement('div'); d.className = 'of-slide'; d.style.cssText = `width:${s2.w}px;height:${s2.h}px;background:${s2.bg}`;
    for (const it of s2.items) {
      const e = document.createElement('div'); e.className = 'of-sh';
      e.style.cssText = `left:${it.box.x}px;top:${it.box.y}px;width:${it.box.w}px;height:${it.box.h}px;${it.fill ? `background:${it.fill};` : ''}${it.line ? `border:1px solid ${it.line};` : ''}${it.round ? `border-radius:${it.round};` : ''}justify-content:${it.anchor || 'flex-start'}`;
      if (it.img) { const im = document.createElement('img'); im.src = it.img; im.alt = ''; e.appendChild(im); }
      else if (it.table) e.innerHTML = `<table>${it.table.map(r => `<tr>${r.map(c => `<td>${esc(c).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('')}</table>`;
      if (it.paras) e.insertAdjacentHTML('beforeend', it.paras.map(p2 => `<p style="text-align:${p2.align};margin-left:${p2.lvl * 24}px">${p2.bullet && p2.runs.some(r => r.text) ? `<span style="font-size:${(p2.runs.find(r => r.sz)?.sz || p2.lvlSize || it.defSize) * 4 / 3}px;color:${it.defColor}">• </span>` : ''}${p2.runs.map(r => r.br ? '<br>' :
        `<span style="font-size:${(r.sz || p2.lvlSize || it.defSize) * 4 / 3}px;color:${r.color || it.defColor};${r.b ? 'font-weight:bold;' : ''}${r.i ? 'font-style:italic;' : ''}${r.u ? 'text-decoration:underline;' : ''}">${esc(r.text || '')}</span>`).join('') || '&nbsp;'}</p>`).join(''));
      d.appendChild(e);
    }
    return d;
  }
  OPEN.slides = async () => {
    const Z = await Zip(), zip = await Z.loadAsync(await fetchBuf());
    const slides = extOf(O.name) === '.odp' ? await odpSlides(zip) : await pptxSlides(zip);
    O.viewOnly = true;
    tools([`<span class="tb-txt hint">${esc(slides.length === 1 ? t('1 diapositiva') : t('{n} diapositivas', {n: slides.length}))} · ${esc(t('Las presentaciones se pueden ver e imprimir; para cambiarlas, descárgalas.'))}</span>`]);
    el('ofBody').innerHTML = '<div class="of-scroll of-slides" id="ofSlides"></div>';
    const box = el('ofSlides');
    slides.forEach((s2, i) => { const w = document.createElement('div'); w.className = 'of-slide-wrap'; w.dataset.n = i + 1; w.appendChild(slideEl(s2)); box.appendChild(w); });
    const fit = () => box.querySelectorAll('.of-slide-wrap').forEach((w, i) => { const s2 = slides[i], sc = Math.min(1.2, (box.clientWidth - 32) / s2.w, Math.max(200, box.clientHeight - 40) / s2.h); w.style.width = s2.w * sc + 'px'; w.style.height = s2.h * sc + 'px'; w.firstChild.style.transform = `scale(${sc})`; });
    fit(); const ro = new ResizeObserver(fit); ro.observe(box); O.cleanup.push(() => ro.disconnect());
    O.export = async () => new Blob([await fetchBuf()]);
    O.pages = box2 => slides.map(s2 => { const sc = Math.min(box2.w / s2.w, box2.h / s2.h), w = document.createElement('div'); w.style.cssText = `width:${s2.w * sc}px;height:${s2.h * sc}px;overflow:hidden`; const e = slideEl(s2); e.style.transform = `scale(${sc})`; e.style.transformOrigin = '0 0'; w.appendChild(e); return w; });
    O.pagesMargin = 'estrecho'; O.pagesOrient = 'landscape'; O.print = printPreview;
  };

  /* ================= Bases de datos de Access (.mdb, .accdb): ver y pasar a Excel ================= */
  OPEN.access = async () => {
    await lib('mdb-reader.min.js', 'MDBReader');
    const buf = await fetchBuf();
    let db;
    try { db = new window.MDBReader(window.MDBBuffer.from(buf)); } catch (e) { throw new Error(/password/i.test(e.message) ? t('Esta base de datos tiene contraseña') : e.message); }
    const names = db.getTableNames();
    O.viewOnly = true;
    let cur = names[0], limit = 500;
    const fmtV = v => v == null ? '' : v instanceof Date ? v.toLocaleString(LOCALE) : typeof v === 'boolean' ? (v ? '✓' : '') : typeof v === 'number' && !Number.isInteger(v) ? String(Math.abs(+v.toPrecision(7) - v) <= Math.abs(v) * 1e-7 ? +v.toPrecision(7) : v) : typeof v === 'object' ? (v.length != null ? `[${fmtSize(v.length)}]` : JSON.stringify(v)) : String(v);
    tools([`<select id="acT" class="tb-sel" title="${esc(t('Tabla'))}">${names.map(n => `<option>${esc(n)}</option>`).join('')}</select>`, '<span id="acInfo" class="tb-txt"></span>', '|',
      ['ac-xlsx', 'Guardar todas las tablas como hoja de cálculo (.xlsx)', 'sheet', 'Pasar a Excel']]);
    el('ofBody').innerHTML = '<div class="of-scroll of-access"><div id="acGrid"></div></div>';
    const show = () => {
      const tb = db.getTable(cur), cols = tb.getColumnNames(), rows = tb.getData({rowLimit: limit});
      el('acInfo').textContent = t('{n} filas', {n: tb.rowCount.toLocaleString(LOCALE)}) + (tb.rowCount > rows.length ? ' · ' + t('se ven {n}', {n: rows.length}) : '');
      el('acGrid').innerHTML = `<table class="of-dbt"><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${esc(fmtV(r[c]))}</td>`).join('')}</tr>`).join('')}</tbody></table>
        ${tb.rowCount > rows.length ? `<button class="btn small" id="acMore" style="margin:12px">${t('Ver más filas')}</button>` : ''}`;
      el('acMore')?.addEventListener('click', () => { limit += 2000; show(); });
    };
    el('acT').onchange = e => { cur = e.target.value; limit = 500; show(); };
    el('ofTools').addEventListener('click', e => { if (e.target.closest('[data-tb="ac-xlsx"]')) save(true); });
    if (names.length) show(); else el('acGrid').innerHTML = `<p class="pv-wait">${t('No hay tablas')}</p>`;
    O.export = async () => {
      const EJ = await ExcelJS(), wb = new EJ.Workbook(), used = new Set();
      for (const n of names) {
        const tb = db.getTable(n), cols = tb.getColumnNames();
        let nm = n.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Tabla'; while (used.has(nm.toLowerCase())) nm = nm.slice(0, 28) + '_' + used.size; used.add(nm.toLowerCase());
        const ws = wb.addWorksheet(nm); ws.addRow(cols).font = {bold: true};
        for (const r of tb.getData({rowLimit: 1048000})) ws.addRow(cols.map(c => { const v = r[c]; return v == null ? null : (typeof v === 'object' && !(v instanceof Date)) ? fmtV(v) : typeof v === 'bigint' ? Number(v) : v; }));
        ws.columns.forEach(c => { c.width = 16; });
      }
      return new Blob([await wb.xlsx.writeBuffer()], {type: MIME['.xlsx']});
    };
    O.pages = (box, host) => { const tbl = el('acGrid').querySelector('table'); return tbl ? flowPages([tbl.cloneNode(true)], box, 'pv-dbpage', host) : []; };
    O.pagesOrient = 'landscape'; O.print = printPreview;
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
