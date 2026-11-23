package io.github.pctecnikk.drivepanel;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Panel de descargas dentro de la app, como el de subidas de la web: aparece en cuanto se
 * pulsa Descargar y muestra cada archivo con su barra, lo que lleva, la velocidad y el tiempo
 * que queda. Permite cancelar, reintentar y abrir. La descarga la hace el administrador de
 * descargas de Android, asi que sigue aunque se cierre la app.
 */
final class Descargas {

    /** Vuelve a pedir una descarga (para Reintentar). Devuelve el id nuevo o -1. */
    interface Enqueuer { long enqueue(Item it); }

    static final class Item {
        long id;
        String name, url, userAgent, mime;
        // Solo en memoria
        long lastBytes = -1, lastTime;
        double speed; // bytes/s, suavizada
        int status;
        boolean notified;
        View row;
        TextView title, info;
        ProgressBar bar;
        TextView btnA, btnB;

        JSONObject toJson() throws Exception {
            JSONObject o = new JSONObject();
            o.put("id", id); o.put("name", name); o.put("url", url);
            o.put("ua", userAgent == null ? "" : userAgent); o.put("mime", mime == null ? "" : mime);
            o.put("st", status);
            return o;
        }

        static Item fromJson(JSONObject o) {
            Item it = new Item();
            it.id = o.optLong("id", -1); it.name = o.optString("name"); it.url = o.optString("url");
            it.userAgent = o.optString("ua"); it.mime = o.optString("mime");
            it.status = o.optInt("st", 0);
            it.notified = it.status == DownloadManager.STATUS_SUCCESSFUL || it.status == DownloadManager.STATUS_FAILED;
            return it;
        }
    }

    private static final String KEY = "descargas";
    private static final int BLUE = 0xFF1A73E8;

    private final Activity a;
    private final SharedPreferences prefs;
    private final DownloadManager dm;
    private final Enqueuer enqueuer;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Item> items = new ArrayList<>();

    private LinearLayout panel, list;
    private ScrollView scroll;
    private TextView header, minBtn, closeBtn;
    private boolean minimized, running;
    private final boolean dark;
    private final int cBg, cText, cMuted, cLine;

    Descargas(Activity a, SharedPreferences prefs, Enqueuer enqueuer) {
        this.a = a;
        this.prefs = prefs;
        this.enqueuer = enqueuer;
        this.dm = (DownloadManager) a.getSystemService(Context.DOWNLOAD_SERVICE);
        dark = (a.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        cBg = dark ? 0xFF2D2F31 : 0xFFFFFFFF;
        cText = dark ? 0xFFE3E3E3 : 0xFF1F1F1F;
        cMuted = dark ? 0xFFA8ABAF : 0xFF5F6368;
        cLine = dark ? 0xFF44474A : 0xFFE3E3E3;
        load();
        build();
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, a.getResources().getDisplayMetrics());
    }

    // ------------------------------------------------------------------ Vista

