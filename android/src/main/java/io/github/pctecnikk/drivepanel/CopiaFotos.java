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
            K_COOKIE = "auto_cookie", K_TOTAL = "auto_total", K_PAUSED = "auto_paused", K_START = "auto_start";
    static final String DEFAULT_FOLDER = "Fotos del móvil";
    private static final int JOB_PERIODIC = 41, JOB_TRIGGER = 42, JOB_NOW = 43;
    private static final String CHANNEL = "copia";
    static final int NOTIF_PROGRESS = 7001, NOTIF_RESULT = 7002;
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

    /** "Copiar ahora": con cualquier conexion, ya. Mejor como subida en primer plano (no se corta). */
    static void runNow(Context c) {
        if (!CopiaServicio.start(c)) runNowJob(c);
    }

    static void runNowJob(Context c) {
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
        Tr.init(this);
        new Thread(new Runnable() { @Override public void run() {
            // Si hay cosas que copiar, mejor como subida en primer plano: asi Android no la corta
            // a los 10 minutos ni la duerme por la noche. Si no lo deja, se copia aqui como antes.
            try {
                SharedPreferences p = prefs(CopiaFotos.this);
                if (CopiaServicio.active || (p.getBoolean(K_ON, false) && !p.getBoolean(K_PAUSED, false)
                        && access(CopiaFotos.this) > 0 && counts(CopiaFotos.this)[2] > 0
                        && CopiaServicio.start(CopiaFotos.this))) {
                    if (params.getJobId() == JOB_TRIGGER) scheduleTrigger(CopiaFotos.this);
                    jobFinished(params, false);
                    return;
                }
            } catch (Throwable ignored) { }
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

    /**
     * Desde que fecha se copian las fotos (0 = todas las del movil). Es fija: lo que ya esta
     * subido no se apunta aqui, se pregunta al servidor en cada copia, como Google Fotos.
     */
    static long start(Context c) {
        SharedPreferences p = prefs(c);
        if (!p.contains(K_START)) {
            // Version anterior: si ya habia copiado muchas, se eligio "todas"
            long v = p.getLong(K_TOTAL, 0) > 50 ? 0 : p.getLong(K_SINCE, 0);
            p.edit().putLong(K_START, v).apply();
            return v;
        }
        return p.getLong(K_START, 0);
    }

    /** Todas las fotos y videos del movil que tocan (desde la fecha elegida), de mas antiguo a mas nuevo. */
    static List<Media> pending(Context c) {
        SharedPreferences p = prefs(c);
        long since = start(c), sinceId = -1;
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

    /** 0 = sin permiso para ver fotos, 1 = solo algunas fotos (Android 14), 2 = todas. */
    static int access(Context c) {
        int ok = android.content.pm.PackageManager.PERMISSION_GRANTED;
        if (Build.VERSION.SDK_INT < 33) {
            if (c.checkSelfPermission("android.permission.READ_EXTERNAL_STORAGE") == ok) return 2;
        } else {
            boolean img = c.checkSelfPermission("android.permission.READ_MEDIA_IMAGES") == ok;
            boolean vid = c.checkSelfPermission("android.permission.READ_MEDIA_VIDEO") == ok;
            if (img && vid) return 2;
            if (img || vid) return 1; // fotos si y videos no (o al reves)
        }
        if (Build.VERSION.SDK_INT >= 34 && c.checkSelfPermission("android.permission.READ_MEDIA_VISUAL_USER_SELECTED")
                == android.content.pm.PackageManager.PERMISSION_GRANTED) return 1;
        return 0;
    }

    // ------------------------------------------------------------------ Pausar, seguir, cancelar

    static boolean paused(Context c) {
        return prefs(c).getBoolean(K_PAUSED, false);
    }

    /** Para la copia en curso y no copia nada mas hasta que se pulse Reanudar. */
    static void pause(Context c) {
        prefs(c).edit().putBoolean(K_PAUSED, true).apply();
        Live.halt = true;
        setStatus(c, Tr.t("En pausa: pulsa Reanudar para seguir copiando"));
        notifications(c).cancel(NOTIF_PROGRESS);
    }

    static void resume(Context c) {
        prefs(c).edit().putBoolean(K_PAUSED, false).apply();
        setStatus(c, Tr.t("Reanudando…"));
        runNow(c);
    }

    /** Para la copia en curso y se olvida de lo que faltaba: solo se copiaran las fotos nuevas desde ahora. */
    static void cancel(Context c) {
        Live.halt = true;
        prefs(c).edit().putBoolean(K_PAUSED, false)
                .putLong(K_START, System.currentTimeMillis() / 1000).apply();
        setStatus(c, Tr.t("Cancelada: las fotos que faltaban no se copian; las nuevas, sí"));
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
            setStatus(c, Tr.t("Abre DrivePanel y entra con tu usuario para que pueda copiar"));
            return false;
        }
        int acc = access(c);
        if (acc == 0) {
            setStatus(c, Tr.t("Falta el permiso para ver tus fotos: abre esta pantalla, pulsa «Copiar ahora» y elige «Permitir todo»"));
            return false;
        }
        List<Media> phone = pending(c);
        String folder = p.getString(K_FOLDER, Tr.t(DEFAULT_FOLDER));
        String ua = "DrivePanelAndroid/" + version(c) + " (copia de fotos)";
        List<Media> list = new ArrayList<>();
        if (!phone.isEmpty()) {
            base = followRedirect(c, base);
            // Se pregunta a DrivePanel que tiene ya (mismo nombre y tamano): eso no se vuelve a subir
            // y la copia sigue justo por donde se quedo, aunque se cortara a medias.
            setStatus(c, Tr.t("Comprobando lo que ya está en DrivePanel…"));
            java.util.Set<String> have = existing(base, cookie, ua, folder, phone);
            if (have == null) {
                setStatus(c, Tr.t("No se puede conectar con DrivePanel; se reintentará"));
                return true;
            }
            for (Media m : phone) if (!have.contains(rel(m) + "|" + m.size)) list.add(m);
        }
        if (list.isEmpty()) {
            StringBuilder why = new StringBuilder(Tr.t("Todo copiado"));
            long since = start(c);
            if (since > 0) why.append(Tr.t(" · se copian las fotos y vídeos nuevos desde el "))
                    .append(new SimpleDateFormat("d/M/yyyy HH:mm", new Locale("es", "ES")).format(new Date(since * 1000)));
            if (acc == 1) why.append(Tr.t(" · Ojo: solo tiene permiso para algunas fotos o sin vídeos; pulsa «Copiar ahora» y elige «Permitir todo»"));
            setStatus(c, why.toString());
            return false;
        }
        int done = 0, skipped = 0;
        List<String> bad = new ArrayList<>();
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
        setStatus(c, Tr.t("Copiando ") + list.size() + Tr.t(" fotos y vídeos…"));
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
                    setStatus(c, Tr.t("En pausa (") + (list.size() - i) + Tr.t(" pendientes)"));
                    return true;
                }
                Media m = list.get(i);
                Live.index = i + 1;
                Live.name = m.name;
                Live.fileSent = 0;
                progress(c, nm);
                final ContentResolver cr = c.getContentResolver();
                // Tamano real del archivo (Android a veces guarda uno viejo)
                long real = realSize(cr, m);
                int r;
                String key = rel(m) + "|" + m.size;
                Integer tries = FAILS.get(key);
                if (real < 0) r = -3;
                else if (tries != null && tries >= 4) r = -4; // ya fallo varias veces: luego se reintenta
                else {
                    if (real > 0) m.size = real;
                    r = upload(new Opener() { @Override public InputStream open(Media x) throws Exception { return cr.openInputStream(x.uri); } },
                        base, cookie, ua, folder, m, stop);
                }
                if (r == -3 || r == -4 || (r >= 400 && r < 500 && r != 401 && r != 408 && r != 429)) {
                    // Este archivo no se puede subir (borrado, ilegible, nombre raro...): se salta y se sigue
                    if (r != -4) FAILS.put(key, 99);
                    bad.add(m.name);
                    Live.doneBytes += m.size;
                    continue;
                }
                if (r == 507) {
                    setStatus(c, Tr.t("DrivePanel no tiene espacio (disco o cuota llenos); la copia está parada"));
                    result(c, nm, Tr.t("La copia de fotos está parada"), Tr.t("No queda espacio en DrivePanel."));
                    return false;
                }
                if (r >= 500) FAILS.put(key, (tries == null ? 0 : tries) + 1); // errores del servidor con este archivo
                if (r == 401) {
                    setStatus(c, Tr.t("Tienes que volver a entrar en DrivePanel (la sesión ha caducado)"));
                    result(c, nm, Tr.t("La copia de fotos está parada"), Tr.t("Abre DrivePanel y vuelve a entrar con tu usuario."));
                    return false;
                }
                if (r == -2) { // cortado a medias
                    if (Live.halt) return false; // pausada o cancelada desde la app
                    setStatus(c, Tr.t("En pausa (") + (list.size() - i) + Tr.t(" pendientes)"));
                    return true;
                }
                if (r >= 300 && r < 400) {
                    base = followRedirect(c, base);
                    setStatus(c, Tr.t("El servidor ha cambiado de dirección; se reintentará"));
                    return true;
                }
                if (r != 200 && r != -1) {
                    setStatus(c, Tr.t("Error ") + r + Tr.t(" al subir ") + m.name + Tr.t("; se reintentará"));
                    return true;
                }
                if (r == -1) skipped++; else done++;
                Live.fileSent = 0;
                Live.doneBytes += m.size;
                if (Live.halt) return false;
                p.edit().putLong(K_TOTAL, p.getLong(K_TOTAL, 0) + (r == 200 ? 1 : 0)).apply();
            }
        } finally {
            Live.running = false;
            ticker.interrupt();
            if (!CopiaServicio.active) nm.cancel(NOTIF_PROGRESS);
        }
        String when = new SimpleDateFormat("d/M HH:mm", new Locale("es", "ES")).format(new Date());
        p.edit().putString(K_LAST, when).apply();
        if (bad.isEmpty()) setStatus(c, Tr.t("Todo copiado · última copia ") + when);
        else setStatus(c, Tr.t("Copia terminada · ") + when + " · " + bad.size() + Tr.t(" no se pudieron subir: ")
                + TextUtilsJoin(bad));
        if (done > 0) result(c, nm, done == 1 ? Tr.t("1 foto o vídeo copiado a DrivePanel") : done + Tr.t(" fotos y vídeos copiados a DrivePanel"),
                Tr.t("Carpeta: ") + (folder.isEmpty() ? Tr.t("Mi unidad") : folder));
        return false;
    }

    /**
     * Si el servidor redirige (por ejemplo http://drive.midominio.com -> https://..., como hace
     * Pangolin), se guarda la nueva direccion. Las subidas (PUT) no siguen redirecciones solas
     * y fallaban con "Error 301/308".
     */
    static String followRedirect(Context c, String base) {
        String b = base;
        for (int hop = 0; hop < 4; hop++) {
            HttpURLConnection h = null;
            String moved = null;
            try {
                h = (HttpURLConnection) new URL(b + "/static/manifest.webmanifest").openConnection();
                h.setInstanceFollowRedirects(false);
                h.setConnectTimeout(15000);
                h.setReadTimeout(15000);
                int code = h.getResponseCode();
                if (code >= 300 && code < 400) moved = MainActivity.redirectedBase(b, h.getHeaderField("Location"));
            } catch (Exception e) {
                break;
            } finally {
                if (h != null) h.disconnect();
            }
            if (moved == null) break;
            b = moved;
        }
        if (!b.equals(base)) prefs(c).edit().putString("server_url", b).apply();
        return b;
    }

    /** 200 = subido, -1 = ya estaba, -2 = cortado, otro = codigo de error del servidor. */
    static int upload(Opener opener, String base, String cookie, String ua, String folder, Media m, Stop stop) throws Exception {
        String rel = rel(m);
        // Mismo identificador para el mismo archivo: si se corta, sigue por el trozo donde se quedo
        final String key = rel + "|" + m.size;
        String uid = stableUid(key);
        Long saved = RESUME.get(key);
        long offset = saved == null ? 0 : saved;
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
                InputStream in;
                try {
                    in = opener.open(m);
                } catch (Exception e) {
                    return -3; // borrado o sin permiso: no se puede leer
                }
                if (in == null) return -3;
                try {
                    try {
                        skipFully(in, offset);
                    } catch (Exception e) {
                        return -3;
                    }
                    Live.fileSent = offset;
                    OutputStream out = h.getOutputStream();
                    byte[] buf = new byte[256 * 1024];
                    int left = len;
                    while (left > 0) {
                        int n;
                        try {
                            n = in.read(buf, 0, Math.min(buf.length, left));
                        } catch (Exception e) {
                            return -3;
                        }
                        if (n < 0) return -3; // el archivo es mas corto de lo que dice Android
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
                if (o.optBoolean("skipped")) { RESUME.remove(key); return -1; }
                if (o.optBoolean("done")) { RESUME.remove(key); return 200; }
                offset = o.optLong("received", offset + len);
                RESUME.put(key, offset);
            } catch (java.io.IOException e) {
                return -2;
            } finally {
                h.disconnect();
            }
        }
        return 200;
    }

    /** Archivos que fallan una y otra vez: se saltan en esta copia para no quedarse atascada. */
    static final java.util.Map<String, Integer> FAILS = new java.util.concurrent.ConcurrentHashMap<>();
    /** Hasta donde llego cada archivo a medias, para seguir desde ahi y no desde el principio. */
    static final java.util.Map<String, Long> RESUME = new java.util.concurrent.ConcurrentHashMap<>();

    private static String stableUid(String key) {
        try {
            byte[] d = java.security.MessageDigest.getInstance("SHA-1").digest(key.getBytes("UTF-8"));
            StringBuilder s = new StringBuilder("auto-");
            for (int i = 0; i < 12; i++) s.append(String.format("%02x", d[i]));
            return s.toString();
        } catch (Exception e) {
            return randomUid();
        }
    }

    private static String TextUtilsJoin(List<String> l) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < l.size() && i < 5; i++) b.append(i == 0 ? "" : ", ").append(l.get(i));
        if (l.size() > 5) b.append("…");
        return b.toString();
    }

    /** Tamano real del archivo, o -1 si no se puede abrir (borrado, sin permiso). */
    static long realSize(ContentResolver cr, Media m) {
        android.os.ParcelFileDescriptor fd = null;
        try {
            fd = cr.openFileDescriptor(m.uri, "r");
            return fd == null ? -1 : Math.max(0, fd.getStatSize());
        } catch (Exception e) {
            return -1;
        } finally {
            try { if (fd != null) fd.close(); } catch (Exception ignored) { }
        }
    }

    static String rel(Media m) {
        return clean(m.album) + "/" + clean(m.name);
    }

    /** Pregunta al servidor cuales ya tiene (nombre y tamano iguales). Devuelve "ruta|tamano". */
    static java.util.Set<String> existing(String base, String cookie, String ua, String folder, List<Media> list) {
        java.util.Set<String> out = new java.util.HashSet<>();
        for (int from = 0; from < list.size(); from += 500) {
            HttpURLConnection h = null;
            try {
                org.json.JSONArray files = new org.json.JSONArray();
                for (int i = from; i < Math.min(list.size(), from + 500); i++) {
                    Media m = list.get(i);
                    files.put(new org.json.JSONArray().put(rel(m)).put(m.size));
                }
                byte[] body = new JSONObject().put("path", folder).put("files", files).toString().getBytes("UTF-8");
                h = (HttpURLConnection) new URL(base + "/api/upload/check").openConnection();
                h.setRequestMethod("POST");
                h.setDoOutput(true);
                h.setConnectTimeout(15000);
                h.setReadTimeout(60000);
                h.setFixedLengthStreamingMode(body.length);
                h.setRequestProperty("Cookie", cookie);
                h.setRequestProperty("User-Agent", ua);
                h.setRequestProperty("Content-Type", "application/json");
                OutputStream o = h.getOutputStream();
                o.write(body);
                o.close();
                if (h.getResponseCode() != 200) return null;
                org.json.JSONArray ex = new JSONObject(read(h.getInputStream())).optJSONArray("exists");
                if (ex == null) continue;
                for (int i = 0; i < ex.length(); i++) {
                    JSONObject e = ex.getJSONObject(i);
                    if (e.optBoolean("same")) out.add(e.optString("rel") + "|" + e.optLong("size"));
                }
            } catch (Exception e) {
                return null; // sin conexion con el servidor
            } finally {
                if (h != null) h.disconnect();
            }
        }
        return out;
    }

    /**
     * Cuantas fotos y videos ve la app en el movil y cuantos faltan en DrivePanel:
     * {fotos, videos, faltan, bytes que faltan}. faltan = -1 si no se puede preguntar al servidor.
     */
    static long[] counts(Context c) {
        long[] r = {count(c, MediaStore.Images.Media.EXTERNAL_CONTENT_URI), count(c, MediaStore.Video.Media.EXTERNAL_CONTENT_URI), -1, 0};
        SharedPreferences p = prefs(c);
        String base = p.getString("server_url", null), cookie = p.getString(K_COOKIE, null);
        if (base == null || cookie == null) return r;
        List<Media> phone = pending(c);
        java.util.Set<String> have = phone.isEmpty() ? new java.util.HashSet<String>()
                : existing(base, cookie, "DrivePanelAndroid/" + version(c), p.getString(K_FOLDER, Tr.t(DEFAULT_FOLDER)), phone);
        if (have == null) return r;
        r[2] = 0;
        for (Media m : phone) if (!have.contains(rel(m) + "|" + m.size)) { r[2]++; r[3] += m.size; }
        return r;
    }

    private static int count(Context c, Uri u) {
        Cursor cur = null;
        try {
            cur = c.getContentResolver().query(u, new String[]{MediaStore.MediaColumns._ID}, null, null, null);
            return cur == null ? 0 : cur.getCount();
        } catch (Exception e) {
            return 0;
        } finally {
            if (cur != null) cur.close();
        }
    }

    // ------------------------------------------------------------------ Avisos

    private static NotificationManager notifications(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, Tr.t("Copia de fotos"), NotificationManager.IMPORTANCE_LOW);
            ch.setDescription(Tr.t("Progreso de la copia automática de fotos y vídeos"));
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

    /** Aviso de la copia cuando aun no esta subiendo (preparando, esperando conexion...). */
    static Notification waitingNotification(Context c, String text) {
        notifications(c);
        return builder(c)
                .setSmallIcon(android.R.drawable.stat_sys_upload)
                .setContentTitle(Tr.t("Copia de fotos de DrivePanel"))
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .addAction(android.R.drawable.ic_media_pause, Tr.t("Pausar"), action(c, AccionCopia.PAUSE))
                .build();
    }

    static void notifyWaiting(Context c, String text) {
        try { notifications(c).notify(NOTIF_PROGRESS, waitingNotification(c, text)); } catch (Exception ignored) { }
    }

    /** Una linea con lo que se lleva: "120 MB de 980 MB · 2,1 MB/s · quedan 4 min". */
    static String stats() {
        StringBuilder b = new StringBuilder(Descargas.size(Live.sent()) + Tr.t(" de ") + Descargas.size(Live.totalBytes));
        if (Live.speed > 0) b.append(" · ").append(Descargas.size(Live.speed)).append("/s");
        long eta = Live.eta();
        if (eta >= 0) b.append(Tr.t(" · quedan ")).append(Descargas.time(eta));
        return b.toString();
    }

    private static void progress(Context c, NotificationManager nm) {
        if (!Live.running) return;
        try {
            int pct = Live.percent();
            nm.notify(NOTIF_PROGRESS, builder(c)
                    .setSmallIcon(android.R.drawable.stat_sys_upload)
                    .setContentTitle(Tr.t("Copiando fotos: ") + Live.index + Tr.t(" de ") + Live.count + " · " + pct + " %")
                    .setContentText(stats())
                    .setSubText(Live.name)
                    .setStyle(new Notification.BigTextStyle().bigText(stats() + "\n" + Live.name))
                    .setProgress(1000, Live.totalBytes <= 0 ? 0 : (int) Math.min(1000, Live.sent() * 1000 / Live.totalBytes), false)
                    .setOngoing(true)
                    .setOnlyAlertOnce(true)
                    .addAction(android.R.drawable.ic_media_pause, Tr.t("Pausar"), action(c, AccionCopia.PAUSE))
                    .addAction(android.R.drawable.ic_menu_close_clear_cancel, Tr.t("Cancelar"), action(c, AccionCopia.CANCEL))
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
