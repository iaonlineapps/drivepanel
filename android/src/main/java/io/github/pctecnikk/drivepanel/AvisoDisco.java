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
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/**
 * Aviso de disco lleno: cada hora pregunta al servidor (con la sesion de la app) si el disco
 * se esta llenando. El servidor decide el nivel (casi lleno / lleno, ver alerts.py); aqui solo
 * se muestra una notificacion cuando el nivel SUBE, para no repetir el mismo aviso.
 * Funciona igual para cualquier servidor DrivePanel 1.0.8 o mas nuevo; con uno mas viejo no hace nada.
 */
public class AvisoDisco extends JobService {

    private static final int JOB = 51;
    private static final int NOTIF = 7101;
    private static final String CHANNEL = "disco";
    static final String K_LEVEL = "disk_level";

    // ------------------------------------------------------------------ Programar

    /** Al abrir la app (no se usa "persisted" ni arranque del movil: Play Protect lo marca). */
    static void ensureScheduled(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js.getPendingJob(JOB) != null) return;
        js.schedule(new JobInfo.Builder(JOB, new ComponentName(c, AvisoDisco.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(60 * 60 * 1000L)
                .build());
    }

    @Override
    public boolean onStartJob(final JobParameters params) {
        new Thread(new Runnable() { @Override public void run() {
            try { check(AvisoDisco.this); } catch (Throwable ignored) { }
            jobFinished(params, false);
        } }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return false;
    }

    // ------------------------------------------------------------------ Comprobar

    static void check(Context c) throws Exception {
        SharedPreferences p = CopiaFotos.prefs(c);
        String base = p.getString("server_url", null);
        String cookie = p.getString(CopiaFotos.K_COOKIE, null);
        if (base == null || cookie == null || cookie.isEmpty()) return;
        HttpURLConnection h = (HttpURLConnection) new URL(base + "/api/me").openConnection();
        h.setConnectTimeout(15000);
        h.setReadTimeout(20000);
        h.setRequestProperty("Cookie", cookie);
        h.setRequestProperty("User-Agent", "DrivePanelAndroid/" + appVersion(c));
        JSONObject me;
        try {
            if (h.getResponseCode() != 200) return; // sesion caducada o servidor apagado: nada
            me = new JSONObject(read(h.getInputStream()));
        } finally {
            h.disconnect();
        }
        JSONObject a = me.optJSONObject("disk_alert");
        int level = a == null ? 0 : a.optInt("level", 0);
        int last = p.getInt(K_LEVEL, 0);
        if (level != last) p.edit().putInt(K_LEVEL, level).apply();
        NotificationManager nm = notifications(c);
        if (level == 0) {
            if (last > 0) nm.cancel(NOTIF); // ya hay sitio: se quita el aviso
            return;
        }
        if (level <= last) return; // este aviso ya se mostro
        String pct = String.format(Locale.forLanguageTag("es-ES"), "%.1f", a.optDouble("pct", 0));
        if (pct.endsWith(",0")) pct = pct.substring(0, pct.length() - 2);
        String free = Descargas.size(a.optLong("free", 0));
        String title = level >= 2 ? "El disco de DrivePanel está lleno (" + pct + " %)"
                                  : "El disco de DrivePanel está casi lleno (" + pct + " %)";
        String text = level >= 2 ? "Solo quedan " + free + " libres. Puede que no se puedan subir más archivos."
                                 : "Quedan " + free + " libres.";
        notify(c, nm, title, text);
    }

    // ------------------------------------------------------------------ Notificacion

    private static NotificationManager notifications(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Disco lleno", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Aviso cuando el disco del servidor DrivePanel se está llenando");
            nm.createNotificationChannel(ch);
        }
        return nm;
    }

    private static void notify(Context c, NotificationManager nm, String title, String text) {
        try {
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
            Intent open = new Intent(c, MainActivity.class).setAction(Intent.ACTION_MAIN);
            nm.notify(NOTIF, b.setSmallIcon(android.R.drawable.stat_notify_error)
                    .setContentTitle(title)
                    .setContentText(text)
                    .setStyle(new Notification.BigTextStyle().bigText(text))
                    .setContentIntent(PendingIntent.getActivity(c, NOTIF, open,
                            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT))
                    .setAutoCancel(true)
                    .build());
        } catch (Exception ignored) { } // sin permiso de notificaciones: el aviso sigue en la web
    }

    private static String appVersion(Context c) {
        try { return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName; }
        catch (Exception e) { return "?"; }
    }

    private static String read(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return out.toString("UTF-8");
    }
}
