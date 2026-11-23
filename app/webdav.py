"""WebDAV por usuario: /dav/ muestra solo la carpeta del usuario autenticado.
Pensado para FolderSync, PhotoSync, el explorador de Windows, etc."""
import os, secrets, time
from a2wsgi import WSGIMiddleware
from wsgidav.wsgidav_app import WsgiDAVApp
from wsgidav.dc.base_dc import BaseDomainController
from wsgidav.dav_error import DAVError, HTTP_FORBIDDEN, HTTP_INSUFFICIENT_STORAGE
from wsgidav.fs_dav_provider import FilesystemProvider, FileResource, FolderResource

from . import db, limits, ops
from .config import STORAGE
from .fsutil import usage, invalidate, changed, user_root


def _ip(environ):
    return environ.get("REMOTE_ADDR") or "?"


class DriveDC(BaseDomainController):
    def __init__(self, wsgidav_app, config):
        super().__init__(wsgidav_app, config)

    def get_domain_realm(self, path_info, environ):
        return "DrivePanel"

    def require_authentication(self, realm, environ):
        return True

    def supports_http_digest_auth(self):
        return False

    def basic_auth_user(self, realm, user_name, password, environ):
        ip = _ip(environ)
        if limits.login_blocked(ip, user_name):
            return False
        u = db.authenticate(user_name, password)
        if not u:
            limits.login_failed(ip, user_name)
            return False
        limits.login_ok(ip, user_name)
        environ["drivepanel.user"] = dict(u)
        environ["wsgidav.auth.user_name"] = u["username"]  # nombre real (mayusculas)
        return True


def _user(environ) -> str:
    return environ.get("wsgidav.auth.user_name", "")


def _rel(dav_path: str) -> str:
    return dav_path.strip("/")


# Archivos temporales que crean Windows, macOS y Office al guardar: se borran del todo
# en vez de llenar la papelera.
def _is_junk(name: str) -> bool:
    n = name.lower()
    return n.startswith((".", "~$", "~wr")) or n.endswith((".tmp", ".crdownload", ".part")) or n in ("thumbs.db", "desktop.ini")


class _QuotaWriter:
    """Escribe en un archivo temporal y solo sustituye al de verdad al terminar bien.
    Asi una subida cortada no deja el archivo a medias ni borra el que habia, y la cuota
    se comprueba mientras llegan los datos (sirve aunque no venga Content-Length)."""

    def __init__(self, final_path, username, limit):
        self.final, self.username, self.limit = final_path, username, limit
        self.tmp = os.path.join(os.path.dirname(final_path), f".dp-upload-{secrets.token_hex(8)}")
        self.f = open(self.tmp, "wb", 1024 * 1024)
        self.written = 0
        self.failed = False

    def write(self, b):
        self.written += len(b)
        if self.limit is not None and self.written > self.limit:
            self.abort()
            raise DAVError(HTTP_INSUFFICIENT_STORAGE, "Cuota superada")
        return self.f.write(b)

    def writelines(self, chunks):
        for c in chunks:
            self.write(c)

    def abort(self):
        self.failed = True
        try:
            self.f.close()
        finally:
            try:
                os.unlink(self.tmp)
            except OSError:
                pass

    def close(self):
        if self.failed:
            return
        self.f.close()
        os.replace(self.tmp, self.final)
        invalidate(self.username)


