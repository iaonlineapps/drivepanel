import asyncio, os, re, secrets, shutil, time, zipfile
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request, Depends, Query
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import db, limits, ops
from .config import STORAGE, TRASH, TMP, CONFIG, ARCHIVE, ALLOW_REGISTER
from .fsutil import (user_root, trash_root, safe_path, valid_name, unique_path, entry,
                     walk_files, usage, add_usage, invalidate, changed, thumbnail, clean_rel,
                     tree, tree_entry, IMAGE_EXT, VIDEO_EXT, kind)


@asynccontextmanager
async def lifespan(_app):
    await _startup()
    yield


APP_DIR = Path(__file__).parent
app = FastAPI(title="DrivePanel", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
COOKIE = "dp_session"
# sin punto al principio: las carpetas que empiezan por "." estan ocultas
USER_RE = re.compile(r"^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{2,31}$")
MAX_PENDING = 20  # cuentas pendientes de aprobar como mucho (evita que llenen la lista)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "?"


@app.middleware("http")
async def _security_headers(request: Request, call_next):
    r = await call_next(request)
    r.headers.setdefault("X-Content-Type-Options", "nosniff")
    r.headers.setdefault("Referrer-Policy", "same-origin")
    r.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    return r


def _drop_parts(name: str):
    """Borra las subidas a medias de un usuario (<usuario>_<uid>.part; el uid no lleva "_")."""
    for f in TMP.glob(f"{name}_*.part"):
        if "_" not in f.name[len(name) + 1:]:
            f.unlink(missing_ok=True)


def archive_user_dirs(name: str) -> str | None:
    """Aparta las carpetas que queden con ese nombre de usuario (por ejemplo de una cuenta
    borrada sin borrar sus archivos) para que una cuenta nueva con el mismo nombre no las
    herede. Quedan en DATA/archivo/<usuario>_<fecha>/ y el administrador decide que hacer."""
    dest = None
    for src, sub in ((STORAGE / name, "archivos"), (TRASH / name, "papelera")):
        if src.exists():
            if dest is None:
                dest = ARCHIVE / f"{name}_{time.strftime('%Y%m%d-%H%M%S')}"
                dest.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dest / sub))
    _drop_parts(name)
    invalidate(name)
    return dest.name if dest else None


async def _startup():
    db.init()
    # Las subidas enteras (sin trozos) que quedaron a medias al reiniciar no se pueden
    # continuar: se borran ya. Las de trozos se conservan para poder seguir, y las
    # abandonadas hace mas de 2 dias se borran cada hora en segundo plano.
    for f in TMP.glob("*.part"):
        if "_" not in f.name:
            f.unlink(missing_ok=True)
    asyncio.create_task(_cleaner())
    asyncio.create_task(_sampler())


async def _cleaner():
    while True:
        try:
            await asyncio.to_thread(_clean_old_parts, True)
        except Exception:
            pass
        await asyncio.sleep(3600)


# --- autenticacion -------------------------------------------------------------
def current_user(request: Request):
    u = db.session_user(request.cookies.get(COOKIE, ""))
    if not u:
        raise HTTPException(401, "Inicia sesion")
    return u


def admin_user(u=Depends(current_user)):
    if not u["is_admin"]:
        raise HTTPException(403, "Solo para administradores")
    return u


class Creds(BaseModel):
    username: str
    password: str


@app.post("/api/register")
def register(c: Creds, request: Request):
    name = c.username.strip()
    ip = client_ip(request)
    first = db.q1("SELECT COUNT(*) n FROM users")["n"] == 0
    if not first and not ALLOW_REGISTER:
        raise HTTPException(403, "El registro esta cerrado. Pide al administrador que te cree una cuenta")
    if not first and limits.register.blocked(ip):
        raise HTTPException(429, "Demasiadas cuentas nuevas desde aqui. Prueba mas tarde")
    if not first and db.q1("SELECT COUNT(*) n FROM users WHERE status='pending'")["n"] >= MAX_PENDING:
        raise HTTPException(429, "Hay demasiadas cuentas esperando aprobacion. Prueba mas tarde")
    if not USER_RE.match(name):
        raise HTTPException(400, "Usuario: 3-32 caracteres (letras, numeros, . _ -)")
    if len(c.password) < 6:
        raise HTTPException(400, "La contrasena debe tener al menos 6 caracteres")
    if db.q1("SELECT id FROM users WHERE username=?", name):
        raise HTTPException(400, "Ese usuario ya existe")
    if not first:
        limits.register.hit(ip)
    archive_user_dirs(name)
    db.run("INSERT INTO users(username,pw_hash,is_admin,status,quota,created) VALUES(?,?,?,?,?,?)",
           name, db.hash_pw(c.password), 1 if first else 0,
           "approved" if first else "pending", 0 if first else db.default_quota(), time.time())
    if first:
        return {"ok": True, "msg": "Cuenta de administrador creada. Ya puedes entrar."}
    return {"ok": True, "msg": "Cuenta creada. Un administrador tiene que aprobarla antes de entrar."}


