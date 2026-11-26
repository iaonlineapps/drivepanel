package io.github.pctecnikk.drivepanel;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Idioma de las pantallas propias de la app (las de la web las traduce el servidor).
 * Va en el mismo idioma que la web: la web guarda la eleccion en la cookie dp_lang ("es" o "en")
 * y la app la copia a sus ajustes al cargar cada pagina. Si no hay, el idioma del movil.
 * Los textos se escriben en espanol en el codigo y aqui esta su traduccion al ingles.
 */
final class Tr {

    static final String K_LANG = "lang";
    private static volatile String lang;

    private Tr() { }

    /** Lee el idioma guardado (llamar al empezar una pantalla o un trabajo en segundo plano). */
    static void init(Context c) {
        SharedPreferences p = c.getSharedPreferences("drivepanel", Context.MODE_PRIVATE);
        String v = p.getString(K_LANG, null);
        lang = v != null ? v : deviceLang();
    }

    /** Guarda el idioma elegido en la web (cookie dp_lang). Devuelve true si ha cambiado. */
    static boolean set(Context c, String v) {
        if (!"es".equals(v) && !"en".equals(v)) return false;
        boolean changed = !v.equals(lang);
        lang = v;
        c.getSharedPreferences("drivepanel", Context.MODE_PRIVATE).edit().putString(K_LANG, v).apply();
        return changed;
    }

    static String deviceLang() {
        return "es".equals(Locale.getDefault().getLanguage()) ? "es" : "en";
    }

    static boolean en() {
        String l = lang;
        return "en".equals(l != null ? l : deviceLang());
    }

    /** El texto en el idioma actual (si falta la traduccion, en espanol). */
    static String t(String es) {
        if (!en()) return es;
        String e = EN.get(es);
        return e != null ? e : es;
    }

    private static final Map<String, String> EN = new HashMap<>();

    private static void e(String es, String en) { EN.put(es, en); }

