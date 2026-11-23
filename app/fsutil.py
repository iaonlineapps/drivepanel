import hashlib, mimetypes, os, threading, time
from pathlib import Path
from fastapi import HTTPException
from .config import STORAGE, TRASH, CACHE

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic", ".heif"}
VIDEO_EXT = {".mp4", ".webm", ".mov", ".mkv", ".m4v", ".avi", ".3gp"}
THUMB_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}


def user_root(username: str) -> Path:
    p = STORAGE / username
    p.mkdir(parents=True, exist_ok=True)
    return p


def trash_root(username: str) -> Path:
    p = TRASH / username
    p.mkdir(parents=True, exist_ok=True)
    return p


def clean_rel(rel: str) -> str:
    parts = [x for x in (rel or "").replace("\\", "/").split("/") if x not in ("", ".")]
    if any(x == ".." for x in parts):
        raise HTTPException(400, "Ruta no valida")
    return "/".join(parts)


def safe_path(root: Path, rel: str) -> Path:
    rel = clean_rel(rel)
    p = (root / rel) if rel else root
    real_root = os.path.realpath(root)
    real = os.path.realpath(p)
    if real != real_root and not real.startswith(real_root + os.sep):
        raise HTTPException(403, "Acceso fuera de tu carpeta")
    return p


def valid_name(name: str) -> str:
    name = (name or "").strip()
    if not name or name in (".", "..") or "/" in name or "\\" in name or "\0" in name or len(name) > 255:
        raise HTTPException(400, "Nombre no valido")
    return name


def unique_path(p: Path) -> Path:
    if not p.exists():
        return p
    stem, suf = (p.stem, p.suffix) if p.is_file() or "." in p.name else (p.name, "")
    i = 1
    while True:
        c = p.with_name(f"{stem} ({i}){suf}")
        if not c.exists():
            return c
        i += 1


def kind(name: str, is_dir=False) -> str:
    if is_dir:
        return "folder"
    ext = os.path.splitext(name)[1].lower()
    if ext in IMAGE_EXT: return "image"
    if ext in VIDEO_EXT: return "video"
    mt = mimetypes.guess_type(name)[0] or ""
    if mt.startswith("audio"): return "audio"
    if ext == ".pdf": return "pdf"
    if ext in (".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"): return "archive"
    if ext in (".doc", ".docx", ".odt", ".rtf"): return "doc"
    if ext in (".xls", ".xlsx", ".ods", ".csv"): return "sheet"
    if ext in (".ppt", ".pptx", ".odp"): return "slides"
    if mt.startswith("text") or ext in (".md", ".json", ".log", ".yml", ".yaml", ".py", ".js", ".sh", ".conf", ".ini", ".xml", ".html", ".css"):
        return "text"
    return "file"


def entry(p: Path, root: Path, st=None) -> dict:
    st = st or p.stat()
    is_dir = p.is_dir()
    rel = p.relative_to(root).as_posix()
    return {"name": p.name, "path": rel, "dir": is_dir, "size": 0 if is_dir else st.st_size,
            "mtime": st.st_mtime, "kind": kind(p.name, is_dir)}


def walk_files(root: Path, limit_dirs=200000):
    """Recorre todos los archivos (sin enlaces simbolicos, sin ocultos)."""
    stack = [root]
    while stack:
        d = stack.pop()
        try:
            with os.scandir(d) as it:
                for e in it:
                    if e.name.startswith("."):
                        continue
                    if e.is_dir(follow_symlinks=False):
                        stack.append(e.path)
                    elif e.is_file(follow_symlinks=False):
                        yield e
        except OSError:
            continue


def dir_size(path: Path) -> int:
    total = 0
    stack = [str(path)]
    while stack:
        d = stack.pop()
        try:
            with os.scandir(d) as it:
                for e in it:
                    try:
                        if e.is_dir(follow_symlinks=False):
                            stack.append(e.path)
                        elif e.is_file(follow_symlinks=False):
                            total += e.stat(follow_symlinks=False).st_size
                    except OSError:
                        pass
        except OSError:
            pass
    return total