@app.post("/api/login")
async def login(c: Creds, request: Request):
    name, ip = c.username.strip(), client_ip(request)
    wait = limits.login_blocked(ip, name)
    if wait:
        raise HTTPException(429, f"Demasiados intentos fallidos. Espera {max(1, wait // 60)} min y vuelve a probar")
    u = await asyncio.to_thread(db.authenticate, name, c.password)
    if not u:
        limits.login_failed(ip, name)
        await asyncio.sleep(0.7)
        raise HTTPException(401, "Usuario o contrasena incorrectos")
    limits.login_ok(ip, name)
    if u["status"] == "pending":
        raise HTTPException(403, "Tu cuenta esta pendiente de aprobacion")
    if u["status"] != "approved":
        raise HTTPException(403, "Tu cuenta esta bloqueada")
    tok = db.new_session(u["id"])
    r = JSONResponse({"ok": True})
    r.set_cookie(COOKIE, tok, max_age=30 * 86400, httponly=True, samesite="lax")
    return r


@app.post("/api/logout")
def logout(request: Request):
    db.run("DELETE FROM sessions WHERE token=?", request.cookies.get(COOKIE, ""))
    r = JSONResponse({"ok": True})
    r.delete_cookie(COOKIE)
    return r


class PwChange(BaseModel):
    old: str
    new: str


@app.post("/api/password")
def change_pw(p: PwChange, request: Request, u=Depends(current_user)):
    if not db.check_pw(p.old, u["pw_hash"]):
        raise HTTPException(400, "La contrasena actual no es correcta")
    if len(p.new) < 6:
        raise HTTPException(400, "Minimo 6 caracteres")
    db.run("UPDATE users SET pw_hash=? WHERE id=?", db.hash_pw(p.new), u["id"])
    # se cierran las demas sesiones abiertas (otros navegadores o moviles); esta sigue
    db.run("DELETE FROM sessions WHERE user_id=? AND token<>?", u["id"], request.cookies.get(COOKIE, ""))
    db.clear_auth_cache()
    return {"ok": True}


@app.get("/api/me")
def me(u=Depends(current_user)):
    pending = db.q1("SELECT COUNT(*) n FROM users WHERE status='pending'")["n"] if u["is_admin"] else 0
    return {"username": u["username"], "is_admin": bool(u["is_admin"]), "quota": u["quota"],
            "used": usage(u["username"]), "pending": pending, "avatar": avatar_version(u["id"])}


# --- foto de perfil -------------------------------------------------------------
AVATARS = CONFIG / "avatars"
AVATARS.mkdir(parents=True, exist_ok=True)


def avatar_version(uid: int) -> int:
    f = AVATARS / f"{uid}.jpg"
    return int(f.stat().st_mtime) if f.exists() else 0


@app.put("/api/avatar")
async def avatar_upload(request: Request, u=Depends(current_user)):
    data = await request.body()
    if len(data) > 15 * 1024**2:
        raise HTTPException(413, "La imagen es demasiado grande (max. 15 MB)")

    def process():
        import io
        from PIL import Image, ImageOps
        try:
            im = Image.open(io.BytesIO(data))
            im = ImageOps.exif_transpose(im).convert("RGB")
        except Exception:
            raise HTTPException(400, "Eso no parece una imagen")
        im = ImageOps.fit(im, (256, 256), Image.LANCZOS)  # recorte cuadrado centrado
        tmp = AVATARS / f"{u['id']}.tmp"
        im.save(tmp, "JPEG", quality=88)
        os.replace(tmp, AVATARS / f"{u['id']}.jpg")
    await asyncio.to_thread(process)
    return {"ok": True, "avatar": avatar_version(u["id"])}


@app.delete("/api/avatar")
def avatar_delete(u=Depends(current_user)):
    f = AVATARS / f"{u['id']}.jpg"
    if f.exists():
        f.unlink()
    return {"ok": True}