    static {
        e("Enlace no válido", "Invalid link");
        e(" errores", " errors");
        e(" ya estaban", " already there");
        e("Carpeta «", "Folder “");
        e("Da permiso para guardar y vuelve a tocar Descargar", "Allow saving files and tap Download again");
        e("Descargando la carpeta «", "Downloading the folder “");
        e("Descargando «", "Downloading “");
        e("La carpeta está vacía", "The folder is empty");
        e("Ya hay una carpeta descargándose; espera a que termine", "A folder is already downloading; wait for it to finish");
        e("» descargada con ", "” downloaded with ");
        e("» descargada en Descargas", "” downloaded to Download");
        e("» en Descargas", "” to Download");
        e("Solo se pueden compartir fotos y archivos con DrivePanel", "Only photos and files can be shared with DrivePanel");
        e("Primero conecta con tu servidor DrivePanel; luego se suben los archivos", "First connect to your DrivePanel server; then the files will be uploaded");
        e("Del móvil", "From phone");
        e("Vacío = Mi unidad", "Empty = My Drive");
        e("1 archivo", "1 file");
        e(" archivos", " files");
        e(".\n\nCarpeta de DrivePanel donde se guardan (se crea si no existe; vacío = Mi unidad). ", ".\n\nDrivePanel folder to save them in (created if it doesn't exist; empty = My Drive). ");
        e("Para una subcarpeta usa /, por ejemplo Fotos/Viaje.", "For a subfolder use /, for example Photos/Trip.");
        e("Subir a DrivePanel", "Upload to DrivePanel");
        e("Subir", "Upload");
        e("Cancelar", "Cancel");
        e("Escribe la dirección de tu DrivePanel, la misma que pones en el navegador.\n\n", "Type the address of your DrivePanel, the same one you use in the browser.\n\n");
        e("• En casa (con la wifi de casa): la IP de tu servidor y el puerto 8090, ", "• At home (on your home wifi): your server's IP and port 8090, ");
        e("por ejemplo 192.168.1.x:8090\n\n", "for example 192.168.1.x:8090\n\n");
        e("• Fuera de casa (datos móviles u otra wifi): la IP de casa no funciona. ", "• Away from home (mobile data or another wifi): the home IP won't work. ");
        e("Pon tu dirección pública si la tienes, por ejemplo https://nube.midominio.com", "Use your public address if you have one, for example https://cloud.mydomain.com");
        e("Importante: esta app necesita tu propio servidor DrivePanel ya instalado ", "Important: this app needs your own DrivePanel server already installed ");
        e("(en una Raspberry Pi o un ordenador con Linux y Docker). Sin servidor no funciona.\n", "(on a Raspberry Pi or a Linux computer with Docker). It won't work without a server.\n");
        e("¿Aún no lo tienes? Toca aquí para ver cómo instalarlo.", "Don't have one yet? Tap here to see how to install it.");
        e("Dirección del servidor", "Server address");
        e("Conectar", "Connect");
        e("Escribe una dirección válida.", "Type a valid address.");
        e("Comprobando ", "Checking ");
        e("No se ha podido comprobar", "Couldn't check it");
        e("\n\n¿Quieres usar esta dirección de todas formas?", "\n\nDo you want to use this address anyway?");
        e("Usarla", "Use it");
        e("Corregir", "Fix it");
        e("\nPuedes cambiar la dirección más tarde: mantén pulsado el icono ", "\nYou can change the address later: press and hold the ");
        e("de DrivePanel y elige «Cambiar servidor», o pulsa Atrás en la pantalla principal.", "DrivePanel icon and choose “Change server”, or press Back on the main screen.");
        e("\nVersión ", "\nVersion ");
        e(" · Ver novedades", " · What's new");
        e("Esa dirección responde, pero no parece un DrivePanel.", "That address responds, but it doesn't look like a DrivePanel.");
        e("El servidor ha respondido con un error (", "The server responded with an error (");
        e("Problema con el certificado https del servidor.", "Problem with the server's https certificate.");
        e("No se encuentra esa dirección. Revisa que esté bien escrita.", "That address can't be found. Check that it's spelled correctly.");
        e("El servidor no contesta. Si has puesto la IP de casa, comprueba que estás conectado a la wifi de casa.", "The server isn't answering. If you used your home IP, check that you're on your home wifi.");
        e("No se puede conectar. Si has puesto la IP de casa, comprueba que estás conectado a la wifi de casa.", "Can't connect. If you used your home IP, check that you're on your home wifi.");
        e("No hay ninguna app para abrir este enlace", "There's no app to open this link");
        e("Elige la carpeta y toca «Usar esta carpeta»", "Choose the folder and tap “Use this folder”");
        e("Este móvil no deja elegir carpetas; elige los archivos", "This phone doesn't allow choosing folders; choose the files");
        e("Elegir archivos", "Choose files");
        e("No hay ninguna app para elegir archivos", "There's no app to choose files");
        e("DrivePanel · App Android ", "DrivePanel · Android app ");
        e("Al abrir la app, mostrar", "When the app opens, show");
        e("Panel de actividad", "Activity dashboard");
        e("Mi unidad", "My Drive");
        e("Al abrir la app verás: ", "When the app opens you'll see: ");
        e("No se puede conectar", "Can't connect");
        e("No se ha podido abrir ", "Couldn't open ");
        e(".\n\nComprueba que el servidor está encendido. Si usas la IP de casa (192.168...), solo funciona conectado a la wifi de casa; fuera de casa pon tu dirección pública.", ".\n\nCheck that the server is on. If you use your home IP (192.168...), it only works on your home wifi; away from home use your public address.");
        e("Reintentar", "Retry");
        e("Cambiar servidor", "Change server");
        e("No se ha podido descargar: ", "Couldn't download: ");
        e("Copia automática activada", "Automatic backup turned on");
        e("Sin permiso para ver tus fotos no se puede hacer la copia", "Without permission to see your photos the backup can't run");
        e("Sin permiso no se puede guardar la descarga", "Without permission the download can't be saved");
        e("App Android ", "Android app ");
        e("Leyendo la carpeta…", "Reading the folder…");
        e("La carpeta «", "The folder “");
        e("» está vacía o no se puede leer", "” is empty or can't be read");
        e("Como Google Fotos: DrivePanel sube solo las fotos y vídeos nuevos del móvil a una carpeta ", "Like Google Photos: DrivePanel automatically uploads new photos and videos from your phone to a folder ");
        e("de tu servidor, con una subcarpeta por álbum (Camera, WhatsApp Images…). Lo que ya esté subido no se repite.", "on your server, with a subfolder per album (Camera, WhatsApp Images…). Anything already uploaded isn't repeated.");
        e("Solo con wifi (no gasta datos)", "Only on wifi (doesn't use mobile data)");
        e("Solo fotos y vídeos de la cámara (sin WhatsApp ni capturas)", "Only camera photos and videos (no WhatsApp or screenshots)");
        e("\nCarpeta de DrivePanel (se crea si no existe):", "\nDrivePanel folder (created if it doesn't exist):");
        e("Pausar", "Pause");
        e("Copia en pausa", "Backup paused");
        e("¿Cancelar la copia?", "Cancel the backup?");
        e("Las fotos y vídeos que faltan no se copiarán. Las fotos nuevas que hagas a partir de ahora sí se seguirán copiando solas.", "The remaining photos and videos won't be copied. New photos you take from now on will still be copied automatically.");
        e("Cancelar copia", "Cancel backup");
        e("Copia cancelada", "Backup cancelled");
        e("Seguir copiando", "Keep copying");
        e("\nEstado: ", "\nStatus: ");
        e("esperando", "waiting");
        e("\nCopiadas hasta ahora: ", "\nCopied so far: ");
        e("\nAhora está desactivada.", "\nIt's turned off now.");
        e("\nVersión de la app: ", "\nApp version: ");
        e("Copia automática de fotos", "Automatic photo backup");
        e("Cerrar", "Close");
        e("Guardar", "Save");
        e("Guardado", "Saved");
        e("Desactivar", "Turn off");
        e("Copia automática desactivada", "Automatic backup turned off");
        e("Activar", "Turn on");
        e("En pausa", "Paused");
        e("Ahora mismo no está copiando", "Not copying right now");
        e("Copiando ", "Copying ");
        e(" de ", " of ");
        e("Reanudar copia", "Resume backup");
        e("Copiar ahora", "Copy now");
        e("Copiando…", "Copying…");
        e("¿Qué fotos copio?", "Which photos should I copy?");
        e("Solo las nuevas, desde ahora", "Only new ones, from now on");
        e("También todas las que ya tengo en el móvil", "Also all the ones already on my phone");
        e("Salir", "Exit");
        e("Recargar", "Reload");
        e("Novedades (versión ", "What's new (version ");
        e("Pantalla al abrir: ", "Start screen: ");
        e("Copia automática de fotos: ", "Automatic photo backup: ");
        e("activada", "on");
        e("desactivada", "off");
        e("Novedades de la versión ", "What's new in version ");
        e("Buscar actualizaciones", "Check for updates");
        e("Buscando actualizaciones…", "Checking for updates…");
        e("No se ha podido comprobar. ¿Tienes Internet?", "Couldn't check. Are you online?");
        e("Ya tienes la última versión (", "You already have the latest version (");
        e("Tienes la ", "You have ");
        e(". Ya está disponible la ", ". Version ");
        e("\n\nAl descargarla, ábrela y toca Instalar: se instala encima y no pierdes nada.", "\n\nWhen it's downloaded, open it and tap Install: it installs over this one and you lose nothing.");
        e("Hay una versión nueva", "A new version is available");
        e("Descargar", "Download");
        e("Más tarde", "Later");
        e("Saltar esta versión", "Skip this version");
        e("No hay navegador para abrir ", "There's no browser to open ");
        e("Las descargas en curso siguen; el panel se queda minimizado", "Downloads in progress continue; the panel stays minimised");
        e("Descargado: ", "Downloaded: ");
        e("Empezando…", "Starting…");
        e(" · quedan ", " · time left: ");
        e("En pausa: ", "Paused: ");
        e("Descargado · ", "Downloaded · ");
        e(" · en la carpeta Descargas", " · in the Downloads folder");
        e("Ha fallado: ", "Failed: ");
        e("Cancelada", "Cancelled");
        e("Abrir", "Open");
        e("Quitar", "Remove");
        e("No hay ninguna app para abrir este archivo. Está en la carpeta Descargas.", "There's no app to open this file. It's in the Downloads folder.");
        e("No se encuentra el archivo. Mira en la carpeta Descargas.", "The file can't be found. Look in the Downloads folder.");
        e(" % completado", " % complete");
        e(" descargados", " downloaded");
        e("Descargando: ", "Downloading: ");
        e("Velocidad: ", "Speed: ");
        e("   ·   Quedan ", "   ·   Time left: ");
        e("1 elemento restante", "1 item left");
        e(" elementos restantes", " items left");
        e("Descargando 1 archivo", "Downloading 1 file");
        e("Descargando ", "Downloading ");
        e("Descargas · 1 terminada", "Downloads · 1 finished");
        e("Descargas · ", "Downloads · ");
        e(" terminadas", " finished");
        e("esperando conexión", "waiting for connection");
        e("esperando wifi", "waiting for wifi");
        e("no queda espacio en el móvil", "no space left on the phone");
        e("se cortó y no se puede seguir; toca Reintentar", "it was interrupted and can't continue; tap Retry");
        e("se cortó la conexión; toca Reintentar", "the connection dropped; tap Retry");
        e("ya existe un archivo con ese nombre", "a file with that name already exists");
        e("no se encuentra la memoria", "storage not found");
        e("sin permiso (vuelve a entrar en DrivePanel)", "no permission (sign in to DrivePanel again)");
        e("el archivo ya no está en el servidor", "the file is no longer on the server");
        e("el servidor respondió con error ", "the server responded with error ");
        e("Fotos del móvil", "Phone photos");
        e("En pausa: pulsa Reanudar para seguir copiando", "Paused: tap Resume to continue copying");
        e("Reanudando…", "Resuming…");
        e("Cancelada: las fotos que faltaban no se copian; las nuevas, sí", "Cancelled: the remaining photos won't be copied; new ones will");
        e("Abre DrivePanel y entra con tu usuario para que pueda copiar", "Open DrivePanel and sign in so the backup can run");
        e("Todo copiado", "Everything copied");
        e(" fotos y vídeos…", " photos and videos…");
        e("En pausa (", "Paused (");
        e(" pendientes)", " left)");
        e("Tienes que volver a entrar en DrivePanel (la sesión ha caducado)", "You need to sign in to DrivePanel again (the session expired)");
        e("La copia de fotos está parada", "Photo backup has stopped");
        e("Abre DrivePanel y vuelve a entrar con tu usuario.", "Open DrivePanel and sign in again.");
        e("Error ", "Error ");
        e(" al subir ", " uploading ");
        e("; se reintentará", "; it will retry");
        e("El servidor ha cambiado de dirección; se reintentará", "The server address has changed; it will retry");
        e("Falta el permiso para ver tus fotos: abre esta pantalla, pulsa «Copiar ahora» y elige «Permitir todo»", "Permission to see your photos is missing: open this screen, tap “Copy now” and choose “Allow all”");
        e(" · se copian las fotos y vídeos nuevos desde el ", " · new photos and videos are copied since ");
        e(" · Ojo: solo tiene permiso para algunas fotos; pulsa «Copiar ahora» y elige «Permitir todo»", " · Note: it can only see some photos; tap “Copy now” and choose “Allow all”");
        e("Esperando el permiso para ver tus fotos…", "Waiting for permission to see your photos…");
        e("Copiar también las que ya tenía", "Also copy the ones I already had");
        e("¿Copiar también las fotos antiguas?", "Also copy older photos?");
        e("Se subirán todas las fotos y vídeos que ya tienes en el móvil. Las que ya estén en DrivePanel no se repiten. Puede tardar bastante la primera vez.", "All photos and videos already on your phone will be uploaded. Those already in DrivePanel are not repeated. The first time may take a while.");
        e("Copiar todas", "Copy all");
        e("Todo copiado · última copia ", "Everything copied · last backup ");
        e("1 foto o vídeo copiado a DrivePanel", "1 photo or video copied to DrivePanel");
        e(" fotos y vídeos copiados a DrivePanel", " photos and videos copied to DrivePanel");
        e("Carpeta: ", "Folder: ");
        e("Copia de fotos", "Photo backup");
        e("Progreso de la copia automática de fotos y vídeos", "Progress of the automatic photo and video backup");
        e("Copiando fotos: ", "Copying photos: ");
        e("Disco lleno", "Disk full");
        e("Aviso cuando el disco del servidor DrivePanel se está llenando", "Alert when the DrivePanel server disk is filling up");
        e(" archivo", " file");
        e("No se han podido leer los archivos compartidos", "Couldn't read the shared files");
    }
}