class QFile(FileResource):
    def begin_write(self, *, content_type=None):
        st = os.stat(self._file_path)
        # vacio y recien creado: es el archivo que WsgiDAV crea antes de un PUT nuevo
        self._new = st.st_size == 0 and time.time() - st.st_mtime < 120
        u = self.environ.get("drivepanel.user") or {}
        quota = u.get("quota") or 0
        limit = None
        if quota:
            # lo que ocupa ahora el archivo se libera al sustituirlo
            current = os.path.getsize(self._file_path) if os.path.isfile(self._file_path) else 0
            limit = max(0, quota - usage(u["username"]) + current)
            length = int(self.environ.get("CONTENT_LENGTH") or 0)
            if length > limit:
                raise DAVError(HTTP_INSUFFICIENT_STORAGE, "Cuota superada")
        self._writer = _QuotaWriter(self._file_path, u.get("username", ""), limit)
        return self._writer

    def end_write(self, *, with_errors):
        w = getattr(self, "_writer", None)
        if with_errors and w and not w.failed:
            w.abort()
        # el archivo vacio que se creo para un PUT nuevo que ha fallado no se queda
        if with_errors and getattr(self, "_new", False) and os.path.isfile(self._file_path) \
                and os.path.getsize(self._file_path) == 0:
            try:
                os.unlink(self._file_path)
            except OSError:
                pass

    def handle_delete(self):
        # Borrar desde WebDAV manda a la papelera, igual que desde la web
        if _is_junk(self.name):
            return False
        ops.move_to_trash(_user(self.environ), _rel(self.path))
        self.remove_all_properties(recursive=True)
        self.remove_all_locks(recursive=True)
        return True

    def delete(self):
        super().delete()
        invalidate(_user(self.environ))

    def move_recursive(self, dest_path):
        super().move_recursive(dest_path)
        ops.fix_shares(_user(self.environ), _rel(self.path), _rel(dest_path))


class QFolder(FolderResource):
    def get_member_names(self):
        return [n for n in super().get_member_names() if not n.startswith(".")]

    def get_available_bytes(self):
        u = self.environ.get("drivepanel.user") or {}
        if u.get("quota"):
            return max(0, u["quota"] - usage(u["username"]))
        return super().get_available_bytes()

    def create_collection(self, name):
        super().create_collection(name)
        changed(_user(self.environ))

    def handle_delete(self):
        if not _rel(self.path):  # la raiz no se borra
            return False
        ops.move_to_trash(_user(self.environ), _rel(self.path))
        self.remove_all_properties(recursive=True)
        self.remove_all_locks(recursive=True)
        return True

    def delete(self):
        super().delete()
        invalidate(_user(self.environ))

    def move_recursive(self, dest_path):
        super().move_recursive(dest_path)
        ops.fix_shares(_user(self.environ), _rel(self.path), _rel(dest_path))


class UserFS(FilesystemProvider):
    """Cada usuario tiene como raiz STORAGE/<usuario>."""

    def _loc_to_file_path(self, path, environ=None):
        user = (environ or {}).get("wsgidav.auth.user_name")
        if not user:
            raise DAVError(HTTP_FORBIDDEN)
        root = os.path.realpath(user_root(user))
        parts = [p for p in path.strip("/").split("/") if p]
        fp = os.path.abspath(os.path.join(root, *parts))
        real = os.path.realpath(fp)
        if real != root and not real.startswith(root + os.sep):
            raise DAVError(HTTP_FORBIDDEN)
        return fp

    def get_resource_inst(self, path, environ):
        fp = self._loc_to_file_path(path, environ)
        if not os.path.exists(fp) or os.path.islink(fp):
            return None
        if os.path.isdir(fp):
            return QFolder(path, environ, fp)
        return QFile(path, environ, fp)


config = {
    "provider_mapping": {"/": UserFS(str(STORAGE))},
    "mount_path": "/dav",
    "http_authenticator": {
        "domain_controller": DriveDC,
        "accept_basic": True,
        "accept_digest": False,
        "default_to_digest": False,
        "trusted_auth_header": None,
    },
    "dir_browser": {"enable": True, "response_trailer": "DrivePanel WebDAV"},
    "lock_storage": True,
    "property_manager": True,
    "verbose": 1,
    "logging": {"enable": False},
    "hotfixes": {"re_encode_path_info": True},
}

dav_app = WSGIMiddleware(WsgiDAVApp(config), workers=4)