    private void build() {
        panel = new LinearLayout(a);
        panel.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(cBg);
        bg.setCornerRadius(dp(14));
        bg.setStroke(dp(1), cLine);
        panel.setBackground(bg);
        panel.setElevation(dp(8));
        panel.setClickable(true); // que los toques no pasen a la web

        LinearLayout head = new LinearLayout(a);
        head.setOrientation(LinearLayout.HORIZONTAL);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.setPadding(dp(16), dp(10), dp(8), dp(10));
        header = new TextView(a);
        header.setTextColor(cText);
        header.setTextSize(15);
        header.setTypeface(Typeface.DEFAULT_BOLD);
        head.addView(header, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        minBtn = iconButton("▾");
        minBtn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { setMinimized(!minimized); } });
        head.addView(minBtn);
        closeBtn = iconButton("✕");
        closeBtn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { clearFinished(); } });
        head.addView(closeBtn);
        head.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { setMinimized(!minimized); } });
        panel.addView(head);

        scroll = new ScrollView(a);
        list = new LinearLayout(a);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setPadding(0, 0, 0, dp(6));
        scroll.addView(list);
        panel.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        for (Item it : items) addRow(it);
        refresh();
    }

    private TextView iconButton(String s) {
        TextView t = new TextView(a);
        t.setText(s);
        t.setTextSize(18);
        t.setTextColor(cMuted);
        t.setGravity(Gravity.CENTER);
        t.setMinWidth(dp(40));
        t.setMinHeight(dp(36));
        return t;
    }

    private TextView textButton(String s) {
        TextView t = new TextView(a);
        t.setText(s);
        t.setTextSize(13);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setTextColor(BLUE);
        t.setPadding(dp(10), dp(6), dp(10), dp(6));
        return t;
    }

    /** Pone el panel encima de la web (se llama cada vez que se crea la web). */
    void attach(FrameLayout root) {
        if (panel.getParent() != null) ((ViewGroup) panel.getParent()).removeView(panel);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.BOTTOM;
        lp.setMargins(dp(10), 0, dp(10), dp(10));
        root.addView(panel, lp);
        refresh();
    }

    private void setMinimized(boolean m) {
        minimized = m;
        scroll.setVisibility(m ? View.GONE : View.VISIBLE);
        minBtn.setRotation(m ? 180 : 0);
    }

    private void addRow(final Item it) {
        LinearLayout row = new LinearLayout(a);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(dp(16), dp(8), dp(8), dp(6));

        LinearLayout top = new LinearLayout(a);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        it.title = new TextView(a);
        it.title.setText(it.name);
        it.title.setTextColor(cText);
        it.title.setTextSize(14);
        it.title.setSingleLine(true);
        it.title.setEllipsize(TextUtils.TruncateAt.MIDDLE);
        top.addView(it.title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        it.btnA = textButton("");
        it.btnB = textButton("");
        top.addView(it.btnA);
        top.addView(it.btnB);
        row.addView(top);

        it.bar = new ProgressBar(a, null, android.R.attr.progressBarStyleHorizontal);
        it.bar.setMax(1000);
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(6));
        blp.setMargins(0, dp(4), dp(8), dp(2));
        row.addView(it.bar, blp);

        it.info = new TextView(a);
        it.info.setTextColor(cMuted);
        it.info.setTextSize(12);
        row.addView(it.info);

        it.row = row;
        list.addView(row, 0); // la mas nueva arriba
    }

    // ------------------------------------------------------------------ Datos

    private void load() {
        try {
            JSONArray arr = new JSONArray(prefs.getString(KEY, "[]"));
            for (int i = 0; i < arr.length(); i++) {
                Item it = Item.fromJson(arr.getJSONObject(i));
                if (it.id >= 0) items.add(it);
            }
        } catch (Exception ignored) { }
    }

    private void save() {
        try {
            JSONArray arr = new JSONArray();
            for (Item it : items) arr.put(it.toJson());
            prefs.edit().putString(KEY, arr.toString()).apply();
        } catch (Exception ignored) { }
    }

    /** Una descarga nueva: sale en el panel al momento. */
    void add(Item it) {
        it.status = DownloadManager.STATUS_PENDING;
        items.add(it);
        addRow(it);
        save();
        setMinimized(false);
        refresh();
        start();
    }

    private void clearFinished() {
        boolean active = false;
        for (int i = items.size() - 1; i >= 0; i--) {
            Item it = items.get(i);
            if (isActive(it.status)) { active = true; continue; }
            list.removeView(it.row);
            items.remove(i);
        }
        save();
        if (active) {
            setMinimized(true);
            Toast.makeText(a, "Las descargas en curso siguen; el panel se queda minimizado", Toast.LENGTH_SHORT).show();
        }
        refresh();
    }

    private static boolean isActive(int st) {
        return st == DownloadManager.STATUS_PENDING || st == DownloadManager.STATUS_RUNNING || st == DownloadManager.STATUS_PAUSED;
    }

    // ------------------------------------------------------------------ Seguimiento

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (!running) return;
            boolean active = poll();
            refresh();
            if (active) handler.postDelayed(this, 1000);
            else running = false;
        }
    };

    void start() {
        if (running) return;
        running = true;
        handler.post(tick);
    }

    void stop() {
        running = false;
        handler.removeCallbacks(tick);
    }

    /** Lee el estado de cada descarga. Devuelve true si queda alguna en marcha. */
    private boolean poll() {
        boolean active = false;
        boolean changed = false;
        long now = SystemClock.elapsedRealtime();
        for (Item it : items) {
            if (!isActive(it.status) && it.lastBytes >= 0) continue;
            Cursor c = null;
            try {
                c = dm.query(new DownloadManager.Query().setFilterById(it.id));
                if (c == null || !c.moveToFirst()) {
                    // La han quitado desde fuera (por ejemplo desde la barra de notificaciones)
                    if (isActive(it.status)) { it.status = -1; changed = true; }
                    paint(it, 0, -1, 0);
                    continue;
                }
                int st = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                long done = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                long total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                int reason = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                if (st == DownloadManager.STATUS_RUNNING && it.lastBytes >= 0 && now > it.lastTime) {
                    double inst = (done - it.lastBytes) * 1000.0 / (now - it.lastTime);
                    it.speed = it.speed <= 0 ? inst : it.speed * 0.7 + inst * 0.3;
                } else if (st != DownloadManager.STATUS_RUNNING) {
                    it.speed = 0;
                }
                it.lastBytes = done;
                it.lastTime = now;
                if (st != it.status) changed = true;
                it.status = st;
                if (isActive(st)) active = true;
                if (!it.notified && st == DownloadManager.STATUS_SUCCESSFUL) {
                    it.notified = true;
                    Toast.makeText(a, "Descargado: " + it.name, Toast.LENGTH_SHORT).show();
                } else if (!it.notified && st == DownloadManager.STATUS_FAILED) {
                    it.notified = true;
                }
                paint(it, done, total, reason);
            } catch (Exception ignored) {
            } finally {
                if (c != null) c.close();
            }
        }
        if (changed) save();
        return active;
    }

    private void paint(final Item it, long done, long total, int reason) {
        int st = it.status;
        boolean known = total > 0;
        it.bar.setIndeterminate(isActive(st) && !known);
        if (known) it.bar.setProgress((int) (done * 1000 / total));
        else if (st == DownloadManager.STATUS_SUCCESSFUL) it.bar.setProgress(1000);

        String text;
        if (st == DownloadManager.STATUS_PENDING) {
            text = "Empezando…";
        } else if (st == DownloadManager.STATUS_RUNNING) {
            StringBuilder b = new StringBuilder();
            b.append(size(done));
            if (known) b.append(" de ").append(size(total)).append(" (").append(done * 100 / total).append("%)");
            if (it.speed > 0) {
                b.append(" · ").append(size((long) it.speed)).append("/s");
                if (known) b.append(" · quedan ").append(time((long) ((total - done) / it.speed)));
            }
            text = b.toString();
        } else if (st == DownloadManager.STATUS_PAUSED) {
            text = "En pausa: " + pauseReason(reason) + (known ? " · " + size(done) + " de " + size(total) : "");
        } else if (st == DownloadManager.STATUS_SUCCESSFUL) {
            text = "Descargado · " + size(known ? total : done) + " · en la carpeta Descargas";
        } else if (st == DownloadManager.STATUS_FAILED) {
            text = "Ha fallado: " + failReason(reason);
        } else {
            text = "Cancelada";
        }
        it.info.setText(text);
        it.info.setTextColor(st == DownloadManager.STATUS_FAILED ? 0xFFD93025 : cMuted);

        if (isActive(st)) {
            setBtn(it.btnA, "Cancelar", new View.OnClickListener() { @Override public void onClick(View v) {
                dm.remove(it.id);
                it.status = -1;
                save();
                paint(it, 0, -1, 0);
                refresh();
            } });
            setBtn(it.btnB, null, null);
        } else if (st == DownloadManager.STATUS_SUCCESSFUL) {
            setBtn(it.btnA, "Abrir", new View.OnClickListener() { @Override public void onClick(View v) { open(it); } });
            setBtn(it.btnB, null, null);
        } else {
            setBtn(it.btnA, "Reintentar", new View.OnClickListener() { @Override public void onClick(View v) { retry(it); } });
            setBtn(it.btnB, "Quitar", new View.OnClickListener() { @Override public void onClick(View v) {
                dm.remove(it.id);
                list.removeView(it.row);
                items.remove(it);
                save();
                refresh();
            } });
        }
    }

    private static void setBtn(TextView b, String text, View.OnClickListener l) {
        b.setVisibility(text == null ? View.GONE : View.VISIBLE);
        if (text != null) b.setText(text);
        b.setOnClickListener(l);
    }

    private void retry(Item it) {
        dm.remove(it.id);
        long id = enqueuer.enqueue(it);
        if (id < 0) return;
        it.id = id;
        it.status = DownloadManager.STATUS_PENDING;
        it.notified = false;
        it.lastBytes = -1;
        it.speed = 0;
        save();
        paint(it, 0, -1, 0);
        refresh();
        start();
    }

    private void open(Item it) {
        try {
            Uri u = dm.getUriForDownloadedFile(it.id);
            if (u == null) throw new Exception();
            String mime = dm.getMimeTypeForDownloadedFile(it.id);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(u, mime != null ? mime : "*/*");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            a.startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(a, "No hay ninguna app para abrir este archivo. Está en la carpeta Descargas.", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(a, "No se encuentra el archivo. Mira en la carpeta Descargas.", Toast.LENGTH_LONG).show();
        }
    }

    /** Cabecera y visibilidad del panel. */
    private void refresh() {
        int act = 0;
        for (Item it : items) if (isActive(it.status)) act++;
        panel.setVisibility(items.isEmpty() ? View.GONE : View.VISIBLE);
        if (act > 0) header.setText(act == 1 ? "Descargando 1 archivo" : "Descargando " + act + " archivos");
        else header.setText(items.size() == 1 ? "Descargas · 1 terminada" : "Descargas · " + items.size() + " terminadas");
        // Que la lista no tape mas de media pantalla
        int max = a.getResources().getDisplayMetrics().heightPixels * 45 / 100;
        ViewGroup.LayoutParams lp = scroll.getLayoutParams();
        int want = Math.min(max, items.size() * dp(66));
        if (lp.height != want) { lp.height = want; scroll.setLayoutParams(lp); }
    }

    // ------------------------------------------------------------------ Textos

    static String size(long b) {
        if (b < 1024) return b + " B";
        String[] u = {"KB", "MB", "GB", "TB"};
        double v = b / 1024.0;
        int i = 0;
        while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
        return String.format(new Locale("es", "ES"), v < 10 ? "%.1f %s" : "%.0f %s", v, u[i]);
    }

    static String time(long s) {
        if (s < 60) return s + " s";
        if (s < 3600) return (s / 60) + " min " + (s % 60 < 10 ? "0" : "") + (s % 60) + " s";
        return (s / 3600) + " h " + ((s % 3600) / 60) + " min";
    }

    private static String pauseReason(int r) {
        switch (r) {
            case DownloadManager.PAUSED_WAITING_FOR_NETWORK: return "esperando conexión";
            case DownloadManager.PAUSED_QUEUED_FOR_WIFI: return "esperando wifi";
            case DownloadManager.PAUSED_WAITING_TO_RETRY: return "reintentando";
            default: return "esperando";
        }
    }

    private static String failReason(int r) {
        switch (r) {
            case DownloadManager.ERROR_INSUFFICIENT_SPACE: return "no queda espacio en el móvil";
            case DownloadManager.ERROR_CANNOT_RESUME: return "se cortó y no se puede seguir; toca Reintentar";
            case DownloadManager.ERROR_HTTP_DATA_ERROR: return "se cortó la conexión; toca Reintentar";
            case DownloadManager.ERROR_FILE_ALREADY_EXISTS: return "ya existe un archivo con ese nombre";
            case DownloadManager.ERROR_DEVICE_NOT_FOUND: return "no se encuentra la memoria";
            case 401: case 403: return "sin permiso (vuelve a entrar en DrivePanel)";
            case 404: return "el archivo ya no está en el servidor";
            default: return r >= 400 && r < 600 ? "el servidor respondió con error " + r : "error " + r;
        }
    }
}
