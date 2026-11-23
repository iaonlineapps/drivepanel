package io.github.pctecnikk.drivepanel;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceResponse;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * "Compartir" de Android -> DrivePanel. Cuando alguien comparte fotos o archivos con la app
 * (desde la galeria, WhatsApp, etc.), la web los recibe y los sube con su panel de subidas
 * normal. Para no pasar los archivos por memoria, la web los pide a una direccion especial
 * de su propio servidor (/__dpandroid_compartido__/TOKEN/N) y la app la contesta leyendo
 * el archivo del movil directamente.
 */
final class Compartir {

    static final String PATH = "/__dpandroid_compartido__/";

    static final class Archivo {
        Uri uri;
        String name, mime;
        long size = -1;
    }

    final List<Archivo> files = new ArrayList<>();
    final String token;

    private Compartir() {
        byte[] b = new byte[16];
        new SecureRandom().nextBytes(b);
        StringBuilder s = new StringBuilder();
        for (byte x : b) s.append(String.format("%02x", x));
        token = s.toString();
    }

    static boolean isShare(Intent i) {
        if (i == null) return false;
        String a = i.getAction();
        return Intent.ACTION_SEND.equals(a) || Intent.ACTION_SEND_MULTIPLE.equals(a);
    }

    /** Lee los archivos que vienen en el Intent. Devuelve null si no trae ninguno. */
    static Compartir from(Intent i, ContentResolver cr) {
        List<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND_MULTIPLE.equals(i.getAction())) {
            ArrayList<Uri> l = i.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (l != null) uris.addAll(l);
        } else {
            Uri u = i.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) uris.add(u);
        }
        if (uris.isEmpty() && i.getClipData() != null) {
            for (int k = 0; k < i.getClipData().getItemCount(); k++) {
                Uri u = i.getClipData().getItemAt(k).getUri();
                if (u != null) uris.add(u);
            }
        }
        if (uris.isEmpty()) return null;
        Compartir c = new Compartir();
        Map<String, Integer> seen = new HashMap<>();
        int n = 0;
        for (Uri u : uris) {
            Archivo f = new Archivo();
            f.uri = u;
            f.mime = cr.getType(u);
            Cursor q = null;
            try {
                q = cr.query(u, new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null);
                if (q != null && q.moveToFirst()) {
                    f.name = q.getString(0);
                    if (!q.isNull(1)) f.size = q.getLong(1);
                }
            } catch (Exception ignored) {
            } finally {
                if (q != null) q.close();
            }
            if (f.name == null || f.name.trim().isEmpty()) {
                String ext = f.mime == null ? null : MimeTypeMap.getSingleton().getExtensionFromMimeType(f.mime);
                f.name = "compartido-" + System.currentTimeMillis() + "-" + (++n) + (ext != null ? "." + ext : "");
            }
            f.name = f.name.replaceAll("[\\\\/:*?\"<>|\\u0000-\\u001f]", "_").trim();
            // Dos archivos con el mismo nombre: al segundo se le pone (2)
            Integer k = seen.get(f.name);
            if (k != null) {
                seen.put(f.name, k + 1);
                int dot = f.name.lastIndexOf('.');
                f.name = dot > 0 ? f.name.substring(0, dot) + " (" + (k + 1) + ")" + f.name.substring(dot) : f.name + " (" + (k + 1) + ")";
            } else {
                seen.put(f.name, 1);
            }
            c.files.add(f);
        }
        return c;
    }

    long totalSize() {
        long t = 0;
        for (Archivo f : files) if (f.size > 0) t += f.size;
        return t;
    }

    /** Contesta a la web cuando pide uno de los archivos compartidos. */
    WebResourceResponse serve(ContentResolver cr, Uri req) {
        String p = req.getPath();
        if (p == null || !p.startsWith(PATH + token + "/")) return null;
        try {
            int idx = Integer.parseInt(p.substring((PATH + token + "/").length()));
            Archivo f = files.get(idx);
            InputStream in = cr.openInputStream(f.uri);
            Map<String, String> h = new HashMap<>();
            h.put("Cache-Control", "no-store");
            if (f.size > 0) h.put("Content-Length", String.valueOf(f.size));
            return new WebResourceResponse(f.mime != null ? f.mime : "application/octet-stream", null, 200, "OK", h, in);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), null);
        }
    }

    /**
     * JavaScript que espera a que la web este lista (y la persona haya entrado), pide los
     * archivos y los mete en la cola de subidas, dentro de la carpeta elegida.
     */
    String js(String folder) {
        JSONArray arr = new JSONArray();
        try {
            for (int i = 0; i < files.size(); i++) {
                JSONObject o = new JSONObject();
                Archivo f = files.get(i);
                o.put("u", PATH + token + "/" + i);
                o.put("n", f.name);
                o.put("t", f.mime == null ? "" : f.mime);
                arr.put(o);
            }
        } catch (Exception ignored) { }
        return "(function(){var L=" + arr + ",F=" + JSONObject.quote(folder == null ? "" : folder) + ",tries=0;"
                + "function ready(){try{return typeof S!=='undefined'&&S.me&&typeof enqueue==='function';}catch(e){return false;}}"
                + "function toastMsg(m){try{toast(m);}catch(e){}}"
                + "function go2(){"
                + " if(!ready()){if(++tries<600)setTimeout(go2,500);return;}"
                + " toastMsg('Preparando '+L.length+(L.length==1?' archivo':' archivos')+' para subir…');"
                + " Promise.all(L.map(function(x){return fetch(x.u).then(function(r){if(!r.ok)throw new Error(r.status);return r.blob();})"
                + "  .then(function(b){return {file:new File([b],x.n,{type:x.t||b.type}),rel:(F?F+'/':'')+x.n};});}))"
                + " .then(function(fs){try{if(S.view!=='drive'||S.path)go('drive');}catch(e){}enqueue(fs,'');})"
                + " .catch(function(e){toastMsg('No se han podido leer los archivos compartidos');});"
                + "}"
                + "go2();})();";
    }
}
