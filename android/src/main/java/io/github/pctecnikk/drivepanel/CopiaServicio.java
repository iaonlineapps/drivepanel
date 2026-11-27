package io.github.pctecnikk.drivepanel;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.ConnectivityManager;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/**
 * Copia de fotos larga (muchos GB): corre como "subida en curso" con su aviso fijo, como
 * Google Fotos. Asi Android no la corta a los 10 minutos ni la duerme por la noche, como
 * pasa con las tareas en segundo plano normales (JobScheduler). Si se corta la conexion,
 * reintenta sola; si no puede seguir, lo deja programado para mas tarde.
 */
public class CopiaServicio extends Service {

    static volatile boolean active;
    private volatile boolean stop;
    private PowerManager.WakeLock wake;
    private WifiManager.WifiLock wifi;

    /** Arranca la copia en primer plano. false si Android no lo deja (app en segundo plano). */
    static boolean start(Context c) {
        if (active) return true;
        try {
            Intent i = new Intent(c, CopiaServicio.class);
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
            return true;
        } catch (Throwable t) {
            return false; // Android 12+: no se puede empezar desde segundo plano sin quitar el ahorro de bateria
        }
    }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (active) return START_NOT_STICKY;
        Tr.init(this);
        try {
            Notification n = CopiaFotos.waitingNotification(this, Tr.t("Preparando la copia de fotos…"));
            if (Build.VERSION.SDK_INT >= 29) startForeground(CopiaFotos.NOTIF_PROGRESS, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(CopiaFotos.NOTIF_PROGRESS, n);
        } catch (Throwable t) {
            stopSelf();
            CopiaFotos.runNowJob(this);
            return START_NOT_STICKY;
        }
        active = true;
        stop = false;
        lock();
        new Thread(new Runnable() { @Override public void run() { loop(); } }, "copia-fotos").start();
        return START_NOT_STICKY;
    }

    private void loop() {
        int fails = 0;
        try {
            while (!stop) {
                boolean again;
                try {
                    again = CopiaFotos.copy(this, new CopiaFotos.Stop() { @Override public boolean stop() { return stop; } });
                } catch (Throwable t) {
                    CopiaFotos.setStatus(this, "Error: " + t.getMessage());
                    again = true;
                }
                if (!again || stop || CopiaFotos.Live.halt || CopiaFotos.paused(this)) break;
                if (CopiaFotos.prefs(this).getBoolean(CopiaFotos.K_WIFI, true) && metered()) {
                    CopiaFotos.setStatus(this, Tr.t("Esperando wifi para seguir copiando"));
                    break; // la tarea programada sigue cuando vuelva la wifi
                }
                if (++fails > 30) break;
                // Se corto (wifi, servidor reiniciado...): espera un poco y sigue donde lo dejo
                long wait = Math.min(30_000L * fails, 5 * 60_000L);
                CopiaFotos.notifyWaiting(this, Tr.t("Sin conexión con DrivePanel; se reintenta en ") + Descargas.time(wait / 1000));
                long until = System.currentTimeMillis() + wait;
                while (!stop && System.currentTimeMillis() < until) {
                    try { Thread.sleep(1000); } catch (InterruptedException e) { break; }
                }
                // Si ha avanzado algo, los fallos vuelven a cero
                if (CopiaFotos.Live.doneBytes > 0) fails = Math.min(fails, 3);
            }
        } finally {
            active = false;
            unlock();
            CopiaFotos.schedule(this); // lo que quede, lo sigue la tarea programada
            if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
            stopSelf();
        }
    }

    private boolean metered() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            return cm.isActiveNetworkMetered();
        } catch (Exception e) {
            return false;
        }
    }

    @SuppressWarnings("deprecation")
    private void lock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DrivePanel:copia");
            wake.acquire(24 * 3600_000L);
        } catch (Exception ignored) { }
        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            wifi = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "DrivePanel:copia");
            wifi.acquire();
        } catch (Exception ignored) { }
    }

    private void unlock() {
        try { if (wake != null && wake.isHeld()) wake.release(); } catch (Exception ignored) { }
        try { if (wifi != null && wifi.isHeld()) wifi.release(); } catch (Exception ignored) { }
    }

    @Override
    public void onDestroy() {
        stop = true;
        unlock();
        super.onDestroy();
    }

    /** Android 15+: si un dia se pasa del tiempo maximo, se para bien y sigue la tarea programada. */
    public void onTimeout(int startId) {
        stop = true;
    }

    public void onTimeout(int startId, int fgsType) {
        stop = true;
    }
}
