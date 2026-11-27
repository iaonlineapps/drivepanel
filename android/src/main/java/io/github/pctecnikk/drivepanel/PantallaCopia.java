package io.github.pctecnikk.drivepanel;

import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Pantalla "Copia de fotos", al estilo de la copia de seguridad de Google Fotos: arriba un
 * anillo con el estado (completada, copiando, en pausa, falta permiso...), debajo el resumen
 * (fotos y videos del movil, cuantos faltan) y los ajustes con interruptores.
 */
final class PantallaCopia {

    private static final int BLUE = 0xFF1A73E8, GREEN = 0xFF188038, ORANGE = 0xFFE37400, RED = 0xFFC5221F,
            TEXT = 0xFF1F1F1F, GREY = 0xFF5F6368, LINE = 0xFFE3E3E3, BG = 0xFFF8FAFD;

    private final MainActivity a;
    private final SharedPreferences p;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private View root;
    private boolean alive;

    // Estado
    private Anillo ring;
    private TextView head, sub, fileName, stats, statusLine;
    private GraficaVelocidad graph;
    private LinearLayout liveBox, runButtons;
    private Button main;
    // Resumen
    private TextView vPhotos, vVideos, vLeft, vDone, vLast;
    // Ajustes
    private Switch sOn, sWifi, sCamera;
    private TextView vFolder, vBattery, vBatteryHint, vWhich, vAlbums;
    private View batteryRow, extraBox;

    private volatile long[] counts;        // fotos, videos, faltan, bytes que faltan
    private long countsAt;
    private int seen = -1;

    PantallaCopia(MainActivity a, SharedPreferences p) {
        this.a = a;
        this.p = p;
    }

