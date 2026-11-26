package io.github.pctecnikk.drivepanel;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.MimeTypeMap;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * DrivePanel para Android: una ventana (WebView) que abre el DrivePanel de cada persona.
 * La primera vez pide la direccion del servidor y la guarda. Se puede cambiar despues
 * con el boton Atras (en la pantalla principal) o manteniendo pulsado el icono de la app.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "drivepanel";
    private static final String KEY_URL = "server_url";
    private static final String ACTION_CHANGE_SERVER = "io.github.pctecnikk.drivepanel.CHANGE_SERVER";
    private static final String ACTION_NOVEDADES = "io.github.pctecnikk.drivepanel.NOVEDADES";
    static final String ACTION_COPIA = "io.github.pctecnikk.drivepanel.COPIA";
    private static final int REQ_FILES = 1;
    private static final int REQ_STORAGE = 2;
    private static final int REQ_FOLDER = 3;
    private static final int REQ_MEDIA = 4;
    private static final int REQ_NOTIF = 5;
    private static final int BLUE = 0xFF1A73E8;

    private SharedPreferences prefs;
    private FrameLayout root;
    // video a pantalla completa (el boton de pantalla completa del reproductor de la web)
    private View fullView;
    private WebChromeClient.CustomViewCallback fullCallback;
    private WebView web;
    private ProgressBar progress;
    private ValueCallback<Uri[]> fileCallback;
    private volatile boolean nextIsFolder;
    private Descargas descargas;
    private Compartir pendingShare;          // compartido antes de tener servidor
    private volatile Compartir activeShare;  // el que la web esta subiendo
    private String activeShareFolder;
    private boolean shareInjected;
    private static final String KEY_START = "start_view";
    private static final String KEY_SHARE_FOLDER = "share_folder";
    private PendingDownload pendingDownload;
    private boolean errorShown;

    private static class PendingDownload {
        String url, userAgent, disposition, mime;
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        Tr.init(this);
        CopiaFotos.ensureScheduled(this);
        AvisoDisco.ensureScheduled(this);
        root = new FrameLayout(this);
        root.setBackgroundColor(0xFFF8FAFD);
        setContentView(root);
        descargas = new Descargas(this, prefs, new Descargas.Enqueuer() {
            @Override public long enqueue(Descargas.Item it) { return enqueueDownload(it); }
        });

        String url = prefs.getString(KEY_URL, null);
        if (url == null || isChangeServer(getIntent())) {
            showSetup(url, null);
        } else {
            showWeb(url, state);
        }
        if (state == null) Novedades.showIfUpdated(this, prefs, url == null);
        if (getIntent() != null && ACTION_NOVEDADES.equals(getIntent().getAction())) Novedades.show(this, prefs, null);
        if (state == null && getIntent() != null && ACTION_COPIA.equals(getIntent().getAction())) showCopia();
        if (state == null && Compartir.isShare(getIntent())) handleShare(getIntent());
        if (state == null && isAppLink(getIntent())) handleAppLink(getIntent());
    }

    private static boolean isChangeServer(Intent i) {
        return i != null && ACTION_CHANGE_SERVER.equals(i.getAction());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (isChangeServer(intent)) showSetup(prefs.getString(KEY_URL, null), null);
        else if (ACTION_NOVEDADES.equals(intent.getAction())) Novedades.show(this, prefs, null);
        else if (ACTION_COPIA.equals(intent.getAction())) showCopia();
        else if (Compartir.isShare(intent)) handleShare(intent);
        else if (isAppLink(intent)) handleAppLink(intent);
    }

    // ------------------------------------------------------------------ Enlaces "Abrir en la app"

    /** drivepanel://open?url=...&name=... (lo usa el boton "Abrir en la app DrivePanel" de la web). */
    private static boolean isAppLink(Intent i) {
        return i != null && Intent.ACTION_VIEW.equals(i.getAction()) && i.getData() != null
                && "drivepanel".equals(i.getData().getScheme());
    }

    private void handleAppLink(Intent intent) {
        Uri d = intent.getData();
        String url = d.getQueryParameter("url");
        String name = d.getQueryParameter("name");
        if (url == null || !url.matches("(?i)^https?://.+")) {
            toast(Tr.t("Enlace no válido"));
            return;
        }
        Uri u = Uri.parse(url);
        String saved = prefs.getString(KEY_URL, null);
        String origin = u.getScheme() + "://" + u.getEncodedAuthority();
        if (saved == null) {
            // Primera vez y sin servidor: se usa el de este enlace
            prefs.edit().putString(KEY_URL, origin).apply();
            saved = origin;
        }
        if (web == null) showWeb(saved, null);
        String path = u.getPath() == null ? "" : u.getPath();
        boolean isDownload = path.startsWith("/s/") || path.startsWith("/api/zip")
                || (path.startsWith("/api/file") && "1".equals(u.getQueryParameter("download")));
        if (!isDownload) {
            web.loadUrl(url);
            return;
        }
        if (path.startsWith("/s/") && u.getQueryParameter("dl") == null) url = url + (url.contains("?") ? "&" : "?") + "dl=1";
        PendingDownload p = new PendingDownload();
        p.url = url;
        p.userAgent = web.getSettings().getUserAgentString();
        p.disposition = name != null && !name.isEmpty() ? "attachment; filename*=UTF-8''" + Uri.encode(name) : null;
        startDownload(p);
    }

    // ------------------------------------------------------------------ Compartir con DrivePanel

    private void handleShare(Intent intent) {
        Compartir c = Compartir.from(intent, getContentResolver());
        if (c == null) {
            toast(Tr.t("Solo se pueden compartir fotos y archivos con DrivePanel"));
            return;
        }
        String url = prefs.getString(KEY_URL, null);
        if (url == null) {
            pendingShare = c;
            toast(Tr.t("Primero conecta con tu servidor DrivePanel; luego se suben los archivos"));
            return;
        }
        if (web == null) showWeb(url, null);
        askShareFolder(c);
    }

    private void askShareFolder(final Compartir c) {
        int n = c.files.size();
        long total = c.totalSize();
        final EditText folder = new EditText(this);
        folder.setSingleLine(true);
        folder.setText(prefs.getString(KEY_SHARE_FOLDER, Tr.t("Del móvil")));
        folder.setSelectAllOnFocus(true);
        folder.setHint(Tr.t("Vacío = Mi unidad"));
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(22), dp(4), dp(22), 0);
        TextView t = new TextView(this);
        t.setText((n == 1 ? Tr.t("1 archivo") : n + Tr.t(" archivos")) + (total > 0 ? " (" + Descargas.size(total) + ")" : "")
                + Tr.t(".\n\nCarpeta de DrivePanel donde se guardan (se crea si no existe; vacío = Mi unidad). ")
                + Tr.t("Para una subcarpeta usa /, por ejemplo Fotos/Viaje."));
        t.setTextSize(14);
        box.addView(t);
        box.addView(folder);
        new AlertDialog.Builder(this)
                .setTitle(Tr.t("Subir a DrivePanel"))
                .setView(box)
                .setPositiveButton(Tr.t("Subir"), new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) {
                    String f = folder.getText().toString().trim().replace('\\', '/');
                    while (f.startsWith("/")) f = f.substring(1);
                    while (f.endsWith("/")) f = f.substring(0, f.length() - 1);
                    prefs.edit().putString(KEY_SHARE_FOLDER, f).apply();
                    startShareUpload(c, f);
                } })
                .setNegativeButton(Tr.t("Cancelar"), null)
                .show();
    }

    private void startShareUpload(Compartir c, String folder) {
        activeShare = c;
        activeShareFolder = folder;
        shareInjected = false;
        if (web != null && web.getProgress() >= 100) injectShare();
        // si no, se hace en onPageFinished
    }

    private void injectShare() {
        if (web == null || activeShare == null || shareInjected) return;
        shareInjected = true;
        web.evaluateJavascript(activeShare.js(activeShareFolder), null);
    }

    // ------------------------------------------------------------------ Pantalla del servidor

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private void showSetup(String current, String message) {
        if (web != null) {
            root.removeAllViews();
            web.destroy();
            web = null;
        }
        root.removeAllViews();

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER_HORIZONTAL);
        box.setPadding(dp(28), dp(48), dp(28), dp(28));
        scroll.addView(box);

        android.widget.ImageView logo = new android.widget.ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher);
        box.addView(logo, new LinearLayout.LayoutParams(dp(88), dp(88)));

        TextView title = new TextView(this);
        title.setText("DrivePanel");
        title.setTextSize(26);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextColor(0xFF1F1F1F);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(12), 0, dp(4));
        box.addView(title);

        TextView info = new TextView(this);
        info.setText(Tr.t("Escribe la dirección de tu DrivePanel, la misma que pones en el navegador.\n\n")
                + Tr.t("• En casa (con la wifi de casa): la IP de tu servidor y el puerto 8090, ")
                + Tr.t("por ejemplo 192.168.1.x:8090\n\n")
                + Tr.t("• Fuera de casa (datos móviles u otra wifi): la IP de casa no funciona. ")
                + Tr.t("Pon tu dirección pública si la tienes, por ejemplo https://nube.midominio.com"));
        info.setTextSize(15);
        info.setTextColor(0xFF444746);
        info.setGravity(Gravity.START);
        info.setPadding(0, 0, 0, dp(20));
        box.addView(info);

        TextView need = new TextView(this);
        need.setText(Tr.t("Importante: esta app necesita tu propio servidor DrivePanel ya instalado ")
                + Tr.t("(en una Raspberry Pi o un ordenador con Linux y Docker). Sin servidor no funciona.\n")
                + Tr.t("¿Aún no lo tienes? Toca aquí para ver cómo instalarlo."));
        need.setTextSize(14);
        need.setTextColor(0xFF7A4F01);
        need.setPadding(dp(14), dp(12), dp(14), dp(12));
        android.graphics.drawable.GradientDrawable nbg = new android.graphics.drawable.GradientDrawable();
        nbg.setColor(0xFFFEF7E0);
        nbg.setCornerRadius(dp(10));
        need.setBackground(nbg);
        need.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            Novedades.open(MainActivity.this, "https://github.com/pctecnikk/drivepanel#2-instalar");
        } });
        LinearLayout.LayoutParams nlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        nlp.setMargins(0, 0, 0, dp(18));
        box.addView(need, nlp);

        final EditText input = new EditText(this);
        input.setHint(Tr.t("Dirección del servidor"));
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setImeOptions(EditorInfo.IME_ACTION_GO);
        if (current != null) input.setText(current);
        box.addView(input, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        final TextView status = new TextView(this);
        status.setTextSize(14);
        status.setTextColor(0xFFB3261E);
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, dp(10), 0, dp(10));
        if (message != null) status.setText(message);
        box.addView(status);

        final Button connect = new Button(this);
        connect.setText(Tr.t("Conectar"));
        connect.setTextColor(Color.WHITE);
        connect.setBackgroundColor(BLUE);
        box.addView(connect, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));

        final Runnable go = new Runnable() {
            @Override public void run() {
                final String url = normalize(input.getText().toString());
                if (url == null) {
                    status.setText(Tr.t("Escribe una dirección válida."));
                    return;
                }
                connect.setEnabled(false);
                status.setTextColor(0xFF444746);
                status.setText(Tr.t("Comprobando ") + url + " …");
                checkServer(url, new CheckResult() {
                    @Override public void done(boolean ok, String error, String finalUrl) {
                        connect.setEnabled(true);
                        if (ok) {
                            saveAndOpen(finalUrl);
                            return;
                        }
                        status.setTextColor(0xFFB3261E);
                        status.setText(error);
                        new AlertDialog.Builder(MainActivity.this)
                                .setTitle(Tr.t("No se ha podido comprobar"))
                                .setMessage(error + Tr.t("\n\n¿Quieres usar esta dirección de todas formas?"))
                                .setPositiveButton(Tr.t("Usarla"), new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) { saveAndOpen(finalUrl); } })
                                .setNegativeButton(Tr.t("Corregir"), null)
                                .show();
                    }
                });
            }
        };
        connect.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { go.run(); } });
        input.setOnEditorActionListener(new TextView.OnEditorActionListener() { @Override public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
            if (actionId == EditorInfo.IME_ACTION_GO
                    || (event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER && event.getAction() == KeyEvent.ACTION_DOWN)) {
                go.run();
                return true;
            }
            return false;
        } });

        TextView help = new TextView(this);
        help.setText(Tr.t("\nPuedes cambiar la dirección más tarde: mantén pulsado el icono ")
                + Tr.t("de DrivePanel y elige «Cambiar servidor», o pulsa Atrás en la pantalla principal."));
        help.setTextSize(13);
        help.setTextColor(0xFF5F6368);
        help.setGravity(Gravity.CENTER);
        box.addView(help);

        TextView ver = new TextView(this);
        ver.setText(Tr.t("\nVersión ") + Novedades.version(this) + Tr.t(" · Ver novedades"));
        ver.setTextSize(13);
        ver.setTextColor(BLUE);
        ver.setGravity(Gravity.CENTER);
        ver.setPadding(0, dp(8), 0, dp(8));
        ver.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { Novedades.show(MainActivity.this, prefs, null); } });
        box.addView(ver);

        root.addView(scroll);
        if (descargas != null) descargas.attach(root);
    }

    /** Convierte lo que escribe la persona en una direccion completa, o null si no vale. */
    static String normalize(String s) {
        if (s == null) return null;
        s = s.trim();
        if (s.isEmpty()) return null;
        if (!s.matches("(?i)^https?://.*")) {
            // Un dominio de internet sin puerto (drive.midominio.com) va por https;
            // una IP de casa, un nombre local o algo con puerto (192.168.1.50:8090), por http.
            String h = s.split("[/:]", 2)[0].toLowerCase(Locale.ROOT);
            boolean isWeb = h.matches("[a-z0-9.-]*[a-z][a-z0-9-]*\\.[a-z]{2,}") && !h.endsWith(".local")
                    && !h.endsWith(".lan") && !h.endsWith(".home") && !s.matches("^[^/]*:\\d+.*");
            s = (isWeb ? "https://" : "http://") + s;
        }
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        Uri u = Uri.parse(s);
        if (u.getHost() == null || u.getHost().isEmpty() || s.contains(" ")) return null;
        return s;
    }

    private interface CheckResult { void done(boolean ok, String error, String finalUrl); }

    /** Pide /static/manifest.webmanifest para comprobar que al otro lado hay un DrivePanel. */
    private void checkServer(final String typed, final CheckResult cb) {
        final Handler main = new Handler(Looper.getMainLooper());
        new Thread(new Runnable() { @Override public void run() {
            boolean ok = false;
            String error;
            String base = typed;
            HttpURLConnection c = null;
            try {
                // Si la direccion redirige (por ejemplo http -> https detras de Pangolin), se sigue
                // y se guarda la direccion final: la copia de fotos no puede seguir redirecciones.
                int code = 0;
                for (int hop = 0; hop < 4; hop++) {
                    if (c != null) c.disconnect();
                    c = (HttpURLConnection) new URL(base + "/static/manifest.webmanifest").openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(8000);
                    c.setReadTimeout(8000);
                    code = c.getResponseCode();
                    String moved = code >= 300 && code < 400 ? redirectedBase(base, c.getHeaderField("Location")) : null;
                    if (moved == null) break;
                    base = moved;
                }
                if (code == 200) {
                    InputStream in = c.getInputStream();
                    byte[] buf = new byte[4096];
                    int n = in.read(buf);
                    String body = n > 0 ? new String(buf, 0, n, "UTF-8") : "";
                    in.close();
                    ok = body.contains("DrivePanel");
                    error = ok ? null : Tr.t("Esa dirección responde, pero no parece un DrivePanel.");
                } else {
                    error = Tr.t("El servidor ha respondido con un error (") + code + ").";
                }
            } catch (javax.net.ssl.SSLException e) {
                error = Tr.t("Problema con el certificado https del servidor.");
            } catch (java.net.UnknownHostException e) {
                error = Tr.t("No se encuentra esa dirección. Revisa que esté bien escrita.");
            } catch (java.net.SocketTimeoutException e) {
                error = Tr.t("El servidor no contesta. Si has puesto la IP de casa, comprueba que estás conectado a la wifi de casa.");
            } catch (Exception e) {
                error = Tr.t("No se puede conectar. Si has puesto la IP de casa, comprueba que estás conectado a la wifi de casa.");
            } finally {
                if (c != null) c.disconnect();
            }
            final boolean fOk = ok;
            final String fErr = error;
            final String fBase = base;
            main.post(new Runnable() { @Override public void run() { cb.done(fOk, fErr, fBase); } });
        } }).start();
    }

    /**
     * Si una peticion a base + "/static/..." redirige a la misma ruta en otra direccion
     * (http -> https, otro puerto...), devuelve la nueva base. Si no, null.
     */
    static String redirectedBase(String base, String location) {
        if (location == null || location.isEmpty()) return null;
        try {
            URL to = new URL(new URL(base + "/"), location);
            String p = to.getPath() == null ? "" : to.getPath();
            int k = p.indexOf("/static/");
            String prefix = k >= 0 ? p.substring(0, k) : Uri.parse(base).getPath();
            if (prefix == null) prefix = "";
            String nb = to.getProtocol() + "://" + to.getAuthority() + prefix;
            while (nb.endsWith("/")) nb = nb.substring(0, nb.length() - 1);
            return nb.equalsIgnoreCase(base) ? null : nb;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Si la direccion guardada es http:// pero el servidor ha llevado la web a https:// en el
     * mismo dominio (Pangolin, proxy...), se guarda la https para que la copia de fotos y el
     * aviso de disco suban alli (no pueden seguir esa redireccion).
     */
    private void upgradeToHttps(String pageUrl) {
        try {
            String base = prefs.getString(KEY_URL, null);
            if (base == null || pageUrl == null || !base.toLowerCase(Locale.ROOT).startsWith("http://")) return;
            Uri b = Uri.parse(base), p = Uri.parse(pageUrl);
            if (!"https".equalsIgnoreCase(p.getScheme()) || b.getHost() == null || !b.getHost().equalsIgnoreCase(p.getHost())) return;
            String nb = "https://" + p.getEncodedAuthority() + (b.getEncodedPath() == null ? "" : b.getEncodedPath());
            while (nb.endsWith("/")) nb = nb.substring(0, nb.length() - 1);
            prefs.edit().putString(KEY_URL, nb).apply();
        } catch (Exception ignored) { }
    }

    private void saveAndOpen(String url) {
        prefs.edit().putString(KEY_URL, url).apply();
        showWeb(url, null);
        if (pendingShare != null) {
            Compartir c = pendingShare;
            pendingShare = null;
            askShareFolder(c);
        }
    }

    // ------------------------------------------------------------------ La web

    private void showWeb(final String base, Bundle state) {
        root.removeAllViews();
        errorShown = false;
        web = new WebView(this);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(progress, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));
        descargas.attach(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setUserAgentString(s.getUserAgentString() +  " DrivePanelAndroid/" + Novedades.version(this));

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        final String host = Uri.parse(base).getHost();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Compartir c = activeShare;
                if (c != null && req.getUrl().getPath() != null && req.getUrl().getPath().startsWith(Compartir.PATH)) {
                    return c.serve(getContentResolver(), req.getUrl());
                }
                return null;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String scheme = u.getScheme();
                if (("http".equals(scheme) || "https".equals(scheme)) && host != null && host.equalsIgnoreCase(u.getHost())) {
                    return false; // Dentro del propio DrivePanel
                }
                // Enlaces de fuera (otras webs, mailto:, etc.): se abren con la app que toque
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (ActivityNotFoundException e) {
                    toast(Tr.t("No hay ninguna app para abrir este enlace"));
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) showConnectionError(base);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                CookieManager.getInstance().flush();
                upgradeToHttps(url);
                saveCookie(url);
                view.evaluateJavascript(Carpeta.JS, null);
                view.evaluateJavascript(versionJs(), null);
                injectShare();
                view.evaluateJavascript(homeJs(), null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                progress.setProgress(p);
                progress.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback cb) {
                if (fullView != null) { cb.onCustomViewHidden(); return; }
                fullView = view;
                fullCallback = cb;
                view.setBackgroundColor(Color.BLACK);
                root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                if (nextIsFolder) {
                    nextIsFolder = false;
                    try {
                        startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), REQ_FOLDER);
                        toast(Tr.t("Elige la carpeta y toca «Usar esta carpeta»"));
                        return true;
                    } catch (ActivityNotFoundException e) {
                        toast(Tr.t("Este móvil no deja elegir carpetas; elige los archivos"));
                    }
                }
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String[] types = params.getAcceptTypes();
                String type = "*/*";
                if (types != null && types.length > 0 && types[0] != null && !types[0].isEmpty()) {
                    type = types[0].contains("/") ? types[0] : "*/*";
                }
                i.setType(type);
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                try {
                    startActivityForResult(Intent.createChooser(i, Tr.t("Elegir archivos")), REQ_FILES);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    toast(Tr.t("No hay ninguna app para elegir archivos"));
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(this), "DPAndroid");

        web.setDownloadListener(new android.webkit.DownloadListener() { @Override public void onDownloadStart(String url, String userAgent, String disposition, String mime, long length) {
            PendingDownload d = new PendingDownload();
            d.url = url;
            d.userAgent = userAgent;
            d.disposition = disposition;
            d.mime = mime;
            startDownload(d);
        } });

        if (state == null) Toast.makeText(this, Tr.t("DrivePanel · App Android ") + Novedades.version(this), Toast.LENGTH_SHORT).show();
        Novedades.check(this, prefs, false);
        if (state != null && web.restoreState(state) != null) return;
        // La web 1.0.2 o mas nueva ya abre la pantalla de inicio elegida; con una mas antigua
        // la pone la app (ver homeJs).
        web.loadUrl(base + "/");
    }

    /** Pantalla al abrir la app: "panel" (Panel de actividad) o "drive" (Mi unidad). */
    private String startView() {
        return "drive".equals(prefs.getString(KEY_START, "panel")) ? "drive" : "panel";
    }

    /** Pantalla de inicio: la web nueva la guarda en dp-home; en una antigua se va con el #. */
    private String homeJs() {
        String v = startView();
        return "(function(){try{if(!localStorage.getItem('dp-home'))localStorage.setItem('dp-home','" + v + "');}catch(e){}"
                + "if(window.__dpHome)return;window.__dpHome=1;"
                + "if(typeof homeView!=='function'&&!location.hash.replace('#','').replace('/',''))location.hash='#/" + v + "';})();";
    }

    private void chooseStartView() {
        final String[] keys = {"panel", "drive"};
        int cur = "drive".equals(startView()) ? 1 : 0;
        new AlertDialog.Builder(this)
                .setTitle(Tr.t("Al abrir la app, mostrar"))
                .setSingleChoiceItems(new CharSequence[]{Tr.t("Panel de actividad"), Tr.t("Mi unidad")}, cur, new android.content.DialogInterface.OnClickListener() {
                    @Override public void onClick(android.content.DialogInterface d, int which) {
                        prefs.edit().putString(KEY_START, keys[which]).apply();
                        if (web != null) web.evaluateJavascript("try{localStorage.setItem('dp-home','" + keys[which] + "')}catch(e){}", null);
                        d.dismiss();
                        toast(Tr.t("Al abrir la app verás: ") + (which == 0 ? Tr.t("Panel de actividad") : Tr.t("Mi unidad")));
                    }
                })
                .setNegativeButton(Tr.t("Cancelar"), null)
                .show();
    }

    private void showConnectionError(final String base) {
        if (errorShown || isFinishing()) return;
        errorShown = true;
        new AlertDialog.Builder(this)
                .setTitle(Tr.t("No se puede conectar"))
                .setMessage(Tr.t("No se ha podido abrir ") + base + Tr.t(".\n\nComprueba que el servidor está encendido. Si usas la IP de casa (192.168...), solo funciona conectado a la wifi de casa; fuera de casa pon tu dirección pública."))
                .setCancelable(false)
                .setPositiveButton(Tr.t("Reintentar"), new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) {
                    errorShown = false;
                    if (web != null) web.loadUrl(base + "/");
                } })
                .setNegativeButton(Tr.t("Cambiar servidor"), new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) { showSetup(base, null); } })
                .show();
    }

    // ------------------------------------------------------------------ Descargas

    private void startDownload(PendingDownload d) {
        if (Build.VERSION.SDK_INT < 29
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            pendingDownload = d;
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
            return;
        }
        Descargas.Item it = new Descargas.Item();
        it.name = fileName(d.url, d.disposition, d.mime);
        it.url = d.url;
        it.userAgent = d.userAgent;
        it.mime = d.mime;
        long id = enqueueDownload(it);
        if (id < 0) return;
        it.id = id;
        descargas.add(it);
    }

    /** Pide la descarga al administrador de descargas de Android. Devuelve su id o -1. */
    private long enqueueDownload(Descargas.Item d) {
        try {
            String name = d.name;
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(d.url));
            String cookies = CookieManager.getInstance().getCookie(d.url);
            if (cookies != null) r.addRequestHeader("Cookie", cookies);
            if (d.userAgent != null && !d.userAgent.isEmpty()) r.addRequestHeader("User-Agent", d.userAgent);
            r.setTitle(name);
            r.setDescription("DrivePanel");
            String mime = d.mime;
            if (mime == null || mime.isEmpty() || "application/octet-stream".equals(mime)) {
                String ext = MimeTypeMap.getFileExtensionFromUrl(Uri.encode(name));
                String guess = ext == null ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase());
                if (guess != null) mime = guess;
            }
            if (mime != null && !mime.isEmpty()) r.setMimeType(mime);
            // las de una carpeta no dejan un aviso por archivo (podrian ser miles)
            r.setNotificationVisibility(d.folder ? DownloadManager.Request.VISIBILITY_VISIBLE : DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            if (d.rel != null && d.rel.contains("/")) {  // crear las subcarpetas (en Android 10+ las crea el sistema)
                try { new java.io.File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), d.rel).getParentFile().mkdirs(); } catch (Exception ignored) { }
            }
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, d.rel != null ? d.rel : name);
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            return dm.enqueue(r);
        } catch (Exception e) {
            toast(Tr.t("No se ha podido descargar: ") + e.getMessage());
            return -1;
        }
    }

    private static final Pattern FN_STAR = Pattern.compile("filename\\*\\s*=\\s*(?:UTF-8|utf-8)''([^;]+)");
    private static final Pattern FN = Pattern.compile("filename\\s*=\\s*\"?([^\";]+)\"?");

    static String fileName(String url, String disposition, String mime) {
        String name = null;
        if (disposition != null) {
            Matcher m = FN_STAR.matcher(disposition);
            if (m.find()) {
                try { name = URLDecoder.decode(m.group(1).trim().replace("+", "%2B"), "UTF-8"); } catch (Exception ignored) { }
            }
            if (name == null) {
                m = FN.matcher(disposition);
                if (m.find()) name = m.group(1).trim();
            }
        }
        if (name == null || name.isEmpty()) name = URLUtil.guessFileName(url, disposition, mime);
        name = name.replaceAll("[\\\\/:*?\"<>|\\u0000-\\u001f]", "_");
        if (name.isEmpty()) name = "descarga";
        return name;
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code == REQ_MEDIA) {
            boolean any = false;
            for (int i = 0; i < perms.length; i++) {
                if (results[i] == PackageManager.PERMISSION_GRANTED && !perms[i].endsWith("POST_NOTIFICATIONS")) any = true;
            }
            if (any) {
                prefs.edit().putBoolean(CopiaFotos.K_ON, true).apply();
                CopiaFotos.schedule(this);
                CopiaFotos.runNow(this);
                toast(Tr.t("Copia automática activada"));
            } else {
                toast(Tr.t("Sin permiso para ver tus fotos no se puede hacer la copia"));
            }
            showCopia();
            return;
        }
        if (code == REQ_STORAGE) {
            PendingDownload d = pendingDownload;
            pendingDownload = null;
            if (d != null && results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
                startDownload(d);
            } else if (d != null) {
                toast(Tr.t("Sin permiso no se puede guardar la descarga"));
            }
        }
    }

    // ------------------------------------------------------------------ Subidas

    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        if (req == REQ_FOLDER) {
            onFolderPicked(result == RESULT_OK && data != null ? data.getData() : null);
            return;
        }
        if (req != REQ_FILES) {
            super.onActivityResult(req, result, data);
            return;
        }
        if (fileCallback == null) return;
        Uri[] uris = null;
        if (result == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null && clip.getItemCount() > 0) {
                uris = new Uri[clip.getItemCount()];
                for (int i = 0; i < clip.getItemCount(); i++) uris[i] = clip.getItemAt(i).getUri();
            } else if (data.getData() != null) {
                uris = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(uris);
        fileCallback = null;
    }

    /**
     * Pone la version de la app en el menu lateral y en el menu de usuario, aunque el servidor
     * sea antiguo y no lo haga el. Si el servidor ya lo hace (#sideVersion / #menuVersion), no toca nada.
     */
    private String versionJs() {
        String v = Tr.t("App Android ") + Novedades.version(this);
        return "(function(){var v=" + org.json.JSONObject.quote(v) + ";"
                + "var st='font-size:11px;color:#80868b;text-align:center;';"
                + "var sb=document.getElementById('sidebar');"
                + "if(sb&&!document.getElementById('sideVersion')&&!document.getElementById('dpAppVer')){"
                + " var d=document.createElement('div');d.id='dpAppVer';d.style.cssText=st+'padding:10px 6px 2px';d.textContent=v;sb.appendChild(d);}"
                + "var mh=document.querySelector('#userMenu .menu-head');"
                + "if(mh&&!document.getElementById('menuVersion')&&!document.getElementById('dpAppVer2')){"
                + " var s=document.createElement('span');s.id='dpAppVer2';s.style.cssText=st+'font-size:12px';s.textContent=v;mh.appendChild(s);}"
                + "})();";
    }

    /** Lo que la web puede llamar desde JavaScript (solo avisar de que se va a elegir una carpeta). */
    public static final class Bridge {
        private final MainActivity a;
        Bridge(MainActivity a) { this.a = a; }

        @android.webkit.JavascriptInterface
        public void nextIsFolder(boolean folder) { a.nextIsFolder = folder; }

        /** Descargar una carpeta tal cual (web 1.0.11+): {name, files:[{url, rel, size}]} */
        @android.webkit.JavascriptInterface
        public void downloadFolder(final String json) {
            a.runOnUiThread(new Runnable() { @Override public void run() { a.startFolder(json); } });
        }
    }

    /** Cada archivo de la carpeta va a Descargas/<carpeta>/<subcarpetas>/<archivo>. */
    void startFolder(String json) {
        if (Build.VERSION.SDK_INT < 29
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
            toast(Tr.t("Da permiso para guardar y vuelve a tocar Descargar"));
            return;
        }
        try {
            org.json.JSONObject o = new org.json.JSONObject(json);
            org.json.JSONArray arr = o.getJSONArray("files");
            String ua = web != null ? web.getSettings().getUserAgentString() : null;
            java.util.List<Descargas.Item> files = new java.util.ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject f = arr.getJSONObject(i);
                String url = f.getString("url");
                if (!url.matches("(?i)^https?://.+")) continue;
                StringBuilder rel = new StringBuilder();
                for (String part : f.getString("rel").split("/")) {
                    String clean = part.replaceAll("[\\\\:*?\"<>|\\u0000-\\u001f]", "_").trim();
                    if (clean.isEmpty() || clean.equals(".") || clean.equals("..")) continue;
                    if (rel.length() > 0) rel.append('/');
                    rel.append(clean);
                }
                if (rel.length() == 0) continue;
                Descargas.Item it = new Descargas.Item();
                it.url = url;
                it.rel = rel.toString();
                it.name = it.rel.substring(it.rel.lastIndexOf('/') + 1);
                it.size = f.optLong("size", -1);
                it.userAgent = ua;
                it.folder = true;
                files.add(it);
            }
            if (files.isEmpty()) { toast(Tr.t("La carpeta está vacía")); return; }
            descargas.addFolder(o.optString("name", "DrivePanel"), files);
        } catch (Exception e) {
            toast(Tr.t("No se ha podido descargar: ") + e.getMessage());
        }
    }

    private void onFolderPicked(final Uri tree) {
        final ValueCallback<Uri[]> cb = fileCallback;
        fileCallback = null;
        if (cb == null) return;
        if (tree == null) {
            cb.onReceiveValue(null);
            return;
        }
        toast(Tr.t("Leyendo la carpeta…"));
        final Handler main = new Handler(Looper.getMainLooper());
        new Thread(new Runnable() { @Override public void run() {
            final Carpeta.Result r = Carpeta.list(getContentResolver(), tree);
            main.post(new Runnable() { @Override public void run() {
                if (r.uris.isEmpty() || web == null) {
                    toast(Tr.t("La carpeta «") + r.name + Tr.t("» está vacía o no se puede leer"));
                    cb.onReceiveValue(null);
                    return;
                }
                // Primero las rutas, y cuando la web las tiene, los archivos
                web.evaluateJavascript("window.__dpRel = " + r.relsJson() + ";", new ValueCallback<String>() {
                    @Override public void onReceiveValue(String ignored) {
                        cb.onReceiveValue(r.uriArray());
                    }
                });
            } });
        } }).start();
    }

    // ------------------------------------------------------------------ Copia automatica de fotos

    /** Guarda la sesion para que la copia de fotos pueda subir aunque la app este cerrada. */
    private void saveCookie(String url) {
        try {
            String base = prefs.getString(KEY_URL, null);
            if (base == null || url == null) return;
            String bh = Uri.parse(base).getHost(), uh = Uri.parse(url).getHost();
            if (bh == null || !bh.equalsIgnoreCase(uh)) return;
            String c = CookieManager.getInstance().getCookie(base);
            if (c != null && !c.equals(prefs.getString(CopiaFotos.K_COOKIE, null))) {
                prefs.edit().putString(CopiaFotos.K_COOKIE, c).apply();
            }
            // El idioma elegido en la web (cookie dp_lang) manda tambien en las pantallas de la app
            if (c != null) {
                for (String part : c.split(";")) {
                    String kv = part.trim();
                    if (kv.startsWith("dp_lang=")) Tr.set(this, kv.substring(8).trim());
                }
            }
            if (c != null && c.contains("dp_session=")) askNotifications();
        } catch (Exception ignored) { }
    }

    /** Android 13+: pide una vez permiso de notificaciones (para el aviso de disco lleno). */
    private void askNotifications() {
        if (Build.VERSION.SDK_INT < 33 || prefs.getBoolean("notif_asked", false)) return;
        if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED) return;
        prefs.edit().putBoolean("notif_asked", true).apply();
        requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_NOTIF);
    }

    private String[] mediaPermissions() {
        if (Build.VERSION.SDK_INT >= 33) {
            return new String[]{"android.permission.READ_MEDIA_IMAGES", "android.permission.READ_MEDIA_VIDEO",
                    "android.permission.POST_NOTIFICATIONS"};
        }
        return new String[]{Manifest.permission.READ_EXTERNAL_STORAGE};
    }

    private boolean hasMediaPermission() {
        String p = Build.VERSION.SDK_INT >= 33 ? "android.permission.READ_MEDIA_IMAGES" : Manifest.permission.READ_EXTERNAL_STORAGE;
        if (checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED) return true;
        // Android 14: "Permitir acceso limitado" a algunas fotos
        return Build.VERSION.SDK_INT >= 34
                && checkSelfPermission("android.permission.READ_MEDIA_VISUAL_USER_SELECTED") == PackageManager.PERMISSION_GRANTED;
    }

    private void showCopia() {
        final boolean on = prefs.getBoolean(CopiaFotos.K_ON, false);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(22), dp(6), dp(22), 0);

        TextView info = new TextView(this);
        info.setText(Tr.t("Como Google Fotos: DrivePanel sube solo las fotos y vídeos nuevos del móvil a una carpeta ")
                + Tr.t("de tu servidor, con una subcarpeta por álbum (Camera, WhatsApp Images…). Lo que ya esté subido no se repite."));
        info.setTextSize(14);
        box.addView(info);

        final android.widget.CheckBox wifi = new android.widget.CheckBox(this);
        wifi.setText(Tr.t("Solo con wifi (no gasta datos)"));
        wifi.setChecked(prefs.getBoolean(CopiaFotos.K_WIFI, true));
        box.addView(wifi);

        final android.widget.CheckBox camera = new android.widget.CheckBox(this);
        camera.setText(Tr.t("Solo fotos y vídeos de la cámara (sin WhatsApp ni capturas)"));
        camera.setChecked(prefs.getBoolean(CopiaFotos.K_CAMERA, true));
        box.addView(camera);

        TextView fl = new TextView(this);
        fl.setText(Tr.t("\nCarpeta de DrivePanel (se crea si no existe):"));
        fl.setTextSize(14);
        box.addView(fl);
        final EditText folder = new EditText(this);
        folder.setSingleLine(true);
        folder.setText(prefs.getString(CopiaFotos.K_FOLDER, Tr.t(CopiaFotos.DEFAULT_FOLDER)));
        box.addView(folder);

        // Progreso en directo (como las subidas y descargas): %, archivo, grafica, velocidad y tiempo
        final boolean dark = (getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
                == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        final LinearLayout live = new LinearLayout(this);
        live.setOrientation(LinearLayout.VERTICAL);
        live.setPadding(0, dp(14), 0, 0);
        final TextView lHead = new TextView(this);
        lHead.setTextSize(16);
        lHead.setTypeface(Typeface.DEFAULT_BOLD);
        live.addView(lHead);
        final TextView lName = new TextView(this);
        lName.setTextSize(13);
        lName.setSingleLine(true);
        lName.setEllipsize(android.text.TextUtils.TruncateAt.MIDDLE);
        lName.setTextColor(0xFF5F6368);
        live.addView(lName);
        final ProgressBar lBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        lBar.setMax(1000);
        live.addView(lBar);
        final GraficaVelocidad lGraph = new GraficaVelocidad(this, dark);
        live.addView(lGraph, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(80)));
        final TextView lStats = new TextView(this);
        lStats.setTextSize(13);
        lStats.setPadding(0, dp(4), 0, 0);
        live.addView(lStats);
        final LinearLayout lButtons = new LinearLayout(this);
        lButtons.setOrientation(LinearLayout.HORIZONTAL);
        Button lPause = new Button(this);
        lPause.setText(Tr.t("Pausar"));
        lPause.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            CopiaFotos.pause(MainActivity.this);
            toast(Tr.t("Copia en pausa"));
        } });
        Button lCancel = new Button(this);
        lCancel.setText(Tr.t("Cancelar"));
        lCancel.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            new AlertDialog.Builder(MainActivity.this)
                    .setTitle(Tr.t("¿Cancelar la copia?"))
                    .setMessage(Tr.t("Las fotos y vídeos que faltan no se copiarán. Las fotos nuevas que hagas a partir de ahora sí se seguirán copiando solas."))
                    .setPositiveButton(Tr.t("Cancelar copia"), new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) {
                        CopiaFotos.cancel(MainActivity.this);
                        toast(Tr.t("Copia cancelada"));
                    } })
                    .setNegativeButton(Tr.t("Seguir copiando"), null)
                    .show();
        } });
        LinearLayout.LayoutParams half = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        lButtons.addView(lPause, half);
        lButtons.addView(lCancel, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        live.addView(lButtons);
        box.addView(live);

        final TextView st = new TextView(this);
        String status = prefs.getString(CopiaFotos.K_STATUS, null);
        long total = prefs.getLong(CopiaFotos.K_TOTAL, 0);
        st.setText(on ? Tr.t("\nEstado: ") + (status != null ? status : Tr.t("esperando")) + Tr.t("\nCopiadas hasta ahora: ") + total
                : Tr.t("\nAhora está desactivada."));
        st.append(Tr.t("\nVersión de la app: ") + Novedades.version(this) + " (" + versionCode() + ")");
        st.setTextSize(13);
        st.setTextColor(0xFF5F6368);
        box.addView(st);

        AlertDialog.Builder b = new AlertDialog.Builder(this)
                .setTitle(Tr.t("Copia automática de fotos"))
                .setView(box)
                .setNegativeButton(Tr.t("Cerrar"), null);
        if (on) {
            b.setPositiveButton(Tr.t("Guardar"), new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) {
                saveCopia(wifi.isChecked(), camera.isChecked(), folder.getText().toString());
                CopiaFotos.schedule(MainActivity.this);
                toast(Tr.t("Guardado"));
            } });
            b.setNeutralButton(Tr.t("Desactivar"), new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) {
                prefs.edit().putBoolean(CopiaFotos.K_ON, false).apply();
                CopiaFotos.cancelAll(MainActivity.this);
                toast(Tr.t("Copia automática desactivada"));
            } });
        } else {
            b.setPositiveButton(Tr.t("Activar"), new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) {
                saveCopia(wifi.isChecked(), camera.isChecked(), folder.getText().toString());
                askWhichPhotos();
            } });
        }
        final AlertDialog dlg = b.show();
        final android.os.Handler ui = new android.os.Handler(android.os.Looper.getMainLooper());
        final int[] seen = {-1};
        final boolean[] wasRunning = {false};
        final Button[] nowRef = {null};
        ui.post(new Runnable() { @Override public void run() {
            if (!dlg.isShowing()) return;
            boolean running = CopiaFotos.Live.running;
            // Con la copia activada se ve siempre; los detalles, solo mientras copia
            live.setVisibility(prefs.getBoolean(CopiaFotos.K_ON, false) ? View.VISIBLE : View.GONE);
            int det = running ? View.VISIBLE : View.GONE;
            lName.setVisibility(det);
            lBar.setVisibility(det);
            lGraph.setVisibility(det);
            lStats.setVisibility(det);
            lButtons.setVisibility(det);
            if (!running) lHead.setText(CopiaFotos.paused(MainActivity.this) ? Tr.t("En pausa") : Tr.t("Ahora mismo no está copiando"));
            if (running) {
                long sent = CopiaFotos.Live.sent(), total = CopiaFotos.Live.totalBytes;
                float frac = total <= 0 ? 0 : (float) sent / total;
                lHead.setText(Tr.t("Copiando ") + CopiaFotos.Live.index + Tr.t(" de ") + CopiaFotos.Live.count + " · " + CopiaFotos.Live.percent() + " %");
                lName.setText(CopiaFotos.Live.name);
                lBar.setProgress((int) (frac * 1000));
                lStats.setText(CopiaFotos.stats());
                int seq = CopiaFotos.Live.seq;
                if (seen[0] < 0 || seq < seen[0] || seq - seen[0] > 1) {
                    lGraph.reset();
                    for (double v : CopiaFotos.Live.history()) lGraph.add(v, frac);
                } else if (seq > seen[0]) {
                    double[] h = CopiaFotos.Live.history();
                    if (h.length > 0) lGraph.add(h[h.length - 1], frac);
                }
                seen[0] = seq;
            } else if (wasRunning[0] || CopiaFotos.Live.halt) {
                String s2 = prefs.getString(CopiaFotos.K_STATUS, null);
                st.setText(Tr.t("\nEstado: ") + (s2 != null ? s2 : Tr.t("esperando")) + Tr.t("\nCopiadas hasta ahora: ") + prefs.getLong(CopiaFotos.K_TOTAL, 0)
                        + Tr.t("\nVersión de la app: ") + Novedades.version(MainActivity.this) + " (" + versionCode() + ")");
            }
            if (nowRef[0] != null) nowRef[0].setText(CopiaFotos.paused(MainActivity.this) ? Tr.t("Reanudar copia") : Tr.t("Copiar ahora"));
            wasRunning[0] = running;
            ui.postDelayed(this, 1000);
        } });
        if (on) {
            // "Copiar ahora" sin cerrar el dialogo de un toque accidental
            final Button now = new Button(this);
            nowRef[0] = now;
            now.setText(CopiaFotos.paused(this) ? Tr.t("Reanudar copia") : Tr.t("Copiar ahora"));
            now.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
                saveCopia(wifi.isChecked(), camera.isChecked(), folder.getText().toString());
                if (CopiaFotos.paused(MainActivity.this)) CopiaFotos.resume(MainActivity.this);
                else CopiaFotos.runNow(MainActivity.this);
                toast(Tr.t("Copiando…"));
            } });
            box.addView(now);
        }
    }

    @SuppressWarnings("deprecation")
    private int versionCode() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode; } catch (Exception e) { return 0; }
    }

    private void saveCopia(boolean wifi, boolean camera, String folder) {
        String f = folder.trim().replace('\\', '/');
        while (f.startsWith("/")) f = f.substring(1);
        while (f.endsWith("/")) f = f.substring(0, f.length() - 1);
        prefs.edit().putBoolean(CopiaFotos.K_WIFI, wifi).putBoolean(CopiaFotos.K_CAMERA, camera)
                .putString(CopiaFotos.K_FOLDER, f).apply();
    }

    private void askWhichPhotos() {
        new AlertDialog.Builder(this)
                .setTitle(Tr.t("¿Qué fotos copio?"))
                .setItems(new CharSequence[]{Tr.t("Solo las nuevas, desde ahora"), Tr.t("También todas las que ya tengo en el móvil")},
                        new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int which) {
                            long since = which == 0 ? System.currentTimeMillis() / 1000 : 0;
                            prefs.edit().putLong(CopiaFotos.K_SINCE, since).putLong(CopiaFotos.K_SINCE_ID, -1).apply();
                            if (hasMediaPermission()) {
                                prefs.edit().putBoolean(CopiaFotos.K_ON, true).apply();
                                CopiaFotos.schedule(MainActivity.this);
                                CopiaFotos.runNow(MainActivity.this);
                                toast(Tr.t("Copia automática activada"));
                                if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_STORAGE + 10);
                            } else {
                                requestPermissions(mediaPermissions(), REQ_MEDIA);
                            }
                        } })
                .setNegativeButton(Tr.t("Cancelar"), null)
                .show();
    }

    // ------------------------------------------------------------------ Atras y ciclo de vida

    private void exitFullscreen() {
        if (fullView == null) return;
        root.removeView(fullView);
        fullView = null;
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        if (fullCallback != null) fullCallback.onCustomViewHidden();
        fullCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (fullView != null) {
            exitFullscreen();
            return;
        }
        if (web == null) {
            if (prefs.getString(KEY_URL, null) != null) {
                showWeb(prefs.getString(KEY_URL, null), null);
            } else {
                super.onBackPressed();
            }
            return;
        }
        if (web.canGoBack()) {
            web.goBack();
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle("DrivePanel")
                .setItems(new CharSequence[]{Tr.t("Salir"), Tr.t("Cambiar servidor"), Tr.t("Recargar"), Tr.t("Novedades (versión ") + Novedades.version(this) + ")", Tr.t("Pantalla al abrir: ") + ("drive".equals(startView()) ? Tr.t("Mi unidad") : Tr.t("Panel de actividad")), Tr.t("Copia automática de fotos: ") + (prefs.getBoolean(CopiaFotos.K_ON, false) ? Tr.t("activada") : Tr.t("desactivada"))}, new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int which) {
                    if (which == 0) finish();
                    else if (which == 1) showSetup(prefs.getString(KEY_URL, null), null);
                    else if (which == 3) Novedades.show(MainActivity.this, prefs, null);
                    else if (which == 4) chooseStartView();
                    else if (which == 5) showCopia();
                    else if (web != null) web.reload();
                } })
                .setNegativeButton(Tr.t("Cancelar"), null)
                .show();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
        if (web != null) web.onPause();
        descargas.stop();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        descargas.start();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }
}
