package io.github.pctecnikk.drivepanel;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Copia automatica de fotos y videos, como Google Fotos: cada poco (y cuando aparece una foto
 * nueva) sube al DrivePanel lo que no se haya subido todavia, a la carpeta elegida y con una
 * subcarpeta por album (Camera, WhatsApp Images...). Si se elige, solo con wifi.
 * Usa la misma subida por trozos que la web, con "si ya existe uno identico, no lo subas".
 */
public class CopiaFotos extends JobService {

    static final String K_ON = "auto_on", K_WIFI = "auto_wifi", K_FOLDER = "auto_folder", K_CAMERA = "auto_camera",
            K_SINCE = "auto_since", K_SINCE_ID = "auto_since_id", K_STATUS = "auto_status", K_LAST = "auto_last",
            K_COOKIE = "auto_cookie", K_TOTAL = "auto_total", K_PAUSED = "auto_paused";
    static final String DEFAULT_FOLDER = "Fotos del móvil";
    private static final int JOB_PERIODIC = 41, JOB_TRIGGER = 42, JOB_NOW = 43;
    private static final String CHANNEL = "copia";
    private static final int NOTIF_PROGRESS = 7001, NOTIF_RESULT = 7002;
    private static final int CHUNK = 8 * 1024 * 1024;