    View view() {
        if (root != null) return root;
        LinearLayout page = new LinearLayout(a);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setBackgroundColor(BG);
        page.setClickable(true); // que no pasen los toques a la web de debajo

        // Barra de arriba
        LinearLayout bar = new LinearLayout(a);
        bar.setBackgroundColor(BLUE);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(a.dp(4), 0, a.dp(16), 0);
        TextView back = new TextView(a);
        back.setText("←");
        back.setTextColor(Color.WHITE);
        back.setTextSize(24);
        back.setGravity(Gravity.CENTER);
        back.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { a.closeCopia(); } });
        bar.addView(back, new LinearLayout.LayoutParams(a.dp(48), a.dp(56)));
        TextView title = new TextView(a);
        title.setText(Tr.t("Copia de fotos"));
        title.setTextColor(Color.WHITE);
        title.setTextSize(20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        bar.addView(title);
        page.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, a.dp(56)));

        ScrollView scroll = new ScrollView(a);
        LinearLayout col = new LinearLayout(a);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(a.dp(16), a.dp(16), a.dp(16), a.dp(24));
        scroll.addView(col);
        page.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        col.addView(statusCard());
        col.addView(section(Tr.t("Resumen")));
        col.addView(summaryCard());
        col.addView(section(Tr.t("Ajustes")));
        col.addView(settingsCard());

        TextView ver = new TextView(a);
        ver.setText(Tr.t("Versión de la app: ") + Novedades.version(a) + " (" + a.versionCode() + ")");
        ver.setTextSize(12);
        ver.setTextColor(GREY);
        ver.setGravity(Gravity.CENTER);
        ver.setPadding(0, a.dp(16), 0, 0);
        col.addView(ver);

        root = page;
        alive = true;
        tick.run();
        return root;
    }

    void stop() {
        alive = false;
        ui.removeCallbacks(tick);
    }

    /** Vuelve a contar (por ejemplo al volver de dar un permiso). */
    void refresh() {
        countsAt = 0;
        syncSwitches();
    }

    // ------------------------------------------------------------------ Tarjetas

    private LinearLayout card() {
        LinearLayout c = new LinearLayout(a);
        c.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.WHITE);
        bg.setCornerRadius(a.dp(16));
        bg.setStroke(a.dp(1), LINE);
        c.setBackground(bg);
        c.setPadding(a.dp(16), a.dp(16), a.dp(16), a.dp(16));
        return c;
    }

    private TextView section(String s) {
        TextView t = new TextView(a);
        t.setText(s);
        t.setTextSize(14);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setTextColor(BLUE);
        t.setPadding(a.dp(4), a.dp(20), 0, a.dp(8));
        return t;
    }

    private View statusCard() {
        LinearLayout c = card();
        c.setGravity(Gravity.CENTER_HORIZONTAL);
        ring = new Anillo(a);
        c.addView(ring, new LinearLayout.LayoutParams(a.dp(132), a.dp(132)));

        head = new TextView(a);
        head.setTextSize(21);
        head.setTypeface(Typeface.DEFAULT_BOLD);
        head.setTextColor(TEXT);
        head.setGravity(Gravity.CENTER);
        head.setPadding(0, a.dp(12), 0, 0);
        c.addView(head);
        sub = new TextView(a);
        sub.setTextSize(14);
        sub.setTextColor(GREY);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, a.dp(4), 0, 0);
        c.addView(sub);

        liveBox = new LinearLayout(a);
        liveBox.setOrientation(LinearLayout.VERTICAL);
        liveBox.setPadding(0, a.dp(12), 0, 0);
        fileName = new TextView(a);
        fileName.setTextSize(13);
        fileName.setTextColor(GREY);
        fileName.setSingleLine(true);
        fileName.setEllipsize(TextUtils.TruncateAt.MIDDLE);
        fileName.setGravity(Gravity.CENTER);
        liveBox.addView(fileName);
        graph = new GraficaVelocidad(a, false);
        liveBox.addView(graph, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, a.dp(72)));
        stats = new TextView(a);
        stats.setTextSize(13);
        stats.setTextColor(TEXT);
        stats.setGravity(Gravity.CENTER);
        stats.setPadding(0, a.dp(4), 0, 0);
        liveBox.addView(stats);
        c.addView(liveBox, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        statusLine = new TextView(a);
        statusLine.setTextSize(13);
        statusLine.setTextColor(GREY);
        statusLine.setGravity(Gravity.CENTER);
        statusLine.setPadding(0, a.dp(8), 0, 0);
        c.addView(statusLine);

        main = new Button(a);
        main.setAllCaps(false);
        main.setTextColor(Color.WHITE);
        main.setTextSize(16);
        GradientDrawable mb = new GradientDrawable();
        mb.setColor(BLUE);
        mb.setCornerRadius(a.dp(24));
        main.setBackground(mb);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, a.dp(48));
        lp.topMargin = a.dp(16);
        c.addView(main, lp);

        runButtons = new LinearLayout(a);
        runButtons.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        rl.topMargin = a.dp(12);
        Button pause = flat(Tr.t("Pausar"));
        pause.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            CopiaFotos.pause(a);
            a.toast(Tr.t("Copia en pausa"));
        } });
        Button cancel = flat(Tr.t("Cancelar"));
        cancel.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            new AlertDialog.Builder(a)
                    .setTitle(Tr.t("¿Cancelar la copia?"))
                    .setMessage(Tr.t("Las fotos y vídeos que faltan no se copiarán. Las fotos nuevas que hagas a partir de ahora sí se seguirán copiando solas."))
                    .setPositiveButton(Tr.t("Cancelar copia"), new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) {
                        CopiaFotos.cancel(a);
                        countsAt = 0;
                        a.toast(Tr.t("Copia cancelada"));
                    } })
                    .setNegativeButton(Tr.t("Seguir copiando"), null)
                    .show();
        } });
        runButtons.addView(pause, new LinearLayout.LayoutParams(0, a.dp(44), 1));
        runButtons.addView(cancel, new LinearLayout.LayoutParams(0, a.dp(44), 1));
        c.addView(runButtons, rl);
        return c;
    }

    private Button flat(String text) {
        Button b = new Button(a);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextColor(BLUE);
        b.setBackgroundColor(Color.TRANSPARENT);
        return b;
    }

    private View summaryCard() {
        LinearLayout c = card();
        c.setPadding(a.dp(16), a.dp(4), a.dp(16), a.dp(4));
        vPhotos = row(c, Tr.t("Fotos en el móvil"), true);
        vVideos = row(c, Tr.t("Vídeos en el móvil"), true);
        vLeft = row(c, Tr.t("Faltan por copiar"), true);
        vDone = row(c, Tr.t("Subidas por la app"), true);
        vLast = row(c, Tr.t("Última copia completa"), false);
        return c;
    }

    private TextView row(LinearLayout parent, String label, boolean line) {
        LinearLayout r = new LinearLayout(a);
        r.setGravity(Gravity.CENTER_VERTICAL);
        r.setPadding(0, a.dp(12), 0, a.dp(12));
        TextView l = new TextView(a);
        l.setText(label);
        l.setTextSize(15);
        l.setTextColor(TEXT);
        r.addView(l, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        TextView v = new TextView(a);
        v.setTextSize(15);
        v.setTextColor(GREY);
        v.setGravity(Gravity.END);
        v.setText("…");
        r.addView(v);
        parent.addView(r);
        if (line) divider(parent);
        return v;
    }

    private void divider(LinearLayout parent) {
        View d = new View(a);
        d.setBackgroundColor(LINE);
        parent.addView(d, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1));
    }

    private View settingsCard() {
        LinearLayout c = card();
        c.setPadding(a.dp(16), a.dp(4), a.dp(16), a.dp(4));
        sOn = toggle(c, Tr.t("Copia automática"), Tr.t("Sube sola las fotos y vídeos nuevos"));
        divider(c);
        extraBox = new LinearLayout(a);
        ((LinearLayout) extraBox).setOrientation(LinearLayout.VERTICAL);
        LinearLayout x = (LinearLayout) extraBox;
        sWifi = toggle(x, Tr.t("Solo con wifi"), Tr.t("No gasta datos del móvil"));
        divider(x);
        sCamera = toggle(x, Tr.t("Solo de la cámara"), Tr.t("Sin WhatsApp, Telegram ni capturas"));
        divider(x);

        LinearLayout fr = clickRow(x, Tr.t("Carpeta en DrivePanel"));
        vFolder = (TextView) fr.getTag();
        fr.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { editFolder(); } });
        divider(x);

        LinearLayout br = clickRow(x, Tr.t("Que no se pare con la pantalla apagada"));
        vBattery = (TextView) br.getTag();
        batteryRow = br;
        br.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            if (!a.batteryFree()) a.askBattery();
            else a.toast(Tr.t("Ya está: Android deja a DrivePanel copiar con la pantalla apagada"));
        } });
        vBatteryHint = new TextView(a);
        vBatteryHint.setTextSize(12);
        vBatteryHint.setTextColor(GREY);
        vBatteryHint.setPadding(0, 0, 0, a.dp(10));
        x.addView(vBatteryHint);
        divider(x);

        LinearLayout albums = clickRow(x, Tr.t("Carpetas del móvil"));
        vAlbums = (TextView) albums.getTag();
        albums.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { chooseAlbums(); } });
        divider(x);

        LinearLayout which = clickRow(x, Tr.t("Qué fotos se copian"));
        vWhich = (TextView) which.getTag();
        which.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { chooseWhich(); } });
        c.addView(extraBox);

        syncSwitches();
        sOn.setOnCheckedChangeListener(new android.widget.CompoundButton.OnCheckedChangeListener() {
            @Override public void onCheckedChanged(android.widget.CompoundButton b, boolean on) {
                if (on == p.getBoolean(CopiaFotos.K_ON, false)) return;
                if (on) {
                    sOn.setChecked(false); // se activa de verdad al elegir que fotos
                    a.askWhichPhotos();
                } else {
                    p.edit().putBoolean(CopiaFotos.K_ON, false).apply();
                    CopiaFotos.cancelAll(a);
                    CopiaFotos.Live.halt = true;
                    a.toast(Tr.t("Copia automática desactivada"));
                }
                syncSwitches();
            }
        });
        android.widget.CompoundButton.OnCheckedChangeListener save = new android.widget.CompoundButton.OnCheckedChangeListener() {
            @Override public void onCheckedChanged(android.widget.CompoundButton b, boolean on) {
                a.saveCopia(sWifi.isChecked(), sCamera.isChecked(), p.getString(CopiaFotos.K_FOLDER, Tr.t(CopiaFotos.DEFAULT_FOLDER)));
                CopiaFotos.schedule(a);
                countsAt = 0;
            }
        };
        sWifi.setOnCheckedChangeListener(save);
        sCamera.setOnCheckedChangeListener(save);
        return c;
    }

    private Switch toggle(LinearLayout parent, String title, String hint) {
        LinearLayout r = new LinearLayout(a);
        r.setGravity(Gravity.CENTER_VERTICAL);
        r.setPadding(0, a.dp(10), 0, a.dp(10));
        LinearLayout texts = new LinearLayout(a);
        texts.setOrientation(LinearLayout.VERTICAL);
        TextView t = new TextView(a);
        t.setText(title);
        t.setTextSize(15);
        t.setTextColor(TEXT);
        texts.addView(t);
        TextView h = new TextView(a);
        h.setText(hint);
        h.setTextSize(12);
        h.setTextColor(GREY);
        texts.addView(h);
        r.addView(texts, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        final Switch s = new Switch(a);
        r.addView(s);
        r.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { s.toggle(); } });
        parent.addView(r);
        return s;
    }

    /** Fila que se toca: texto a la izquierda y valor a la derecha (el valor va en getTag()). */
    private LinearLayout clickRow(LinearLayout parent, String label) {
        LinearLayout r = new LinearLayout(a);
        r.setGravity(Gravity.CENTER_VERTICAL);
        r.setPadding(0, a.dp(14), 0, a.dp(14));
        TextView l = new TextView(a);
        l.setText(label);
        l.setTextSize(15);
        l.setTextColor(TEXT);
        r.addView(l, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        TextView v = new TextView(a);
        v.setTextSize(14);
        v.setTextColor(GREY);
        v.setGravity(Gravity.END);
        v.setMaxWidth(a.dp(170));
        r.addView(v);
        r.setTag(v);
        parent.addView(r);
        return r;
    }

    private void syncSwitches() {
        if (sOn == null) return;
        boolean on = p.getBoolean(CopiaFotos.K_ON, false);
        sOn.setChecked(on);
        sWifi.setChecked(p.getBoolean(CopiaFotos.K_WIFI, true));
        sCamera.setChecked(p.getBoolean(CopiaFotos.K_CAMERA, true));
        extraBox.setVisibility(on ? View.VISIBLE : View.GONE);
        String f = p.getString(CopiaFotos.K_FOLDER, Tr.t(CopiaFotos.DEFAULT_FOLDER));
        vFolder.setText((f.isEmpty() ? Tr.t("Mi unidad") : f) + "  ›");
        int offN = CopiaFotos.albumsOff(a).size();
        vAlbums.setText((offN == 0 ? Tr.t("Todas") : offN == 1 ? Tr.t("Todas menos 1") : Tr.t("Todas menos ") + offN) + "  ›");
        long st = CopiaFotos.start(a);
        vWhich.setText((st <= 0 ? Tr.t("Todas") : Tr.t("Desde el ")
                + new SimpleDateFormat("d/M/yyyy", new Locale("es", "ES")).format(new Date(st * 1000))) + "  ›");
    }

    private void editFolder() {
        final EditText in = new EditText(a);
        in.setSingleLine(true);
        in.setInputType(InputType.TYPE_CLASS_TEXT);
        in.setText(p.getString(CopiaFotos.K_FOLDER, Tr.t(CopiaFotos.DEFAULT_FOLDER)));
        FrameLayout box = new FrameLayout(a);
        box.setPadding(a.dp(20), a.dp(8), a.dp(20), 0);
        box.addView(in);
        new AlertDialog.Builder(a)
                .setTitle(Tr.t("Carpeta en DrivePanel"))
                .setMessage(Tr.t("Se crea si no existe. Dentro va una subcarpeta por álbum (Camera, WhatsApp Images…)."))
                .setView(box)
                .setPositiveButton(Tr.t("Guardar"), new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) {
                    a.saveCopia(sWifi.isChecked(), sCamera.isChecked(), in.getText().toString());
                    syncSwitches();
                    countsAt = 0;
                } })
                .setNegativeButton(Tr.t("Cancelar"), null)
                .show();
    }

    /** Lista de carpetas del movil con casillas: las marcadas se suben, como en Google Fotos. */
    private void chooseAlbums() {
        a.toast(Tr.t("Mirando las carpetas del móvil…"));
        new Thread(new Runnable() { @Override public void run() {
            final List<Object[]> list = CopiaFotos.albums(a);
            ui.post(new Runnable() { @Override public void run() {
                if (list.isEmpty()) {
                    a.toast(Tr.t("No se ven carpetas con fotos (revisa el permiso)"));
                    return;
                }
                final java.util.Set<String> off = CopiaFotos.albumsOff(a);
                final CharSequence[] names = new CharSequence[list.size()];
                final boolean[] on = new boolean[list.size()];
                for (int i = 0; i < list.size(); i++) {
                    String name = (String) list.get(i)[0];
                    names[i] = name + "  (" + list.get(i)[1] + ")";
                    on[i] = !off.contains(name);
                }
                new AlertDialog.Builder(a)
                        .setTitle(Tr.t("Carpetas que se suben"))
                        .setMultiChoiceItems(names, on, new DialogInterface.OnMultiChoiceClickListener() {
                            @Override public void onClick(DialogInterface d, int w, boolean checked) { on[w] = checked; }
                        })
                        .setPositiveButton(Tr.t("Guardar"), new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) {
                            java.util.Set<String> now = new java.util.HashSet<>(off);
                            for (int i = 0; i < list.size(); i++) {
                                String name = (String) list.get(i)[0];
                                if (on[i]) now.remove(name); else now.add(name);
                            }
                            p.edit().putStringSet(CopiaFotos.K_ALBUMS_OFF, now).apply();
                            syncSwitches();
                            countsAt = 0;
                            a.toast(Tr.t("Guardado"));
                        } })
                        .setNegativeButton(Tr.t("Cancelar"), null)
                        .show();
            } });
        } }).start();
    }

    private void chooseWhich() {
        new AlertDialog.Builder(a)
                .setTitle(Tr.t("Qué fotos se copian"))
                .setItems(new CharSequence[]{Tr.t("Todas las del móvil"), Tr.t("Solo las nuevas, desde hoy")}, new DialogInterface.OnClickListener() {
                    @Override public void onClick(DialogInterface d, int w) {
                        p.edit().putLong(CopiaFotos.K_START, w == 0 ? 0 : System.currentTimeMillis() / 1000)
                                .putBoolean(CopiaFotos.K_PAUSED, false).apply();
                        syncSwitches();
                        countsAt = 0;
                        if (w == 0) start();
                    }
                })
                .setNegativeButton(Tr.t("Cancelar"), null)
                .show();
    }

    /** Copiar ahora / Reanudar / Dar permiso, segun el estado. */
    private void start() {
        if (CopiaFotos.access(a) < 2) {
            CopiaFotos.setStatus(a, Tr.t("Esperando el permiso para ver tus fotos…"));
            a.requestPermissions(a.mediaPermissions(), MainActivity.REQ_MEDIA);
            return;
        }
        if (CopiaFotos.paused(a)) CopiaFotos.resume(a);
        else CopiaFotos.runNow(a);
        a.toast(Tr.t("Copiando…"));
        if (!a.batteryFree() && !p.getBoolean("battery_asked", false)) {
            p.edit().putBoolean("battery_asked", true).apply();
            a.askBattery();
        }
    }

    // ------------------------------------------------------------------ Cada segundo

    private final Runnable tick = new Runnable() { @Override public void run() {
        if (!alive) return;
        try { update(); } catch (Exception ignored) { }
        ui.postDelayed(this, 1000);
    } };

    private void update() {
        boolean on = p.getBoolean(CopiaFotos.K_ON, false);
        boolean running = CopiaFotos.Live.running;
        boolean paused = CopiaFotos.paused(a);
        int acc = CopiaFotos.access(a);
        long now = System.currentTimeMillis();
        if (on && acc > 0 && now - countsAt > (running ? 20000 : 15000)) {
            countsAt = now;
            new Thread(new Runnable() { @Override public void run() {
                try {
                    counts = CopiaFotos.counts(a);
                } catch (Exception ignored) { }
            } }).start();
        }
        long[] n = counts;
        String status = p.getString(CopiaFotos.K_STATUS, "");
        String last = p.getString(CopiaFotos.K_LAST, null);

        // Resumen
        vPhotos.setText(n == null || !on ? "—" : String.valueOf(n[0]));
        vVideos.setText(n == null || !on ? "—" : String.valueOf(n[1]));
        vLeft.setText(n == null || !on ? "—" : n[2] < 0 ? Tr.t("sin conexión") : n[2] + (n[2] > 0 ? " · " + Descargas.size(n[3]) : ""));
        vLeft.setTextColor(n != null && n[2] > 0 ? ORANGE : GREY);
        vDone.setText(String.valueOf(p.getLong(CopiaFotos.K_TOTAL, 0)));
        vLast.setText(last == null ? "—" : last);

        boolean free = a.batteryFree();
        vBattery.setText(free ? Tr.t("Listo ✓") : Tr.t("Activar  ›"));
        vBattery.setTextColor(free ? GREEN : ORANGE);
        vBatteryHint.setText(free ? Tr.t("Android deja a DrivePanel copiar de noche y con la pantalla apagada.")
                : Tr.t("Ahora Android puede pararla de noche. Tócalo y pulsa «Permitir»."));

        // Estado grande
        liveBox.setVisibility(running ? View.VISIBLE : View.GONE);
        runButtons.setVisibility(running ? View.VISIBLE : View.GONE);
        main.setVisibility(running ? View.GONE : View.VISIBLE);
        statusLine.setVisibility(View.GONE);
        main.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { start(); } });

        if (!on) {
            ring.set(0, BLUE, "☁", false);
            head.setText(Tr.t("La copia está desactivada"));
            sub.setText(Tr.t("Actívala y tus fotos y vídeos se subirán solos a DrivePanel, como en Google Fotos."));
            main.setText(Tr.t("Activar la copia"));
            main.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { a.askWhichPhotos(); } });
        } else if (acc == 0) {
            ring.set(0, RED, "!", false);
            head.setText(Tr.t("Falta el permiso de fotos y vídeos"));
            sub.setText(Tr.t("Sin él, la app no puede ver lo que hay en el móvil."));
            main.setText(Tr.t("Dar permiso"));
        } else if (running) {
            int pct = CopiaFotos.Live.percent();
            ring.set(pct, BLUE, pct + " %", true);
            head.setText(Tr.t("Copiando ") + CopiaFotos.Live.index + Tr.t(" de ") + CopiaFotos.Live.count);
            sub.setText(Tr.t("Puedes cerrar la app: sigue copiando y verás el aviso arriba."));
            fileName.setText(CopiaFotos.Live.name);
            stats.setText(CopiaFotos.stats());
            float frac = CopiaFotos.Live.totalBytes <= 0 ? 0 : (float) CopiaFotos.Live.sent() / CopiaFotos.Live.totalBytes;
            int seq = CopiaFotos.Live.seq;
            if (seen < 0 || seq < seen || seq - seen > 1) {
                graph.reset();
                for (double v : CopiaFotos.Live.history()) graph.add(v, frac);
            } else if (seq > seen) {
                double[] h = CopiaFotos.Live.history();
                if (h.length > 0) graph.add(h[h.length - 1], frac);
            }
            seen = seq;
        } else if (paused) {
            ring.set(progressDone(n), ORANGE, "❚❚", false);
            head.setText(Tr.t("En pausa"));
            sub.setText(n != null && n[2] > 0 ? n[2] + Tr.t(" fotos y vídeos esperando") : Tr.t("Pulsa Reanudar para seguir"));
            main.setText(Tr.t("Reanudar"));
        } else if (CopiaServicio.active) {
            ring.set(progressDone(n), BLUE, "↻", false);
            head.setText(Tr.t("Preparando…"));
            sub.setText(status);
            main.setVisibility(View.GONE);
        } else if (n != null && n[2] > 0) {
            ring.set(progressDone(n), ORANGE, "↑", false);
            head.setText(n[2] + Tr.t(" por copiar"));
            sub.setText(Descargas.size(n[3]) + (sWifi.isChecked() ? Tr.t(" · se copiarán con wifi") : ""));
            main.setText(Tr.t("Copiar ahora"));
            if (status != null && !status.isEmpty() && !status.startsWith(Tr.t("Todo copiado"))) {
                statusLine.setText(status);
                statusLine.setVisibility(View.VISIBLE);
            }
        } else if (n != null && n[2] < 0) {
            ring.set(0, RED, "!", false);
            head.setText(Tr.t("No se puede conectar con DrivePanel"));
            sub.setText(Tr.t("Revisa la conexión. La copia seguirá sola cuando vuelva."));
            main.setText(Tr.t("Reintentar"));
        } else if (n != null) {
            ring.set(100, GREEN, "✓", false);
            head.setText(Tr.t("Copia completada"));
            sub.setText(acc == 1 ? Tr.t("Ojo: solo tiene permiso para algunas fotos o sin vídeos")
                    : Tr.t("Todas las fotos y vídeos del móvil están en DrivePanel"));
            main.setText(acc == 1 ? Tr.t("Dar permiso para todo") : Tr.t("Comprobar ahora"));
        } else {
            ring.set(0, BLUE, "…", false);
            head.setText(Tr.t("Mirando el móvil…"));
            sub.setText("");
            main.setVisibility(View.GONE);
        }
    }

    private int progressDone(long[] n) {
        if (n == null) return 0;
        long all = n[0] + n[1];
        return all <= 0 ? 0 : (int) Math.max(0, Math.min(100, (all - n[2]) * 100 / all));
    }

    static String when() {
        return new SimpleDateFormat("d/M HH:mm", new Locale("es", "ES")).format(new Date());
    }

    // ------------------------------------------------------------------ Anillo

    /** Anillo de progreso con un simbolo o el % en el centro. */
    static final class Anillo extends View {
        private final Paint track = new Paint(Paint.ANTI_ALIAS_FLAG), arc = new Paint(Paint.ANTI_ALIAS_FLAG),
                text = new Paint(Paint.ANTI_ALIAS_FLAG), disc = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF r = new RectF();
        private int pct, color = BLUE;
        private String label = "";
        private boolean small;

        Anillo(Context c) {
            super(c);
            float d = c.getResources().getDisplayMetrics().density;
            track.setStyle(Paint.Style.STROKE);
            track.setStrokeWidth(10 * d);
            track.setColor(0xFFE8EAED);
            arc.setStyle(Paint.Style.STROKE);
            arc.setStrokeWidth(10 * d);
            arc.setStrokeCap(Paint.Cap.ROUND);
            text.setTextAlign(Paint.Align.CENTER);
            text.setTypeface(Typeface.DEFAULT_BOLD);
        }

        void set(int pct, int color, String label, boolean small) {
            if (this.pct == pct && this.color == color && label.equals(this.label) && this.small == small) return;
            this.pct = pct;
            this.color = color;
            this.label = label;
            this.small = small;
            invalidate();
        }

        @Override protected void onDraw(Canvas c) {
            float w = getWidth(), h = getHeight(), s = Math.min(w, h), pad = track.getStrokeWidth();
            r.set((w - s) / 2 + pad, (h - s) / 2 + pad, (w + s) / 2 - pad, (h + s) / 2 - pad);
            c.drawArc(r, 0, 360, false, track);
            arc.setColor(color);
            if (pct > 0) c.drawArc(r, -90, 360f * pct / 100, false, arc);
            disc.setColor((color & 0x00FFFFFF) | 0x1A000000);
            c.drawCircle(w / 2, h / 2, s / 2 - pad * 2.2f, disc);
            text.setColor(color);
            text.setTextSize(small ? s * 0.2f : s * 0.32f);
            Paint.FontMetrics fm = text.getFontMetrics();
            c.drawText(label, w / 2, h / 2 - (fm.ascent + fm.descent) / 2, text);
        }
    }
}
