"""Ajustes generales de DrivePanel (los cambia el administrador en Ajustes).

El perfil de maquina decide cuanto trabajo se hace a la vez: subidas simultaneas,
tamano de cada trozo de subida y miniaturas que se generan a la vez. En "Personalizado"
cada valor se elige a mano.
"""
import os, platform
from . import db

PROFILES = {
    "pi3": {"name": "Raspberry Pi 3", "desc": "O Pi 2 / Zero 2. Va justa: una cosa cada vez.",
            "upload_parallel": 1, "chunk_mb": 16, "thumb_workers": 1},
    "pi4": {"name": "Raspberry Pi 4", "desc": "También Pi 400 y Compute Module 4.",
            "upload_parallel": 2, "chunk_mb": 32, "thumb_workers": 2},
    "pi5": {"name": "Raspberry Pi 5", "desc": "Más potente: aguanta más trabajo a la vez.",
            "upload_parallel": 3, "chunk_mb": 32, "thumb_workers": 3},
    "pc": {"name": "PC o servidor", "desc": "Ordenador, mini PC, NAS o máquina virtual (Proxmox, Debian, Ubuntu…).",
           "upload_parallel": 4, "chunk_mb": 64, "thumb_workers": 4},
    "custom": {"name": "Personalizado", "desc": "Eliges tú cada valor."},
}
ACCENTS = ("blue", "green", "purple", "orange", "red", "teal", "pink")
LIMITS = {"upload_parallel": (1, 6), "chunk_mb": (8, 64), "thumb_workers": (1, 4)}
CHUNKS = (8, 16, 32, 64)


def _get(key, default=None):
    r = db.q1("SELECT value FROM settings WHERE key=?", key)
    return r["value"] if r else default


def _set(key, value):
    db.run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
           key, str(value))


def _clamp(key, v, default):
    lo, hi = LIMITS[key]
    try:
        v = int(v)
    except (TypeError, ValueError):
        return default
    return min(hi, max(lo, v))


# --- deteccion de la maquina ------------------------------------------------------
def _read(path):
    try:
        with open(path, "rb") as f:
            return f.read().replace(b"\0", b"").decode(errors="ignore").strip()
    except OSError:
        return ""


def _ram():
    try:
        for line in open("/proc/meminfo"):
            if line.startswith("MemTotal:"):
                return int(line.split()[1]) * 1024
    except OSError:
        pass
    return 0


_detected = None


def detect() -> dict:
    global _detected
    if _detected:
        return _detected
    model = _read("/proc/device-tree/model") or _read("/sys/firmware/devicetree/base/model")
    vendor = _read("/sys/class/dmi/id/sys_vendor")
    product = _read("/sys/class/dmi/id/product_name")
    cpus, ram, arch = os.cpu_count() or 1, _ram(), platform.machine()
    low = f"{model} {vendor} {product}".lower()
    virtual = any(x in low for x in ("qemu", "kvm", "vmware", "virtualbox", "standard pc", "hyper-v", "xen", "bochs"))
    if "raspberry pi 5" in low:
        suggest = "pi5"
    elif any(x in low for x in ("raspberry pi 4", "raspberry pi 400", "compute module 4")):
        suggest = "pi4"
    elif "raspberry pi" in low:
        suggest = "pi3"
    elif arch.startswith(("arm", "aarch")) and ram and ram < 3 * 1024**3:
        suggest = "pi3"
    elif arch.startswith(("arm", "aarch")) and cpus <= 4:
        suggest = "pi4"
    else:
        suggest = "pc"
    name = model or " ".join(x for x in (vendor, product) if x) or arch
    if virtual and "virtual" not in name.lower():
        name += " (máquina virtual)"
    _detected = {"name": name, "cpus": cpus, "ram": ram, "arch": arch, "virtual": virtual, "suggest": suggest}
    return _detected


# --- lectura / escritura ----------------------------------------------------------
def machine() -> str:
    m = _get("machine")
    return m if m in PROFILES else detect()["suggest"]


def custom() -> dict:
    d = PROFILES["pi4"]
    return {k: _clamp(k, _get("custom_" + k), d[k]) for k in LIMITS}


def effective() -> dict:
    m = machine()
    if m == "custom":
        return custom()
    return {k: PROFILES[m][k] for k in LIMITS}


def accent() -> str:
    a = _get("accent", "blue")
    return a if a in ACCENTS else "blue"


def public() -> dict:
    """Lo que necesita la web de cualquier usuario."""
    e = effective()
    return {"upload_parallel": e["upload_parallel"], "chunk_mb": e["chunk_mb"], "accent": accent()}


def admin_view() -> dict:
    return {"machine": machine(), "machine_saved": _get("machine") in PROFILES, "custom": custom(),
            "effective": effective(), "accent": accent(), "detected": detect(),
            "profiles": PROFILES, "accents": ACCENTS, "chunks": CHUNKS, "limits": LIMITS}


def update(machine_=None, custom_=None, accent_=None):
    if machine_ is not None:
        if machine_ not in PROFILES:
            raise ValueError("Perfil de máquina no válido")
        _set("machine", machine_)
    if custom_:
        for k, v in custom_.items():
            if k not in LIMITS:
                raise ValueError("Ajuste no válido")
            lo, hi = LIMITS[k]
            if not isinstance(v, int) or not lo <= v <= hi or (k == "chunk_mb" and v not in CHUNKS):
                raise ValueError("Valor fuera de rango")
            _set("custom_" + k, v)
    if accent_ is not None:
        if accent_ not in ACCENTS:
            raise ValueError("Color no válido")
        _set("accent", accent_)
    apply()


def apply():
    """Aplica en el servidor lo que depende del perfil (miniaturas a la vez)."""
    from .fsutil import set_thumb_workers
    set_thumb_workers(effective()["thumb_workers"])