# --- uso por usuario (con cache) ---------------------------------------------
_usage = {}
_usage_lock = threading.Lock()


def usage(username: str) -> int:
    with _usage_lock:
        hit = _usage.get(username)
        if hit and hit[0] > time.time():
            return hit[1]
    total = dir_size(STORAGE / username) + dir_size(TRASH / username)
    with _usage_lock:
        _usage[username] = (time.time() + 300, total)
    return total


def add_usage(username: str, delta: int):
    with _usage_lock:
        hit = _usage.get(username)
        if hit:
            _usage[username] = (hit[0], max(0, hit[1] + delta))
    changed(username)


def invalidate(username: str):
    with _usage_lock:
        _usage.pop(username, None)
    changed(username)


# --- indice de archivos por usuario (para Buscar, Recientes y Fotos) ------------
# Recorrer todo el disco en cada peticion es lento en la Pi con muchas fotos. Se guarda
# la lista de todo lo que hay durante un rato y se descarta en cuanto algo cambia.
_tree = {}
_tree_lock = threading.Lock()
TREE_TTL = 120


def changed(username: str):
    """Avisa de que algo ha cambiado en la unidad del usuario (vacia el indice)."""
    with _tree_lock:
        _tree.pop(username, None)


def tree(username: str) -> list[tuple]:
    """Lista de (ruta_relativa, nombre, es_carpeta, tamano, mtime) de todo lo visible."""
    with _tree_lock:
        hit = _tree.get(username)
        if hit and hit[0] > time.time():
            return hit[1]
    root = STORAGE / username
    out, stack, base = [], [str(root)], len(str(root)) + 1
    while stack:
        d = stack.pop()
        try:
            with os.scandir(d) as it:
                for e in it:
                    if e.name.startswith("."):
                        continue
                    try:
                        isdir = e.is_dir(follow_symlinks=False)
                        if not isdir and not e.is_file(follow_symlinks=False):
                            continue
                        st = e.stat(follow_symlinks=False)
                    except OSError:
                        continue
                    if isdir:
                        stack.append(e.path)
                    out.append((e.path[base:].replace(os.sep, "/"), e.name, isdir,
                                0 if isdir else st.st_size, st.st_mtime))
        except OSError:
            continue
    with _tree_lock:
        _tree[username] = (time.time() + TREE_TTL, out)
    return out


def tree_entry(t: tuple) -> dict:
    rel, name, isdir, size, mtime = t
    return {"name": name, "path": rel, "dir": isdir, "size": size, "mtime": mtime, "kind": kind(name, isdir)}


# --- miniaturas --------------------------------------------------------------
_thumb_sem = threading.Semaphore(2)  # se ajusta con el perfil de maquina (Ajustes)


def set_thumb_workers(n: int):
    global _thumb_sem
    _thumb_sem = threading.Semaphore(max(1, int(n)))


def thumbnail(p: Path, size=320) -> Path | None:
    if p.suffix.lower() not in THUMB_EXT:
        return None
    st = p.stat()
    key = hashlib.sha1(f"{p}|{st.st_mtime}|{st.st_size}|{size}".encode()).hexdigest()
    out = CACHE / "thumbs" / key[:2] / f"{key}.jpg"
    if out.exists():
        return out
    from PIL import Image, ImageOps
    with _thumb_sem:
        if out.exists():
            return out
        out.parent.mkdir(parents=True, exist_ok=True)
        try:
            with Image.open(p) as im:
                im.draft("RGB", (size * 2, size * 2))  # JPEG: decodifica reducido (rapido)
                im = ImageOps.exif_transpose(im)
                im.thumbnail((size, size))
                if im.mode not in ("RGB", "L"):
                    im = im.convert("RGB")
                tmp = out.with_suffix(".tmp")
                im.save(tmp, "JPEG", quality=78)
                os.replace(tmp, out)
        except Exception:
            return None
    return out
