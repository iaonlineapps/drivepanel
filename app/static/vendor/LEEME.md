# Librerías para abrir y editar documentos

Se cargan solo al abrir un documento (ver `../office.js`). Todo funciona en el navegador:
la Raspberry Pi no tiene que convertir nada. Copiadas tal cual de npm (sin cambios), con su licencia en `licenses/`.

| Archivo | Librería | Versión | Licencia | Para qué |
|---|---|---|---|---|
| `pdfjs/` | pdf.js (pdfjs-dist, versión «legacy») | 6.5.438 | Apache-2.0 | Ver PDF, escribir, dibujar, resaltar, rellenar formularios y guardar |
| `docx-preview.min.js` | docx-preview | 0.4.1 | Apache-2.0 | Ver los .docx como en Word |
| `jszip.min.js` | JSZip | 3.10.1 | MIT (o GPLv3) | La necesita docx-preview |
| `mammoth.browser.min.js` | mammoth | 1.13.0 | BSD-2-Clause | Pasar un .docx a una página editable |
| `docx.min.js` | docx | 9.6.1 | MIT | Guardar la página editada como .docx (minificado con terser) |
| `exceljs.min.js` | ExcelJS | 4.4.0 | MIT | Leer y guardar .xlsx conservando el formato |
| `xspreadsheet/` | x-data-spreadsheet | 1.1.9 | MIT | La hoja de cálculo editable |

`pdfjs/pdf_viewer.min.mjs` es `legacy/web/pdf_viewer.mjs` minificado con terser.