@app.get("/api/avatar/{username}")
def avatar_get(username: str, u=Depends(current_user)):
    t = db.q1("SELECT id FROM users WHERE username=?", username)
    f = AVATARS / f"{t['id']}.jpg" if t else None
    if not f or not f.exists():
        raise HTTPException(404)
    return FileResponse(f, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=31536000"})


# --- espacio: mi unidad o una carpeta compartida conmigo ----------------------
def space(u, share: int | None):
    """Devuelve (raiz, solo_lectura)."""
    if not share:
        return user_root(u["username"]), False
    s = db.q1("SELECT * FROM shares WHERE id=? AND target=?", share, u["username"])
    if not s:
        raise HTTPException(404, "Ese elemento ya no esta compartido contigo")
    return safe_path(user_root(s["owner"]), s["path"]), True


def resolve(u, path: str, share: int | None):
    root, ro = space(u, share)
    if root.is_file():  # compartieron un archivo suelto
        if clean_rel(path) not in ("", root.name):
            raise HTTPException(404)
        return root.parent, root, ro
    return root, safe_path(root, path), ro


@app.get("/api/list")
def list_dir(path: str = "", share: int | None = None, u=Depends(current_user)):
    root, p, _ = resolve(u, path, share)
    if p.is_file():
        return {"path": "", "items": [entry(p, root)]}
    if not p.is_dir():
        raise HTTPException(404, "La carpeta no existe")
    items = []
    with os.scandir(p) as it:
        for e in it:
            if e.name.startswith("."):
                continue
            try:
                items.append(entry(Path(e.path), root, e.stat()))
            except OSError:
                pass
    items.sort(key=lambda x: (not x["dir"], x["name"].lower()))
    return {"path": p.relative_to(root).as_posix() if p != root else "", "items": items}


@app.get("/api/search")
async def search(q: str, u=Depends(current_user)):
    needle = q.lower().strip()
    if not needle:
        return {"items": []}
    items = await asyncio.to_thread(tree, u["username"])
    out = [tree_entry(t) for t in items if needle in t[1].lower()][:300]
    out.sort(key=lambda x: (not x["dir"], x["name"].lower()))
    return {"items": out}


async def _latest(u, pred, limit):
    items = await asyncio.to_thread(tree, u["username"])
    files = [t for t in items if not t[2] and pred(t[1])]
    files.sort(key=lambda t: t[4], reverse=True)
    return {"items": [tree_entry(t) for t in files[:limit]]}


@app.get("/api/recent")
async def recent(u=Depends(current_user)):
    return await _latest(u, lambda n: True, 60)


@app.get("/api/photos")
async def photos(u=Depends(current_user)):
    exts = IMAGE_EXT | VIDEO_EXT
    return await _latest(u, lambda n: os.path.splitext(n)[1].lower() in exts, 1000)


class MkDir(BaseModel):
    path: str = ""
    name: str


@app.post("/api/mkdir")
def mkdir(m: MkDir, u=Depends(current_user)):
    root = user_root(u["username"])
    parent = safe_path(root, m.path)
    p = parent / valid_name(m.name)
    if p.exists():
        raise HTTPException(400, "Ya existe algo con ese nombre")
    p.mkdir()
    changed(u["username"])
    db.log(u["username"], "mkdir", p.relative_to(root).as_posix())
    return {"ok": True}


# --- subida (por trozos, se escribe directo al disco) --------------------------
# El navegador manda cada archivo en trozos (por defecto 32 MB). Asi ninguna peticion
# dura mucho (algunos proxys inversos cortan peticiones largas) y un fallo
# solo obliga a repetir un trozo. Sin "uid" funciona como antes (archivo entero).
UID_RE = re.compile(r"^[a-zA-Z0-9-]{8,64}$")  # sin "_": separa usuario y uid en el .part
_last_clean = [0.0]

# Espacio "apartado" por las subidas en curso, para que varias a la vez (o un archivo
# grande en trozos) no se pasen de la cuota. {usuario: {uid: [tamano, ultima_actividad]}}
_reserved: dict[str, dict[str, list]] = {}
RESERVE_TTL = 6 * 3600  # una subida sin actividad en 6 h deja de apartar espacio


def _reserved_bytes(username: str, exclude: str = "") -> int:
    now = time.time()
    r = _reserved.get(username, {})
    for k in [k for k, v in r.items() if now - v[1] > RESERVE_TTL]:
        r.pop(k, None)
    return sum(v[0] for k, v in r.items() if k != exclude)


def _reserve(username: str, uid: str, size: int):
    _reserved.setdefault(username, {})[uid] = [size, time.time()]


def _unreserve(username: str, uid: str):
    _reserved.get(username, {}).pop(uid, None)


def _check_space(u, uid: str, size: int):
    quota = u["quota"]
    if quota and usage(u["username"]) + _reserved_bytes(u["username"], uid) + size > quota:
        raise HTTPException(507, "No te queda espacio en tu cuota")
    if size > shutil.disk_usage(STORAGE).free - 200 * 1024**2:
        raise HTTPException(507, "El disco esta lleno")


def _clean_old_parts(force=False):
    """Borra trozos de subidas abandonadas hace mas de 2 dias (como mucho una vez por hora)."""
    now = time.time()
    if not force and now - _last_clean[0] < 3600:
        return
    _last_clean[0] = now
    for f in TMP.glob("*.part"):
        try:
            if now - f.stat().st_mtime > 2 * 86400:
                f.unlink()
        except OSError:
            pass


@app.put("/api/upload")
async def upload(request: Request, path: str = "", name: str = Query(...), uid: str = "",
                 offset: int = 0, total: int = -1, conflict: str = "skip", u=Depends(current_user)):
    # conflict: skip = no subir si ya hay uno identico (mismo tamano), si no guardar ambos
    #           overwrite = reemplazar el existente;  rename = guardar ambos siempre
    if conflict not in ("skip", "overwrite", "rename"):
        raise HTTPException(400, "Opcion no valida")
    username = u["username"]
    root = user_root(username)
    rel = clean_rel(name)            # puede llevar subcarpetas (subida de carpeta)
    if not rel:
        raise HTTPException(400, "Nombre no valido")
    parts = rel.split("/")
    for x in parts:
        valid_name(x)
    dest_dir = safe_path(root, "/".join(x for x in (clean_rel(path), "/".join(parts[:-1])) if x))
    length = int(request.headers.get("content-length") or 0)
    chunked = bool(uid)
    if chunked and not UID_RE.match(uid):
        raise HTTPException(400, "Identificador de subida no valido")
    size = total if chunked and total >= 0 else length
    target = dest_dir / parts[-1]
    rkey = uid if chunked else secrets.token_hex(8)

    if offset == 0:
        _clean_old_parts()
        # Si ya existe un archivo identico (mismo nombre y tamano), no se vuelve a subir.
        if conflict == "skip" and target.is_file() and target.stat().st_size == size:
            async for _ in request.stream():
                pass
            return {"ok": True, "name": target.name, "skipped": True, "done": True}
    if offset == 0 or rkey not in _reserved.get(username, {}):
        # (tambien al continuar una subida si el servidor se reinicio entre trozos)
        _check_space(u, rkey, size)
    _reserve(username, rkey, size)

    tmp = TMP / (f"{username}_{uid}.part" if chunked else f"{rkey}.part")
    if chunked and offset > 0:
        have = tmp.stat().st_size if tmp.exists() else -1
        if have != offset:
            # el cliente reintentara desde donde realmente estamos
            raise HTTPException(409, f"offset:{max(have, 0)}")
    written = 0
    ok = False
    try:
        with open(tmp, "r+b" if chunked and offset > 0 else "wb", buffering=1024 * 1024) as f:
            if offset:
                f.seek(offset)
            async for chunk in request.stream():
                written += len(chunk)
                if offset + written > size >= 0 and chunked:
                    raise HTTPException(400, "El trozo es mas grande que el archivo")
                await asyncio.to_thread(f.write, chunk) if len(chunk) > 262144 else f.write(chunk)
        if length and written != length:
            raise HTTPException(400, "Subida incompleta")
        if chunked and offset + written < size:
            ok = True
            _reserve(username, rkey, size)  # sigue viva: renueva la reserva
            return {"ok": True, "done": False, "received": offset + written}
        dest_dir.mkdir(parents=True, exist_ok=True)
        final = safe_path(root, target.relative_to(root).as_posix())
        if conflict != "overwrite" or not final.is_file():
            final = unique_path(final)
        elif final.is_file():
            add_usage(username, -final.stat().st_size)
        os.replace(tmp, final)
        ok = True
        mt = request.headers.get("x-mtime")
        if mt:
            try:
                t = float(mt) / 1000
                os.utime(final, (t, t))
            except ValueError:
                pass
    finally:
        # en subidas por trozos se conserva el .part si falla, para poder reintentar el trozo
        if tmp.exists() and not ok and not chunked:
            tmp.unlink()
        if not chunked:
            _unreserve(username, rkey)
    _unreserve(username, rkey)
    add_usage(username, size)
    db.log(username, "upload", final.relative_to(root).as_posix(), size)
    return {"ok": True, "name": final.name, "done": True}


class UpCheck(BaseModel):
    path: str = ""
    files: list[list]   # [[ruta_relativa, tamano], ...]


@app.post("/api/upload/check")
def upload_check(b: UpCheck, u=Depends(current_user)):
    """Dice cuantos de los archivos que se van a subir ya existen (iguales o distintos)."""
    root = user_root(u["username"])
    base = clean_rel(b.path)
    exists = []
    for item in b.files[:200000]:
        try:
            rel, size = clean_rel(str(item[0])), int(item[1])
            p = safe_path(root, "/".join(x for x in (base, rel) if x))
        except Exception:
            continue
        if p.is_file():
            st = p.stat()
            exists.append({"rel": rel, "size": st.st_size, "mtime": st.st_mtime, "same": st.st_size == size})
    return {"exists": exists}


@app.delete("/api/upload/{uid}")
def upload_cancel(uid: str, u=Depends(current_user)):
    if UID_RE.match(uid):
        (TMP / f"{u['username']}_{uid}.part").unlink(missing_ok=True)
        _unreserve(u["username"], uid)
    return {"ok": True}


# --- descarga / vista ---------------------------------------------------------
# Solo se muestran en el navegador los tipos que no pueden ejecutar codigo. Un .html o
# un .svg subido por un usuario, abierto "inline" desde este mismo dominio, podria leer
# los archivos de quien lo abre (XSS). Esos se sirven como texto plano o se descargan.
_INLINE_PREFIX = ("image/", "video/", "audio/")
_INLINE_EXACT = {"application/pdf"}
_NEVER_INLINE = {"image/svg+xml"}


def send_file(p: Path, download: bool):
    import mimetypes
    mt = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    headers = {"X-Content-Type-Options": "nosniff"}
    if download:
        return FileResponse(p, filename=p.name, content_disposition_type="attachment", headers=headers)
    if mt not in _NEVER_INLINE and (mt.startswith(_INLINE_PREFIX) or mt in _INLINE_EXACT):
        if mt != "application/pdf":  # el visor de PDF del navegador no funciona en sandbox
            headers["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src 'self'; media-src 'self'"
        return FileResponse(p, filename=p.name, media_type=mt, content_disposition_type="inline", headers=headers)
    if kind(p.name) == "text":
        headers["Content-Security-Policy"] = "sandbox; default-src 'none'"
        return FileResponse(p, filename=p.name, media_type="text/plain; charset=utf-8",
                            content_disposition_type="inline", headers=headers)
    return FileResponse(p, filename=p.name, content_disposition_type="attachment", headers=headers)


@app.get("/api/file")
def get_file(path: str, share: int | None = None, download: int = 0, u=Depends(current_user)):
    _, p, _ = resolve(u, path, share)
    if not p.is_file():
        raise HTTPException(404, "No encontrado")
    return send_file(p, bool(download))


@app.get("/api/thumb")
async def thumb(path: str, share: int | None = None, u=Depends(current_user)):
    _, p, _ = resolve(u, path, share)
    if not p.is_file():
        raise HTTPException(404)
    t = await asyncio.to_thread(thumbnail, p)
    if not t:
        raise HTTPException(415)
    return FileResponse(t, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=604800"})


class _Pipe:
    """Buffer en memoria que el zip va llenando y nosotros vaciando."""
    def __init__(self): self.buf = bytearray(); self.pos = 0
    def write(self, b): self.buf += b; self.pos += len(b); return len(b)
    def tell(self): return self.pos
    def flush(self): pass
    def take(self):
        b = bytes(self.buf); self.buf.clear(); return b


def zip_stream(items):
    """items: lista de (ruta_en_disco, nombre_en_zip). ZIP sin comprimir (rapido en la Pi)."""
    pipe = _Pipe()
    with zipfile.ZipFile(pipe, "w", zipfile.ZIP_STORED, allowZip64=True) as zf:
        for src, arc in items:
            src = Path(src)
            if src.is_dir():
                files = list(walk_files(src))
                if not files:
                    zf.writestr(arc + "/", b"")
                for e in files:
                    yield from _zip_one(zf, pipe, Path(e.path), arc + "/" + Path(e.path).relative_to(src).as_posix())
            elif src.is_file():
                yield from _zip_one(zf, pipe, src, arc)
    yield pipe.take()


def _zip_one(zf, pipe, src: Path, arc: str):
    zi = zipfile.ZipInfo.from_file(src, arc)
    zi.compress_type = zipfile.ZIP_STORED
    with open(src, "rb") as f, zf.open(zi, "w", force_zip64=True) as out:
        while True:
            b = f.read(1024 * 1024)
            if not b:
                break
            out.write(b)
            if len(pipe.buf) >= 1024 * 1024:
                yield pipe.take()
    if pipe.buf:
        yield pipe.take()


def zip_response(items, name):
    return StreamingResponse(zip_stream(items), media_type="application/zip",
                             headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"})


@app.get("/api/zip")
def zip_download(paths: list[str] = Query(...), share: int | None = None, u=Depends(current_user)):
    items = []
    for rel in paths:
        root, p, _ = resolve(u, rel, share)
        if not p.exists():
            raise HTTPException(404, f"No existe: {rel}")
        items.append((p, p.name or "mi-unidad"))
    name = (items[0][1] if len(items) == 1 else "DrivePanel") + ".zip"
    return zip_response(items, name)


# --- propiedades (como "Propiedades" en Windows) ------------------------------
def _props_one(p: Path) -> dict:
    st = p.stat()
    if p.is_file():
        return {"size": st.st_size, "files": 1, "folders": 0, "kinds": {kind(p.name): [1, st.st_size]},
                "mtime": st.st_mtime, "ctime": st.st_ctime}
    size = files = folders = 0
    kinds = {}
    stack = [str(p)]
    while stack:
        d = stack.pop()
        try:
            with os.scandir(d) as it:
                for e in it:
                    try:
                        if e.is_dir(follow_symlinks=False):
                            folders += 1
                            stack.append(e.path)
                        elif e.is_file(follow_symlinks=False):
                            sz = e.stat(follow_symlinks=False).st_size
                            files += 1
                            size += sz
                            c = kinds.setdefault(kind(e.name), [0, 0])
                            c[0] += 1
                            c[1] += sz
                    except OSError:
                        pass
        except OSError:
            pass
    return {"size": size, "files": files, "folders": folders, "kinds": kinds,
            "mtime": st.st_mtime, "ctime": st.st_ctime}


@app.get("/api/props")
async def props(paths: list[str] = Query(...), share: int | None = None, u=Depends(current_user)):
    root, _ = space(u, share)
    base = root.parent if root.is_file() else root
    targets = []
    for rel in paths[:500]:
        _, p, _ = resolve(u, rel, share)
        if not p.exists():
            raise HTTPException(404, "No encontrado")
        targets.append(p)

    def work():
        tot = {"size": 0, "files": 0, "folders": 0, "kinds": {}}
        one = None
        for p in targets:
            r = _props_one(p)
            one = r
            tot["size"] += r["size"]
            tot["files"] += r["files"]
            tot["folders"] += r["folders"] + (1 if p.is_dir() and len(targets) > 1 else 0)
            for k, (n, sz) in r["kinds"].items():
                c = tot["kinds"].setdefault(k, [0, 0])
                c[0] += n
                c[1] += sz
        if len(targets) == 1:
            p = targets[0]
            tot.update({"name": p.name, "dir": p.is_dir(), "kind": kind(p.name, p.is_dir()),
                        "location": "/" + p.parent.relative_to(base).as_posix().removeprefix("."),
                        "mtime": one["mtime"], "ctime": one["ctime"]})
        tot["kinds"] = [{"kind": k, "count": v[0], "size": v[1]} for k, v in sorted(tot["kinds"].items(), key=lambda x: -x[1][1])]
        tot["count"] = len(targets)
        return tot
    return await asyncio.to_thread(work)


# --- renombrar / mover / papelera ---------------------------------------------
class Rename(BaseModel):
    path: str
    name: str


@app.post("/api/rename")
def rename(r: Rename, u=Depends(current_user)):
    root = user_root(u["username"])
    p = safe_path(root, r.path)
    if p == root or not p.exists():
        raise HTTPException(404)
    new = p.with_name(valid_name(r.name))
    if new.exists():
        raise HTTPException(400, "Ya existe algo con ese nombre")
    p.rename(new)
    ops.fix_shares(u["username"], r.path, new.relative_to(root).as_posix())
    db.log(u["username"], "rename", new.relative_to(root).as_posix())
    return {"ok": True}


class Move(BaseModel):
    paths: list[str]
    dest: str = ""


@app.post("/api/move")
def move(m: Move, u=Depends(current_user)):
    root = user_root(u["username"])
    dest = safe_path(root, m.dest)
    if not dest.is_dir():
        raise HTTPException(400, "Destino no valido")
    for rel in m.paths:
        p = safe_path(root, rel)
        if p == root or not p.exists():
            continue
        if p.is_dir() and (dest == p or str(dest).startswith(str(p) + os.sep)):
            raise HTTPException(400, "No puedes mover una carpeta dentro de si misma")
        if p.parent == dest:
            continue
        target = unique_path(dest / p.name)
        shutil.move(str(p), str(target))
        ops.fix_shares(u["username"], rel, target.relative_to(root).as_posix())
        db.log(u["username"], "move", target.relative_to(root).as_posix())
    return {"ok": True}


class Paths(BaseModel):
    paths: list[str]


@app.post("/api/delete")
def delete(b: Paths, u=Depends(current_user)):
    for rel in b.paths:
        ops.move_to_trash(u["username"], rel)
    return {"ok": True}


@app.get("/api/trash")
def trash_list(u=Depends(current_user)):
    rows = db.q("SELECT * FROM trash WHERE username=? ORDER BY deleted_at DESC", u["username"])
    return {"items": [{"id": r["id"], "name": os.path.basename(r["orig_path"]), "path": r["orig_path"],
                       "dir": bool(r["is_dir"]), "size": r["size"], "mtime": r["deleted_at"],
                       "kind": "folder" if r["is_dir"] else kind(r["orig_path"])}
                      for r in rows]}


class Ids(BaseModel):
    ids: list[int]


@app.post("/api/trash/restore")
def trash_restore(b: Ids, u=Depends(current_user)):
    username = u["username"]
    root, troot = user_root(username), trash_root(username)
    for i in b.ids:
        r = db.q1("SELECT * FROM trash WHERE id=? AND username=?", i, username)
        if not r:
            continue
        src = troot / r["trash_name"]
        if src.exists():
            dest = safe_path(root, r["orig_path"])
            dest.parent.mkdir(parents=True, exist_ok=True)
            os.rename(src, unique_path(dest))
            db.log(username, "restore", r["orig_path"], r["size"])
        db.run("DELETE FROM trash WHERE id=?", i)
    changed(username)
    return {"ok": True}


def _purge(username, rows):
    troot = trash_root(username)
    for r in rows:
        p = troot / r["trash_name"]
        if p.is_dir():
            shutil.rmtree(p, ignore_errors=True)
        elif p.exists():
            p.unlink()
        db.run("DELETE FROM trash WHERE id=?", r["id"])
        db.log(username, "purge", r["orig_path"], r["size"])
    invalidate(username)


@app.post("/api/trash/delete")
def trash_delete(b: Ids, u=Depends(current_user)):
    rows = [r for i in b.ids if (r := db.q1("SELECT * FROM trash WHERE id=? AND username=?", i, u["username"]))]
    _purge(u["username"], rows)
    return {"ok": True}


@app.post("/api/trash/empty")
def trash_empty(u=Depends(current_user)):
    _purge(u["username"], db.q("SELECT * FROM trash WHERE username=?", u["username"]))
    return {"ok": True}


# --- compartir ------------------------------------------------------------------
class ShareReq(BaseModel):
    path: str
    target: str | None = None   # usuario con quien compartir; vacio = enlace publico
    days: float | None = None   # solo enlaces publicos: caduca a los N dias (vacio = nunca)


@app.post("/api/share")
def share_create(s: ShareReq, u=Depends(current_user)):
    root = user_root(u["username"])
    p = safe_path(root, s.path)
    if p == root or not p.exists():
        raise HTTPException(400, "No se puede compartir eso")
    target = (s.target or "").strip() or None
    if target:
        t = db.q1("SELECT username FROM users WHERE username=? AND status='approved'", target)
        if not t:
            raise HTTPException(404, "Ese usuario no existe")
        target = t["username"]
        if target == u["username"]:
            raise HTTPException(400, "No puedes compartirlo contigo")
        old = db.q1("SELECT * FROM shares WHERE owner=? AND path=? AND target=?", u["username"], clean_rel(s.path), target)
        if old:
            return {"ok": True, "token": old["token"]}
    expires = None
    if not target and s.days:
        if not 0 < s.days <= 3650:
            raise HTTPException(400, "Caducidad no valida")
        expires = time.time() + s.days * 86400
    tok = secrets.token_urlsafe(12)
    db.run("INSERT INTO shares(owner,path,token,target,created,expires) VALUES(?,?,?,?,?,?)",
           u["username"], clean_rel(s.path), tok, target, time.time(), expires)
    db.log(u["username"], "share", clean_rel(s.path) + (f" → {target}" if target else " (enlace)"))
    return {"ok": True, "token": tok, "expires": expires}


def _share_item(s, root):
    p = safe_path(root, s["path"])
    if not p.exists():
        return None
    e = entry(p, root)
    e.update({"share_id": s["id"], "token": s["token"], "target": s["target"], "owner": s["owner"],
              "expires": s["expires"]})
    return e


@app.get("/api/shares")
def shares(u=Depends(current_user)):
    mine, withme = [], []
    db.run("DELETE FROM shares WHERE expires IS NOT NULL AND expires<?", time.time())
    for s in db.q("SELECT * FROM shares WHERE owner=? ORDER BY created DESC", u["username"]):
        e = _share_item(s, user_root(u["username"]))
        if e: mine.append(e)
    for s in db.q("SELECT * FROM shares WHERE target=? ORDER BY created DESC", u["username"]):
        e = _share_item(s, user_root(s["owner"]))
        if e:
            e["path"] = ""  # dentro del espacio compartido, la raiz es el propio elemento
            withme.append(e)
    return {"mine": mine, "withme": withme}


@app.delete("/api/share/{sid}")
def share_delete(sid: int, u=Depends(current_user)):
    db.run("DELETE FROM shares WHERE id=? AND (owner=? OR target=?)", sid, u["username"], u["username"])
    return {"ok": True}


@app.get("/s/{token}")
def public_link(token: str, inline: int = 0):
    s = db.q1("SELECT * FROM shares WHERE token=? AND target IS NULL", token)
    if s and s["expires"] and s["expires"] < time.time():
        db.run("DELETE FROM shares WHERE id=?", s["id"])
        s = None
    if not s:
        return HTMLResponse("<h2 style='font-family:sans-serif'>Enlace no valido o caducado</h2>", 404)
    p = safe_path(user_root(s["owner"]), s["path"])
    if p.is_file():
        return send_file(p, not inline)
    if p.is_dir():
        return zip_response([(p, p.name)], p.name + ".zip")
    raise HTTPException(404)


# --- estado de la Pi --------------------------------------------------------------
_cpu_prev = [0, 0]


def _cpu_percent():
    try:
        with open("/proc/stat") as f:
            vals = list(map(int, f.readline().split()[1:]))
        idle, total = vals[3] + vals[4], sum(vals)
        di, dt = idle - _cpu_prev[0], total - _cpu_prev[1]
        _cpu_prev[:] = [idle, total]
        return round(100 * (1 - di / dt), 1) if dt > 0 else 0.0
    except Exception:
        return None


def _temp():
    for z in ("/sys/class/thermal/thermal_zone0/temp",):
        try:
            return round(int(open(z).read()) / 1000, 1)
        except Exception:
            pass
    return None


def _mem():
    try:
        info = {}
        for line in open("/proc/meminfo"):
            k, v = line.split(":")
            info[k] = int(v.split()[0]) * 1024
        return {"total": info["MemTotal"], "used": info["MemTotal"] - info["MemAvailable"]}
    except Exception:
        return None


# muestra cada 10 s (CPU, RAM, temperatura) para la grafica del panel: ultimos 10 minutos
_history = []


async def _sampler():
    while True:
        try:
            m = _mem()
            _history.append({"t": int(time.time() * 1000), "cpu": _cpu_percent(), "temp": _temp(),
                             "mem": round(m["used"] / m["total"] * 100, 1) if m else None})
            del _history[:-60]
        except Exception:
            pass
        await asyncio.sleep(10)


@app.get("/api/stats")
def stats(u=Depends(current_user)):
    du = shutil.disk_usage(STORAGE)
    last = _history[-1] if _history else {}
    return {"cpu": last.get("cpu"), "temp": _temp(), "mem": _mem(),
            "disk": {"total": du.total, "used": du.used, "free": du.free},
            "used": usage(u["username"]), "quota": u["quota"]}


# --- panel de actividad -------------------------------------------------------------
_dash_cache = {}
DASH_DAYS = 30


def _scan_user(username: str) -> dict:
    """Recorre los archivos del usuario una vez: tipos, mas grandes y llegadas por dia.
    Se guarda 2 minutos en memoria para no castigar la tarjeta SD / el disco de la Pi."""
    hit = _dash_cache.get(username)
    last = db.q1("SELECT MAX(at) t FROM activity WHERE username=?", username)["t"] or 0
    if hit and hit[0] > time.time() and last <= hit[2]:  # si ha habido cambios, se vuelve a contar
        return hit[1]
    t0 = time.time()
    root = user_root(username)
    kinds, largest, days = {}, [], {}
    files = folders = 0
    start = time.time() - DASH_DAYS * 86400
    stack = [root]
    while stack:
        d = stack.pop()
        try:
            with os.scandir(d) as it:
                for e in it:
                    if e.name.startswith("."):
                        continue
                    try:
                        if e.is_dir(follow_symlinks=False):
                            folders += 1
                            stack.append(e.path)
                            continue
                        if not e.is_file(follow_symlinks=False):
                            continue
                        st = e.stat(follow_symlinks=False)
                    except OSError:
                        continue
                    files += 1
                    k = kind(e.name)
                    c = kinds.setdefault(k, [0, 0])
                    c[0] += 1
                    c[1] += st.st_size
                    largest.append((st.st_size, e.path))
                    if len(largest) > 64:
                        largest.sort(reverse=True)
                        del largest[8:]
                    # ctime = cuando llego el archivo al disco (la subida conserva la fecha original en mtime)
                    if st.st_ctime >= start:
                        day = time.strftime("%Y-%m-%d", time.localtime(st.st_ctime))
                        c = days.setdefault(day, [0, 0])
                        c[0] += 1
                        c[1] += st.st_size
        except OSError:
            continue
    largest.sort(reverse=True)
    out = {"files": files, "folders": folders,
           "kinds": [{"kind": k, "count": v[0], "size": v[1]} for k, v in sorted(kinds.items(), key=lambda x: -x[1][1])],
           "largest": [entry(Path(p), root) for _, p in largest[:5]],
           "days": days}
    _dash_cache[username] = (time.time() + 120, out, t0)
    return out


@app.get("/api/dashboard")
async def dashboard(u=Depends(current_user)):
    username = u["username"]
    scan = await asyncio.to_thread(_scan_user, username)
    today = time.time()
    series = []
    for i in range(DASH_DAYS - 1, -1, -1):
        day = time.strftime("%Y-%m-%d", time.localtime(today - i * 86400))
        c = scan["days"].get(day, [0, 0])
        series.append({"day": day, "count": c[0], "size": c[1]})
    since = today - DASH_DAYS * 86400
    acts = db.q("SELECT action, COUNT(*) n FROM activity WHERE username=? AND at>=? GROUP BY action", username, since)
    recent = db.q("SELECT action,path,size,at FROM activity WHERE username=? ORDER BY at DESC LIMIT 25", username)
    trash = db.q1("SELECT COUNT(*) n, COALESCE(SUM(size),0) s FROM trash WHERE username=?", username)
    shares_n = db.q1("SELECT COUNT(*) n FROM shares WHERE owner=?", username)["n"]
    du = shutil.disk_usage(STORAGE)
    out = {"files": scan["files"], "folders": scan["folders"], "kinds": scan["kinds"],
           "largest": scan["largest"], "uploads": series,
           "actions": {r["action"]: r["n"] for r in acts},
           "recent": [dict(r) | {"kind": kind(r["path"].split(" → ")[0].removesuffix(" (enlace)"))} for r in recent],
           "trash": {"count": trash["n"], "size": trash["s"]}, "shares": shares_n,
           "used": usage(username), "quota": u["quota"],
           "disk": {"total": du.total, "used": du.used, "free": du.free},
           "history": _history}
    if u["is_admin"]:
        rows = db.q("SELECT id,username,quota FROM users WHERE status='approved' ORDER BY username")
        out["users"] = sorted(({"username": r["username"], "used": usage(r["username"]), "quota": r["quota"],
                                "avatar": avatar_version(r["id"])} for r in rows), key=lambda x: -x["used"])
    return out


# --- administracion ------------------------------------------------------------
@app.get("/api/admin/users")
def admin_users(a=Depends(admin_user)):
    rows = db.q("SELECT id,username,is_admin,status,quota,created FROM users ORDER BY status='pending' DESC, username")
    return {"users": [dict(r) | {"used": usage(r["username"]), "avatar": avatar_version(r["id"])} for r in rows]}


class NewUser(BaseModel):
    username: str
    password: str
    is_admin: bool = False
    quota_gb: float | None = None


@app.post("/api/admin/users")
def admin_create(b: NewUser, a=Depends(admin_user)):
    name = b.username.strip()
    if not USER_RE.match(name):
        raise HTTPException(400, "Usuario: 3-32 caracteres (letras, numeros, . _ -)")
    if len(b.password) < 6:
        raise HTTPException(400, "La contrasena debe tener al menos 6 caracteres")
    if db.q1("SELECT id FROM users WHERE username=?", name):
        raise HTTPException(400, "Ese usuario ya existe")
    quota = db.default_quota() if b.quota_gb is None else int(max(0, b.quota_gb) * 1024**3)
    archive_user_dirs(name)
    db.run("INSERT INTO users(username,pw_hash,is_admin,status,quota,created) VALUES(?,?,?,'approved',?,?)",
           name, db.hash_pw(b.password), int(b.is_admin), quota, time.time())
    user_root(name)
    return {"ok": True}


class UserUpd(BaseModel):
    status: str | None = None
    is_admin: bool | None = None
    quota_gb: float | None = None
    password: str | None = None


@app.post("/api/admin/users/{uid}")
def admin_update(uid: int, b: UserUpd, a=Depends(admin_user)):
    t = db.q1("SELECT * FROM users WHERE id=?", uid)
    if not t:
        raise HTTPException(404)
    if t["id"] == a["id"] and (b.status not in (None, "approved") or b.is_admin is False):
        raise HTTPException(400, "No puedes quitarte el acceso a ti mismo")
    if b.status is not None:
        if b.status not in ("approved", "blocked", "pending"):
            raise HTTPException(400)
        db.run("UPDATE users SET status=? WHERE id=?", b.status, uid)
        if b.status != "approved":
            db.run("DELETE FROM sessions WHERE user_id=?", uid)
    if b.is_admin is not None:
        db.run("UPDATE users SET is_admin=? WHERE id=?", int(b.is_admin), uid)
    if b.quota_gb is not None:
        db.run("UPDATE users SET quota=? WHERE id=?", int(max(0, b.quota_gb) * 1024**3), uid)
    if b.password:
        if len(b.password) < 6:
            raise HTTPException(400, "Minimo 6 caracteres")
        db.run("UPDATE users SET pw_hash=? WHERE id=?", db.hash_pw(b.password), uid)
        if uid != a["id"]:  # con la contrasena nueva hay que volver a entrar en todas partes
            db.run("DELETE FROM sessions WHERE user_id=?", uid)
    db.clear_auth_cache()
    return {"ok": True}


@app.delete("/api/admin/users/{uid}")
def admin_delete(uid: int, files: int = 0, a=Depends(admin_user)):
    t = db.q1("SELECT * FROM users WHERE id=?", uid)
    if not t or t["id"] == a["id"]:
        raise HTTPException(400, "No se puede eliminar")
    name = t["username"]
    for sql in ("DELETE FROM sessions WHERE user_id=?",):
        db.run(sql, uid)
    db.run("DELETE FROM shares WHERE owner=? OR target=?", name, name)
    db.run("DELETE FROM trash WHERE username=?", name)
    db.run("DELETE FROM users WHERE id=?", uid)
    (AVATARS / f"{uid}.jpg").unlink(missing_ok=True)
    archived = None
    if files:
        shutil.rmtree(STORAGE / name, ignore_errors=True)
        shutil.rmtree(TRASH / name, ignore_errors=True)
        _drop_parts(name)
        invalidate(name)
    else:
        archived = archive_user_dirs(name)
    db.clear_auth_cache()
    return {"ok": True, "archived": archived}


# --- WebDAV y web -----------------------------------------------------------------
from .webdav import dav_app  # noqa: E402
app.mount("/dav", dav_app)


@app.api_route("/", methods=["GET", "HEAD"])
def index():
    return FileResponse(APP_DIR / "static" / "index.html", headers={"Cache-Control": "no-cache"})


app.mount("/static", StaticFiles(directory=APP_DIR / "static"), name="static")
