package io.github.pctecnikk.drivepanel;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.List;

/**
 * Subir carpetas enteras. El selector de archivos de Android no deja elegir una carpeta,
 * asi que cuando la web pulsa su boton "Subir carpeta" (el input #dirInput) la app abre el
 * selector de carpetas de Android, recorre la carpeta con sus subcarpetas y le pasa a la web
 * los archivos con su ruta (carpeta/subcarpeta/foto.jpg). La web los sube igual que desde el
 * ordenador, con la misma estructura.
 */
final class Carpeta {

    private Carpeta() { }

    /** Se inyecta en cada pagina. Marca cuando se abre #dirInput y pone las rutas a los archivos. */
    static final String JS =
            "(function(){" +
            " if (window.__dpAndroid || !window.DPAndroid) return; window.__dpAndroid = true;" +
            " var orig = HTMLInputElement.prototype.click;" +
            " HTMLInputElement.prototype.click = function(){" +
            "   try { DPAndroid.nextIsFolder(this.id === 'dirInput' || this.hasAttribute('webkitdirectory')); } catch (e) {}" +
            "   return orig.apply(this, arguments);" +
            " };" +
            " document.addEventListener('change', function(e){" +
            "   var t = e.target, rel = window.__dpRel;" +
            "   if (!t || !t.files || !rel || !(t.id === 'dirInput' || t.hasAttribute('webkitdirectory'))) return;" +
            "   window.__dpRel = null;" +
            "   for (var i = 0; i < t.files.length && i < rel.length; i++) {" +
            "     try { Object.defineProperty(t.files[i], 'webkitRelativePath', {value: rel[i], configurable: true}); } catch (x) {}" +
            "   }" +
            " }, true);" +
            "})();";

    static final class Result {
        final List<Uri> uris = new ArrayList<>();
        final List<String> rels = new ArrayList<>();
        String name;

        Uri[] uriArray() { return uris.toArray(new Uri[0]); }

        String relsJson() {
            JSONArray a = new JSONArray();
            for (String r : rels) a.put(r);
            return a.toString();
        }
    }

    /** Recorre la carpeta elegida (y sus subcarpetas). Se llama fuera del hilo principal. */
    static Result list(ContentResolver cr, Uri tree) {
        Result r = new Result();
        String rootId = DocumentsContract.getTreeDocumentId(tree);
        r.name = displayName(cr, DocumentsContract.buildDocumentUriUsingTree(tree, rootId));
        if (r.name == null || r.name.isEmpty()) r.name = "Carpeta";
        walk(cr, tree, rootId, r.name, r, 0);
        return r;
    }

    private static void walk(ContentResolver cr, Uri tree, String docId, String path, Result r, int depth) {
        if (depth > 40) return;
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, docId);
        Cursor c = null;
        try {
            c = cr.query(children, new String[]{
                    DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    DocumentsContract.Document.COLUMN_MIME_TYPE}, null, null, null);
            if (c == null) return;
            List<String[]> dirs = new ArrayList<>();
            while (c.moveToNext()) {
                String id = c.getString(0), name = c.getString(1), mime = c.getString(2);
                if (name == null || name.isEmpty()) continue;
                name = name.replace("/", "_");
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                    dirs.add(new String[]{id, name});
                } else {
                    r.uris.add(DocumentsContract.buildDocumentUriUsingTree(tree, id));
                    r.rels.add(path + "/" + name);
                }
            }
            c.close();
            c = null;
            for (String[] d : dirs) walk(cr, tree, d[0], path + "/" + d[1], r, depth + 1);
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
    }

    private static String displayName(ContentResolver cr, Uri doc) {
        Cursor c = null;
        try {
            c = cr.query(doc, new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null);
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        return null;
    }
}