    private volatile boolean stop;

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("drivepanel", MODE_PRIVATE);
    }

    // ------------------------------------------------------------------ Programar

    /** Al abrir la app: si la copia esta activada y el movil se reinicio, vuelve a programarla. */
    static void ensureScheduled(Context c) {
        if (!prefs(c).getBoolean(K_ON, false)) return;
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js.getPendingJob(JOB_PERIODIC) == null || js.getPendingJob(JOB_TRIGGER) == null) schedule(c);
    }

    static void schedule(Context c) {
        SharedPreferences p = prefs(c);
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        js.cancel(JOB_PERIODIC);
        js.cancel(JOB_TRIGGER);
        if (!p.getBoolean(K_ON, false)) return;
        int net = p.getBoolean(K_WIFI, true) ? JobInfo.NETWORK_TYPE_UNMETERED : JobInfo.NETWORK_TYPE_ANY;
        ComponentName cn = new ComponentName(c, CopiaFotos.class);
        js.schedule(new JobInfo.Builder(JOB_PERIODIC, cn)
                .setRequiredNetworkType(net)
                .setPeriodic(30 * 60 * 1000L)
                .build());
        scheduleTrigger(c);
    }

    /** Se despierta en cuanto aparece una foto o un video nuevo (y se vuelve a programar despues). */
    private static void scheduleTrigger(Context c) {
        SharedPreferences p = prefs(c);
        if (!p.getBoolean(K_ON, false)) return;
        int net = p.getBoolean(K_WIFI, true) ? JobInfo.NETWORK_TYPE_UNMETERED : JobInfo.NETWORK_TYPE_ANY;
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        js.schedule(new JobInfo.Builder(JOB_TRIGGER, new ComponentName(c, CopiaFotos.class))
                .setRequiredNetworkType(net)
                .addTriggerContentUri(new JobInfo.TriggerContentUri(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        JobInfo.TriggerContentUri.FLAG_NOTIFY_FOR_DESCENDANTS))
                .addTriggerContentUri(new JobInfo.TriggerContentUri(MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                        JobInfo.TriggerContentUri.FLAG_NOTIFY_FOR_DESCENDANTS))
                .setTriggerContentUpdateDelay(10_000)
                .setTriggerContentMaxDelay(60_000)
                .build());
    }

    /** "Copiar ahora": con cualquier conexion, ya. */
    static void runNow(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        js.schedule(new JobInfo.Builder(JOB_NOW, new ComponentName(c, CopiaFotos.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setOverrideDeadline(1000)
                .build());
    }

    static void cancelAll(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        js.cancel(JOB_PERIODIC);
        js.cancel(JOB_TRIGGER);
        js.cancel(JOB_NOW);
    }

    // ------------------------------------------------------------------ JobService

    @Override
    public boolean onStartJob(final JobParameters params) {
        stop = false;
        new Thread(new Runnable() { @Override public void run() {
            boolean again = false;
            try {
                again = copy(CopiaFotos.this, new Stop() { @Override public boolean stop() { return stop; } });
            } catch (Throwable t) {
                setStatus(CopiaFotos.this, "Error: " + t.getMessage());
            }
            if (params.getJobId() == JOB_TRIGGER) scheduleTrigger(CopiaFotos.this);
            jobFinished(params, again);
        } }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        stop = true;
        if (params.getJobId() == JOB_TRIGGER) scheduleTrigger(this);
        return true; // que lo vuelva a intentar
    }

    interface Stop { boolean stop(); }

    /** Progreso en directo de la copia: lo lee la pantalla "Copia automática de fotos". */
    static final class Live {
        static volatile boolean running, halt;
        static volatile int index, count;
        static volatile String name = "";
        static volatile long totalBytes, doneBytes, fileSent, start, speed;
        static final int MAX = 120;
        static final double[] samples = new double[MAX];
        static volatile int seq;                    // muestras anadidas desde que empezo

        static long sent() { return doneBytes + fileSent; }

        static synchronized void sample(double v) {
            samples[seq % MAX] = v;
            seq++;
        }

        /** Muestras en orden, de la mas antigua a la mas nueva. */
        static synchronized double[] history() {
            int n = Math.min(seq, MAX);
            double[] out = new double[n];
            for (int i = 0; i < n; i++) out[i] = samples[(seq - n + i) % MAX];
            return out;
        }

        static int percent() {
            return totalBytes <= 0 ? 0 : (int) Math.min(100, sent() * 100 / totalBytes);
        }

        /** Segundos que quedan, o -1 si aun no se sabe. */
        static long eta() {
            long left = totalBytes - sent();
            return speed > 0 ? left / speed : -1;
        }
    }

    interface Opener { InputStream open(Media m) throws Exception; }

    // ------------------------------------------------------------------ La copia

    static final class Media {
        long id, added, modified, size;
        String name, album, mime;
        Uri uri;
    }

    /** Lista lo que falta por copiar, de lo mas antiguo a lo mas nuevo. */
    static List<Media> pending(Context c) {
        SharedPreferences p = prefs(c);
        long since = p.getLong(K_SINCE, 0), sinceId = p.getLong(K_SINCE_ID, -1);
        boolean camera = p.getBoolean(K_CAMERA, true);
        List<Media> out = new ArrayList<>();
        query(c.getContentResolver(), MediaStore.Images.Media.EXTERNAL_CONTENT_URI, since, sinceId, camera, out);
        query(c.getContentResolver(), MediaStore.Video.Media.EXTERNAL_CONTENT_URI, since, sinceId, camera, out);
        Collections.sort(out, new Comparator<Media>() {
            @Override public int compare(Media a, Media b) {
                if (a.added != b.added) return a.added < b.added ? -1 : 1;
                return Long.compare(a.id, b.id);
            }
        });
        return out;
    }

    private static void query(ContentResolver cr, Uri base, long since, long sinceId, boolean camera, List<Media> out) {
        boolean q = Build.VERSION.SDK_INT >= 29;
        String[] cols = {
                MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.SIZE,
                MediaStore.MediaColumns.DATE_ADDED, MediaStore.MediaColumns.DATE_MODIFIED, MediaStore.MediaColumns.MIME_TYPE,
                "bucket_display_name", q ? MediaStore.MediaColumns.RELATIVE_PATH : MediaStore.MediaColumns.DATA};
        String sel = MediaStore.MediaColumns.DATE_ADDED + ">=?";
        Cursor cur = null;
        try {
            cur = cr.query(base, cols, sel, new String[]{String.valueOf(since)}, null);
            if (cur == null) return;
            while (cur.moveToNext()) {
                Media m = new Media();
                m.id = cur.getLong(0);
                m.added = cur.getLong(3);
                if (m.added == since && m.id <= sinceId) continue;
                m.name = cur.getString(1);
                m.size = cur.getLong(2);
                m.modified = cur.getLong(4);
                m.mime = cur.getString(5);
                m.album = cur.getString(6);
                String where = cur.getString(7);
                if (m.name == null || m.size <= 0) continue;
                if (camera && !isCamera(where, m.album, m.name)) continue;
                if (m.album == null || m.album.trim().isEmpty()) m.album = "Otras";
                m.uri = ContentUris.withAppendedId(base, m.id);
                out.add(m);
            }
        } catch (SecurityException e) {
            // Sin permiso para ver las fotos
        } finally {
            if (cur != null) cur.close();
        }
    }

    // ------------------------------------------------------------------ Pausar, seguir, cancelar

    static boolean paused(Context c) {
        return prefs(c).getBoolean(K_PAUSED, false);
    }

    /** Para la copia en curso y no copia nada mas hasta que se pulse Reanudar. */
    static void pause(Context c) {
        prefs(c).edit().putBoolean(K_PAUSED, true).apply();
        Live.halt = true;
        setStatus(c, "En pausa: pulsa Reanudar para seguir copiando");
        notifications(c).cancel(NOTIF_PROGRESS);
    }

    static void resume(Context c) {
        prefs(c).edit().putBoolean(K_PAUSED, false).apply();
        setStatus(c, "Reanudando…");
        runNow(c);
    }

    /** Para la copia en curso y se olvida de lo que faltaba: solo se copiaran las fotos nuevas desde ahora. */
    static void cancel(Context c) {
        Live.halt = true;
        prefs(c).edit().putBoolean(K_PAUSED, false)
                .putLong(K_SINCE, System.currentTimeMillis() / 1000).putLong(K_SINCE_ID, Long.MAX_VALUE).apply();
        setStatus(c, "Cancelada: las fotos que faltaban no se copian; las nuevas, sí");
        notifications(c).cancel(NOTIF_PROGRESS);
    }

    /**
     * "Solo de la camara": tiene que estar en DCIM y no ser de WhatsApp, Telegram, capturas...
     * (algunos moviles y apps guardan esas fotos tambien dentro de DCIM).
     */
    static boolean isCamera(String where, String album, String name) {
        if (where == null) return false;
        String w = where.replace('\\', '/');
        if (!(w.startsWith("DCIM/") || w.contains("/DCIM/"))) return false;
        String all = (w + "|" + album + "|" + name).toLowerCase(Locale.ROOT);
        for (String bad : new String[]{"whatsapp", "telegram", "screenshot", "captura", "instagram", "facebook",
                "messenger", "signal", "snapchat", "tiktok", "twitter", "download", "descarga"}) {
            if (all.contains(bad)) return false;
        }
        String n = name == null ? "" : name.toUpperCase(Locale.ROOT);
        return !n.matches(".*-WA\\d+.*");                 // IMG-20241105-WA0067.jpeg = WhatsApp
    }

    /** Hace la copia. Devuelve true si hay que reintentar mas tarde (se corto). */
    static synchronized boolean copy(Context c, final Stop jobStop) throws Exception {
        SharedPreferences p = prefs(c);
        if (!p.getBoolean(K_ON, false)) return false;
        if (p.getBoolean(K_PAUSED, false)) return false;
        Live.halt = false;
        final Stop stop = new Stop() { @Override public boolean stop() { return Live.halt || jobStop.stop(); } };
        String base = p.getString("server_url", null);
        String cookie = p.getString(K_COOKIE, null);
        if (base == null) return false;
        if (cookie == null || cookie.isEmpty()) {
            setStatus(c, "Abre DrivePanel y entra con tu usuario para que pueda copiar");
            return false;
        }
        List<Media> list = pending(c);
        if (list.isEmpty()) {
            setStatus(c, "Todo copiado");
            return false;
        }
        String folder = p.getString(K_FOLDER, DEFAULT_FOLDER);
        String ua = "DrivePanelAndroid/" + version(c) + " (copia de fotos)";
        int done = 0, skipped = 0;
        final NotificationManager nm = notifications(c);
        final Context ctx = c;
        long all = 0;
        for (Media m : list) all += m.size;
        synchronized (Live.class) { Live.seq = 0; }
        Live.totalBytes = all;
        Live.doneBytes = 0;
        Live.fileSent = 0;
        Live.count = list.size();
        Live.index = 0;
        Live.speed = 0;
        Live.start = System.currentTimeMillis();
        Live.running = true;
        setStatus(c, "Copiando " + list.size() + " fotos y vídeos…");
        // Cada segundo: velocidad, grafica y aviso con %, velocidad y tiempo que queda
        Thread ticker = new Thread(new Runnable() { @Override public void run() {
            long last = Live.sent();
            double[] win = new double[5];
            int k = 0;
            while (Live.running) {
                try { Thread.sleep(1000); } catch (InterruptedException e) { return; }
                long now = Live.sent();
                double v = Math.max(0, now - last);
                last = now;
                Live.sample(v);
                win[k++ % win.length] = v;
                double sum = 0;
                int n = Math.min(k, win.length);
                for (int i = 0; i < n; i++) sum += win[i];
                Live.speed = (long) (sum / n);
                progress(ctx, nm);
            }
        } });
        ticker.setDaemon(true);
        ticker.start();
        try {
            for (int i = 0; i < list.size(); i++) {
                if (stop.stop()) {
                    if (Live.halt) return false;
                    setStatus(c, "En pausa (" + (list.size() - i) + " pendientes)");
                    return true;
                }
                Media m = list.get(i);
                Live.index = i + 1;
                Live.name = m.name;
                Live.fileSent = 0;
                progress(c, nm);
                final ContentResolver cr = c.getContentResolver();
                int r = upload(new Opener() { @Override public InputStream open(Media x) throws Exception { return cr.openInputStream(x.uri); } },
                        base, cookie, ua, folder, m, stop);
                if (r == 401) {
                    setStatus(c, "Tienes que volver a entrar en DrivePanel (la sesión ha caducado)");
                    result(c, nm, "La copia de fotos está parada", "Abre DrivePanel y vuelve a entrar con tu usuario.");
                    return false;
                }
                if (r == -2) { // cortado a medias
                    if (Live.halt) return false; // pausada o cancelada desde la app
                    setStatus(c, "En pausa (" + (list.size() - i) + " pendientes)");
                    return true;
                }
                if (r != 200 && r != -1) {
                    setStatus(c, "Error " + r + " al subir " + m.name + "; se reintentará");
                    return true;
                }
                if (r == -1) skipped++; else done++;
                Live.fileSent = 0;
                Live.doneBytes += m.size;
                if (Live.halt) return false;
                p.edit().putLong(K_SINCE, m.added).putLong(K_SINCE_ID, m.id)
                        .putLong(K_TOTAL, p.getLong(K_TOTAL, 0) + (r == 200 ? 1 : 0)).apply();
            }
        } finally {
            Live.running = false;
            ticker.interrupt();
            nm.cancel(NOTIF_PROGRESS);
        }
        String when = new SimpleDateFormat("d/M HH:mm", new Locale("es", "ES")).format(new Date());
        p.edit().putString(K_LAST, when).apply();
        setStatus(c, "Todo copiado · última copia " + when);
        if (done > 0) result(c, nm, done == 1 ? "1 foto o vídeo copiado a DrivePanel" : done + " fotos y vídeos copiados a DrivePanel",
                "Carpeta: " + (folder.isEmpty() ? "Mi unidad" : folder));
        return false;
    }

    /** 200 = subido, -1 = ya estaba, -2 = cortado, otro = codigo de error del servidor. */
    static int upload(Opener opener, String base, String cookie, String ua, String folder, Media m, Stop stop) throws Exception {
        String uid = randomUid();
        String rel = clean(m.album) + "/" + clean(m.name);
        long offset = 0;
        while (offset < m.size || m.size == 0) {
            if (stop.stop()) return -2;
            int len = (int) Math.min(CHUNK, m.size - offset);
            String q = "path=" + enc(folder) + "&name=" + enc(rel) + "&uid=" + uid + "&offset=" + offset
                    + "&total=" + m.size + "&conflict=skip";
            HttpURLConnection h = (HttpURLConnection) new URL(base + "/api/upload?" + q).openConnection();
            h.setRequestMethod("PUT");
            h.setDoOutput(true);
            h.setConnectTimeout(15000);
            h.setReadTimeout(120000);
            h.setFixedLengthStreamingMode(len);
            h.setRequestProperty("Cookie", cookie);
            h.setRequestProperty("User-Agent", ua);
            h.setRequestProperty("Content-Type", "application/octet-stream");
            h.setRequestProperty("X-Mtime", String.valueOf(m.modified * 1000));
            try {
                InputStream in = opener.open(m);
                if (in == null) return 200; // ya no existe: se salta
                try {
                    skipFully(in, offset);
                    Live.fileSent = offset;
                    OutputStream out = h.getOutputStream();
                    byte[] buf = new byte[256 * 1024];
                    int left = len;
                    while (left > 0) {
                        int n = in.read(buf, 0, Math.min(buf.length, left));
                        if (n < 0) break;
                        out.write(buf, 0, n);
                        left -= n;
                        Live.fileSent += n;
                        if (stop.stop()) { h.disconnect(); return -2; }
                    }
                    out.close();
                } finally {
                    in.close();
                }
                int code = h.getResponseCode();
                if (code == 401 || code == 403) return 401;
                if (code == 409) {
                    // El servidor dice desde donde seguir
                    String body = read(h.getErrorStream());
                    int k = body.indexOf("offset:");
                    if (k >= 0) {
                        offset = Long.parseLong(body.substring(k + 7).replaceAll("[^0-9].*$", ""));
                        continue;
                    }
                    return code;
                }
                if (code != 200) return code;
                JSONObject o = new JSONObject(read(h.getInputStream()));
                if (o.optBoolean("skipped")) return -1;
                if (o.optBoolean("done")) return 200;
                offset = o.optLong("received", offset + len);
            } catch (java.io.IOException e) {
                return -2;
            } finally {
                h.disconnect();
            }
        }
        return 200;
    }

    // ------------------------------------------------------------------ Avisos

    private static NotificationManager notifications(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Copia de fotos", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Progreso de la copia automática de fotos y vídeos");
            nm.createNotificationChannel(ch);
        }
        return nm;
    }

    private static Notification.Builder builder(Context c) {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        Intent open = new Intent(c, MainActivity.class).setAction(MainActivity.ACTION_COPIA);
        b.setContentIntent(PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        return b;
    }

    /** Una linea con lo que se lleva: "120 MB de 980 MB · 2,1 MB/s · quedan 4 min". */
    static String stats() {
        StringBuilder b = new StringBuilder(Descargas.size(Live.sent()) + " de " + Descargas.size(Live.totalBytes));
        if (Live.speed > 0) b.append(" · ").append(Descargas.size(Live.speed)).append("/s");
        long eta = Live.eta();
        if (eta >= 0) b.append(" · quedan ").append(Descargas.time(eta));
        return b.toString();
    }

    private static void progress(Context c, NotificationManager nm) {
        if (!Live.running) return;
        try {
            int pct = Live.percent();
            nm.notify(NOTIF_PROGRESS, builder(c)
                    .setSmallIcon(android.R.drawable.stat_sys_upload)
                    .setContentTitle("Copiando fotos: " + Live.index + " de " + Live.count + " · " + pct + " %")
                    .setContentText(stats())
                    .setSubText(Live.name)
                    .setStyle(new Notification.BigTextStyle().bigText(stats() + "\n" + Live.name))
                    .setProgress(1000, Live.totalBytes <= 0 ? 0 : (int) Math.min(1000, Live.sent() * 1000 / Live.totalBytes), false)
                    .setOngoing(true)
                    .setOnlyAlertOnce(true)
                    .addAction(android.R.drawable.ic_media_pause, "Pausar", action(c, AccionCopia.PAUSE))
                    .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Cancelar", action(c, AccionCopia.CANCEL))
                    .build());
        } catch (Exception ignored) { } // sin permiso de notificaciones: no pasa nada
    }

    private static PendingIntent action(Context c, String what) {
        Intent i = new Intent(c, AccionCopia.class).setAction(what);
        return PendingIntent.getBroadcast(c, what.hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static void result(Context c, NotificationManager nm, String title, String text) {
        try {
            nm.notify(NOTIF_RESULT, builder(c)
                    .setSmallIcon(android.R.drawable.stat_sys_upload_done)
                    .setContentTitle(title)
                    .setContentText(text)
                    .setAutoCancel(true)
                    .build());
        } catch (Exception ignored) { }
    }

    static void setStatus(Context c, String s) {
        prefs(c).edit().putString(K_STATUS, s).apply();
    }

    // ------------------------------------------------------------------ Utilidades

    private static String version(Context c) {
        try { return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName; } catch (Exception e) { return "?"; }
    }

    private static String clean(String s) {
        return s.replaceAll("[\\\\/:*?\"<>|\\u0000-\\u001f]", "_").trim();
    }

    private static String enc(String s) throws Exception {
        return URLEncoder.encode(s, "UTF-8").replace("+", "%20");
    }

    private static String randomUid() {
        byte[] b = new byte[12];
        new SecureRandom().nextBytes(b);
        StringBuilder s = new StringBuilder("auto-");
        for (byte x : b) s.append(String.format("%02x", x));
        return s.toString();
    }

    private static void skipFully(InputStream in, long n) throws java.io.IOException {
        while (n > 0) {
            long k = in.skip(n);
            if (k <= 0) {
                if (in.read() < 0) return;
                k = 1;
            }
            n -= k;
        }
    }

    private static String read(InputStream in) throws java.io.IOException {
        if (in == null) return "";
        java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream();
        byte[] b = new byte[4096];
        int n;
        while ((n = in.read(b)) > 0) o.write(b, 0, n);
        in.close();
        return o.toString("UTF-8");
    }
}
