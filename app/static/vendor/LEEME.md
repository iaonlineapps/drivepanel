# Librerías para abrir y editar documentos

Se cargan solo al abrir un documento (ver `../office.js`). Todo funciona en el navegador:
la Raspberry Pi no tiene que convertir nada. Copiadas tal cual de npm (sin cambios), con su licencia en `licenses/`.
Todas son de código abierto con licencias que permiten usarlas y repartirlas libremente; no hay código de Microsoft.

| Archivo | Librería | Versión | Licencia | Para qué |
|---|---|---|---|---|
| `pdfjs/` | pdf.js (pdfjs-dist, versión «legacy») | 6.5.438 | Apache-2.0 | Ver PDF, escribir, dibujar, resaltar, rellenar formularios y guardar |
| `docx-preview.min.js` | docx-preview | 0.4.1 | Apache-2.0 | Ver los .docx como en Word |
| `jszip.min.js` | JSZip | 3.10.1 | MIT (o GPLv3) | La necesita docx-preview |
| `mammoth.browser.min.js` | mammoth | 1.13.0 | BSD-2-Clause | Pasar un .docx a una página editable |
| `docx.min.js` | docx | 9.6.1 | MIT | Guardar la página editada como .docx (minificado con terser) |
| `exceljs.min.js` | ExcelJS | 4.4.0 | MIT | Leer y guardar .xlsx conservando el formato |
| `xspreadsheet/` | x-data-spreadsheet | 1.1.9 | MIT | La hoja de cálculo editable |
| `xlsx.full.min.js` | SheetJS Community Edition (xlsx) | 0.18.5 | Apache-2.0 | Leer y guardar Excel antiguo (.xls) y LibreOffice Calc (.ods); leer el texto de los Word antiguos (.doc) |
| `mdb-reader.min.js` | mdb-reader (+ buffer, events, stream-browserify, process, util, string_decoder: MIT; ieee754: BSD-3-Clause; pako: MIT y Zlib) | 3.2.2 | MIT | Ver las tablas de las bases de datos de Access (.mdb, .accdb) |

`pdfjs/pdf_viewer.min.mjs` es `legacy/web/pdf_viewer.mjs` minificado con terser.

`mdb-reader.min.js` es un paquete hecho con esbuild a partir de mdb-reader y las piezas que necesita para funcionar en el navegador; sus avisos de licencia van al final del archivo.

Los formatos .odt, .odp, .pptx y .rtf se leen con código propio de `../office.js` (siguiendo las especificaciones públicas OpenDocument y Office Open XML).
