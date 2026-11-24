'use strict';
/* DrivePanel - idiomas
   Los textos se escriben en español en el código y cada idioma tiene un archivo
   /static/i18n/<idioma>.json con «texto en español» → «traducción». Lo que falte
   en un idioma se queda en español. Para añadir un idioma: crea su .json (copia en.json
   y traduce los valores) y añádelo a LANGS aquí y en app/i18n.py.
   Los huecos {n}, {name}... se rellenan con t('texto {n}', {n: 3}). */
const LANGS = {es: 'Español', en: 'English'};
const LOCALES = {es: 'es-ES', en: 'en-GB'};
function pickLang() {
  try { const l = localStorage.getItem('dp-lang'); if (LANGS[l]) return l; } catch (e) {}
  for (const l of navigator.languages || [navigator.language || '']) { const b = String(l).slice(0, 2).toLowerCase(); if (LANGS[b]) return b; }
  return 'es';
}
let LANG = pickLang(), DICT = {};
// fechas y números con el formato del idioma (en inglés, el del navegador si es inglés: en-US, en-GB...)
const LOCALE = (() => { const n = navigator.language || ''; return n.slice(0, 2).toLowerCase() === LANG && n.length > 2 ? n : LOCALES[LANG]; })();
const DEC = LANG === 'es' ? ',' : '.';
const dec = s => String(s).replace('.', DEC);
function t(s, v) {
  let r = (LANG !== 'es' && DICT[s]) || s;
  if (v) r = r.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m);
  return r;
}
// el servidor también contesta en este idioma (mensajes de error, páginas de enlaces)
function setLangCookie(l) { document.cookie = 'dp_lang=' + l + '; path=/; max-age=31536000; SameSite=Lax'; }
/* traduce el HTML fijo de index.html: textos y los atributos title / placeholder.
   Solo se usa con el HTML de la propia página, nunca con nombres de archivos. */
function translateDom(root) {
  if (LANG === 'es') return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const k = n.data.trim(); if (!k || !DICT[k]) continue;
    n.data = n.data.replace(k, DICT[k]);
  }
  root.querySelectorAll('[title],[placeholder]').forEach(e => {
    for (const a of ['title', 'placeholder']) { const v = e.getAttribute(a); if (v && DICT[v]) e.setAttribute(a, DICT[v]); }
  });
}
function setLang(l) { try { localStorage.setItem('dp-lang', l); } catch (e) {} setLangCookie(l); }
const I18N_READY = (async () => {
  document.documentElement.lang = LANG; setLangCookie(LANG);
  if (LANG === 'es') return;
  try { DICT = await (await fetch('/static/i18n/' + LANG + '.json', {cache: 'no-cache'})).json(); } catch (e) { DICT = {}; }
  if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r));
  translateDom(document.body);
  document.title = t(document.title);
})();
