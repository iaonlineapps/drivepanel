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
    private static final int REQ_FILES = 1;
    private static final int REQ_STORAGE = 2;
    private static final int REQ_FOLDER = 3;
    private static final int BLUE = 0xFF1A73E8;

    private SharedPreferences prefs;
    private FrameLayout root;
    private WebView web;
    private ProgressBar progress;
    private ValueCallback<Uri[]> fileCallback;
    private volatile boolean nextIsFolder;
    private Descargas descargas;
    private PendingDownload pendingDownload;
    private boolean errorShown;

    private static class PendingDownload {
        String url, userAgent, disposition, mime;
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
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
    }

    private static boolean isChangeServer(Intent i) {
        return i != null && ACTION_CHANGE_SERVER.equals(i.getAction());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (isChangeServer(intent)) showSetup(prefs.getString(KEY_URL, null), null);
        else if (ACTION_NOVEDADES.equals(intent.getAction())) Novedades.show(this, prefs, null);
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
        info.setText("Escribe la dirección de tu DrivePanel, la misma que pones en el navegador.\n\n"
                + "• En casa (con la wifi de casa): la IP de tu servidor y el puerto 8090, "
                + "por ejemplo 192.168.1.50:8090\n\n"
                + "• Fuera de casa (datos móviles u otra wifi): la IP de casa no funciona. "
                + "Pon tu dirección pública si la tienes, por ejemplo https://nube.midominio.com");
        info.setTextSize(15);
        info.setTextColor(0xFF444746);
        info.setGravity(Gravity.START);
        info.setPadding(0, 0, 0, dp(20));
        box.addView(info);

        TextView need = new TextView(this);
        need.setText("Importante: esta app necesita tu propio servidor DrivePanel ya instalado "
                + "(en una Raspberry Pi o un ordenador con Linux y Docker). Sin servidor no funciona.\n"
                + "¿Aún no lo tienes? Toca aquí para ver cómo instalarlo.");
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
        input.setHint("Dirección del servidor");
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
        connect.setText("Conectar");
        connect.setTextColor(Color.WHITE);
        connect.setBackgroundColor(BLUE);
        box.addView(connect, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));

        final Runnable go = new Runnable() {
            @Override public void run() {
                final String url = normalize(input.getText().toString());
                if (url == null) {
                    status.setText("Escribe una dirección válida.");
                    return;
                }
                connect.setEnabled(false);
                status.setTextColor(0xFF444746);
                status.setText("Comprobando " + url + " …");
                checkServer(url, new CheckResult() {
                    @Override public void done(boolean ok, String error) {
                        connect.setEnabled(true);
                        if (ok) {
                            saveAndOpen(url);
                            return;
                        }
                        status.setTextColor(0xFFB3261E);
                        status.setText(error);
                        new AlertDialog.Builder(MainActivity.this)
                                .setTitle("No se ha podido comprobar")
                                .setMessage(error + "\n\n¿Quieres usar esta dirección de todas formas?")
                                .setPositiveButton("Usarla", new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) { saveAndOpen(url); } })
                                .setNegativeButton("Corregir", null)
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
        help.setText("\nPuedes cambiar la dirección más tarde: mantén pulsado el icono "
                + "de DrivePanel y elige «Cambiar servidor», o pulsa Atrás en la pantalla principal.");
        help.setTextSize(13);
        help.setTextColor(0xFF5F6368);
        help.setGravity(Gravity.CENTER);
        box.addView(help);

        TextView ver = new TextView(this);
        ver.setText("\nVersión " + Novedades.version(this) + " · Ver novedades");
        ver.setTextSize(13);
        ver.setTextColor(BLUE);
        ver.setGravity(Gravity.CENTER);
        ver.setPadding(0, dp(8), 0, dp(8));
        ver.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { Novedades.show(MainActivity.this, prefs, null); } });
        box.addView(ver);

        root.addView(scroll);
    }

    /** Convierte lo que escribe la persona en una direccion completa, o null si no vale. */
    static String normalize(String s) {
        if (s == null) return null;
        s = s.trim();
        if (s.isEmpty()) return null;
        if (!s.matches("(?i)^https?://.*")) s = "http://" + s;
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        Uri u = Uri.parse(s);
        if (u.getHost() == null || u.getHost().isEmpty() || s.contains(" ")) return null;
        return s;
    }

    private interface CheckResult { void done(boolean ok, String error); }

    /** Pide /static/manifest.webmanifest para comprobar que al otro lado hay un DrivePanel. */
    private void checkServer(final String base, final CheckResult cb) {
        final Handler main = new Handler(Looper.getMainLooper());
        new Thread(new Runnable() { @Override public void run() {
            boolean ok = false;
            String error;
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(base + "/static/manifest.webmanifest").openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                int code = c.getResponseCode();
                if (code == 200) {
                    InputStream in = c.getInputStream();
                    byte[] buf = new byte[4096];
                    int n = in.read(buf);
                    String body = n > 0 ? new String(buf, 0, n, "UTF-8") : "";
                    in.close();
                    ok = body.contains("DrivePanel");
                    error = ok ? null : "Esa dirección responde, pero no parece un DrivePanel.";
                } else {
                    error = "El servidor ha respondido con un error (" + code + ").";
                }
            } catch (javax.net.ssl.SSLException e) {
                error = "Problema con el certificado https del servidor.";
            } catch (java.net.UnknownHostException e) {
                error = "No se encuentra esa dirección. Revisa que esté bien escrita.";
            } catch (java.net.SocketTimeoutException e) {
                error = "El servidor no contesta. Si has puesto la IP de casa, comprueba que estás conectado a la wifi de casa.";
            } catch (Exception e) {
                error = "No se puede conectar. Si has puesto la IP de casa, comprueba que estás conectado a la wifi de casa.";
            } finally {
                if (c != null) c.disconnect();
            }
            final boolean fOk = ok;
            final String fErr = error;
            main.post(new Runnable() { @Override public void run() { cb.done(fOk, fErr); } });
        } }).start();
    }

    private void saveAndOpen(String url) {
        prefs.edit().putString(KEY_URL, url).apply();
        showWeb(url, null);
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
                    toast("No hay ninguna app para abrir este enlace");
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
                view.evaluateJavascript(Carpeta.JS, null);
                view.evaluateJavascript(versionJs(), null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                progress.setProgress(p);
                progress.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                if (nextIsFolder) {
                    nextIsFolder = false;
                    try {
                        startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), REQ_FOLDER);
                        toast("Elige la carpeta y toca «Usar esta carpeta»");
                        return true;
                    } catch (ActivityNotFoundException e) {
                        toast("Este móvil no deja elegir carpetas; elige los archivos");
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
                    startActivityForResult(Intent.createChooser(i, "Elegir archivos"), REQ_FILES);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    toast("No hay ninguna app para elegir archivos");
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

        if (state == null) Toast.makeText(this, "DrivePanel · App Android " + Novedades.version(this), Toast.LENGTH_SHORT).show();
        Novedades.check(this, prefs, false);
        if (state != null && web.restoreState(state) != null) return;
        web.loadUrl(base + "/");
    }

    private void showConnectionError(final String base) {
        if (errorShown || isFinishing()) return;
        errorShown = true;
        new AlertDialog.Builder(this)
                .setTitle("No se puede conectar")
                .setMessage("No se ha podido abrir " + base + ".\n\nComprueba que el servidor está encendido. Si usas la IP de casa (192.168...), solo funciona conectado a la wifi de casa; fuera de casa pon tu dirección pública.")
                .setCancelable(false)
                .setPositiveButton("Reintentar", new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) {
                    errorShown = false;
                    if (web != null) web.loadUrl(base + "/");
                } })
                .setNegativeButton("Cambiar servidor", new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) { showSetup(base, null); } })
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
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            return dm.enqueue(r);
        } catch (Exception e) {
            toast("No se ha podido descargar: " + e.getMessage());
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
        if (code == REQ_STORAGE) {
            PendingDownload d = pendingDownload;
            pendingDownload = null;
            if (d != null && results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
                startDownload(d);
            } else if (d != null) {
                toast("Sin permiso no se puede guardar la descarga");
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
        String v = "App Android " + Novedades.version(this);
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
    }

    private void onFolderPicked(final Uri tree) {
        final ValueCallback<Uri[]> cb = fileCallback;
        fileCallback = null;
        if (cb == null) return;
        if (tree == null) {
            cb.onReceiveValue(null);
            return;
        }
        toast("Leyendo la carpeta…");
        final Handler main = new Handler(Looper.getMainLooper());
        new Thread(new Runnable() { @Override public void run() {
            final Carpeta.Result r = Carpeta.list(getContentResolver(), tree);
            main.post(new Runnable() { @Override public void run() {
                if (r.uris.isEmpty() || web == null) {
                    toast("La carpeta «" + r.name + "» está vacía o no se puede leer");
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

    // ------------------------------------------------------------------ Atras y ciclo de vida

    @Override
    public void onBackPressed() {
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
                .setItems(new CharSequence[]{"Salir", "Cambiar servidor", "Recargar", "Novedades (versión " + Novedades.version(this) + ")"}, new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int which) {
                    if (which == 0) finish();
                    else if (which == 1) showSetup(prefs.getString(KEY_URL, null), null);
                    else if (which == 3) Novedades.show(MainActivity.this, prefs, null);
                    else if (web != null) web.reload();
                } })
                .setNegativeButton("Cancelar", null)
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
