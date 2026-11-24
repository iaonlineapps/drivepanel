"""Avisos de disco lleno.

Cada minuto se mira cuanto ocupa el disco donde se guardan los archivos. Hay dos
niveles: "casi lleno" (85 % por defecto) y "lleno" (95 %). Cuando se pasa a un nivel
mas alto se avisa UNA vez: aviso en la web (siempre) y mensaje de Telegram (solo si el
administrador ha puesto su bot en Ajustes). No se repite hasta que el disco baja y
vuelve a subir. Cuando vuelve a haber sitio se manda un ultimo mensaje.

El token del bot se guarda en el servidor y nunca se envia a la web.
"""
import json, re, shutil, time, urllib.error, urllib.parse, urllib.request
from . import db
from .config import STORAGE
from .version import VERSION

DEFAULTS = {"enabled": 1, "warn": 85, "crit": 95}
WARN_RANGE, CRIT_RANGE = (50, 98), (60, 99)
MARGIN = 2  # hay que bajar 2 puntos por debajo del limite para que se pueda volver a avisar
TOKEN_RE = re.compile(r"^\d{5,15}:[A-Za-z0-9_-]{30,64}$")
CHAT_RE = re.compile(r"^(-?\d{1,20}|@[A-Za-z0-9_]{5,32})$")


def _get(key, default=None):
    r = db.q1("SELECT value FROM settings WHERE key=?", "alert_" + key)
    return r["value"] if r else default


def _set(key, value):
    db.run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
           "alert_" + key, str(value))


def _del(key):
    db.run("DELETE FROM settings WHERE key=?", "alert_" + key)


def _int(key):
    try:
        return int(_get(key, DEFAULTS[key]))
    except (TypeError, ValueError):
        return DEFAULTS[key]


def config() -> dict:
    return {"enabled": bool(_int("enabled")), "warn": _int("warn"), "crit": _int("crit")}


# --- estado del disco ------------------------------------------------------------
def disk() -> dict:
    du = shutil.disk_usage(STORAGE)
    # lo que NO queda libre (incluye lo reservado del sistema): es lo que importa para subir
    pct = (du.total - du.free) / du.total * 100 if du.total else 0
    return {"total": du.total, "used": du.used, "free": du.free, "pct": round(pct, 1)}


def _level(pct: float, c: dict, current: int) -> int:
    """Nivel segun el porcentaje. Para bajar de nivel hay que quedar MARGIN puntos por debajo
    (asi no avisa veinte veces si el disco esta justo en el limite)."""
    if pct >= c["crit"]:
        lvl = 2
    elif pct >= c["warn"]:
        lvl = 1
    else:
        lvl = 0
    if lvl < current:
        limit = c["crit"] if current == 2 else c["warn"]
        if pct > limit - MARGIN:
            lvl = current
    return lvl


def status() -> dict:
    """Aviso actual (lo que ve la web y la app del movil)."""
    c = config()
    lvl = _int_state("level") if c["enabled"] else 0
    d = disk()
    return {"level": lvl, "pct": d["pct"], "free": d["free"], "total": d["total"],
            "since": float(_get("since", 0) or 0), "warn": c["warn"], "crit": c["crit"]}


def _int_state(key):
    try:
        return int(_get(key, 0))
    except (TypeError, ValueError):
        return 0


def for_user(u) -> dict | None:
    """El aviso que tiene que ver este usuario: el administrador los ve todos; los demas
    usuarios solo el de disco lleno (porque ya no podran subir archivos)."""
    s = status()
    if not s["level"] or (s["level"] < 2 and not u["is_admin"]):
        return None
    return {"level": s["level"], "pct": s["pct"], "free": s["free"], "since": s["since"]}


def _fmt(b) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if b < 1024 or unit == "TB":
            return (f"{b:.1f}" if unit != "B" else str(int(b))).replace(".", ",") + " " + unit
        b /= 1024


def message(level: int, d: dict, c: dict) -> str:
    libre = _fmt(d["free"])
    pct = str(d["pct"]).replace(".", ",")
    if level == 2:
        return (f"🔴 DrivePanel: el disco está LLENO ({pct} %).\n"
                f"Solo quedan {libre} libres. Puede que no se puedan subir más archivos.\n"
                f"Borra lo que no necesites y vacía la papelera.")
    if level == 1:
        return (f"🟠 DrivePanel: el disco está casi lleno ({pct} %).\n"
                f"Quedan {libre} libres. Te aviso al llegar al {c['crit']} %.")
    return f"🟢 DrivePanel: ya vuelve a haber sitio en el disco ({pct} % usado, {libre} libres)."


def check() -> int:
    """Mira el disco y avisa si ha cambiado de nivel. Devuelve el nivel actual."""
    c = config()
    if not c["enabled"]:
        return 0
    d = disk()
    cur = _int_state("level")
    lvl = _level(d["pct"], c, cur)
    if lvl == cur:
        return lvl
    _set("level", lvl)
    _set("since", time.time())
    if tg_configured() and (lvl > cur or lvl == 0):
        try:
            send_telegram(message(lvl, d, c))
        except Exception:
            pass  # si Telegram falla, el aviso sigue saliendo en la web
    return lvl


# --- Telegram (opcional) ---------------------------------------------------------
def tg_token() -> str:
    return _get("tg_token", "") or ""


def tg_chat() -> str:
    return _get("tg_chat", "") or ""


def tg_configured() -> bool:
    return bool(tg_token() and tg_chat())


def _tg(token: str, method: str, params: dict) -> dict:
    if not TOKEN_RE.match(token or ""):
        raise ValueError("El token del bot no es válido. Cópialo entero de @BotFather")
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/{method}", data=data,
                                 headers={"User-Agent": f"DrivePanel/{VERSION}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            out = json.load(r)
    except urllib.error.HTTPError as e:
        try:
            desc = json.load(e).get("description", "")
        except Exception:
            desc = ""
        if e.code == 401:
            raise ValueError("Telegram no reconoce ese token. Cópialo otra vez de @BotFather")
        if e.code in (400, 403) and "chat" in desc.lower():
            raise ValueError("Telegram no encuentra ese chat. Escribe algo a tu bot y pulsa «Buscar mi chat»")
        if e.code == 403:
            raise ValueError("El bot no puede escribirte. Abre tu bot en Telegram y pulsa «Iniciar»")
        raise ValueError(f"Telegram ha respondido con un error ({e.code})")
    except OSError:
        raise ValueError("No se ha podido conectar con Telegram. ¿Tiene Internet el servidor?")
    if not out.get("ok"):
        raise ValueError("Telegram ha respondido con un error")
    return out


def send_telegram(text: str, token: str | None = None, chat: str | None = None):
    _tg(token or tg_token(), "sendMessage", {"chat_id": chat or tg_chat(), "text": text})


def find_chats(token: str | None = None) -> list[dict]:
    """Chats que han escrito al bot hace poco (para no tener que buscar el numero a mano)."""
    out = _tg(token or tg_token(), "getUpdates", {"limit": 50})
    seen = {}
    for upd in out.get("result", []):
        m = upd.get("message") or upd.get("channel_post") or upd.get("my_chat_member") or {}
        ch = m.get("chat") or {}
        if "id" not in ch:
            continue
        name = ch.get("title") or " ".join(x for x in (ch.get("first_name"), ch.get("last_name")) if x) \
            or ch.get("username") or str(ch["id"])
        seen[str(ch["id"])] = {"id": str(ch["id"]), "name": name, "type": ch.get("type", "")}
    return list(seen.values())[::-1]


# --- vista y cambios desde Ajustes -------------------------------------------------
def admin_view() -> dict:
    t = tg_token()
    return {**config(), "status": status(), "margin": MARGIN,
            "telegram": {"token_set": bool(t), "token_hint": ("…" + t[-4:]) if t else "", "chat": tg_chat()}}


def update(enabled=None, warn=None, crit=None, tg_token_=None, tg_chat_=None, tg_clear=False):
    c = config()
    w = c["warn"] if warn is None else warn
    k = c["crit"] if crit is None else crit
    if not (WARN_RANGE[0] <= w <= WARN_RANGE[1] and CRIT_RANGE[0] <= k <= CRIT_RANGE[1]):
        raise ValueError("Porcentaje fuera de rango")
    if w >= k:
        raise ValueError("El aviso de «casi lleno» tiene que ser menor que el de «lleno»")
    if tg_token_ is not None:
        tg_token_ = tg_token_.strip()
        if tg_token_ and not TOKEN_RE.match(tg_token_):
            raise ValueError("El token del bot no es válido. Cópialo entero de @BotFather")
    if tg_chat_ is not None:
        tg_chat_ = tg_chat_.strip()
        if tg_chat_ and not CHAT_RE.match(tg_chat_):
            raise ValueError("El chat tiene que ser un número (por ejemplo 123456789)")
    if enabled is not None:
        _set("enabled", int(bool(enabled)))
    _set("warn", w)
    _set("crit", k)
    if tg_clear:
        _del("tg_token")
        _del("tg_chat")
    if tg_token_:
        _set("tg_token", tg_token_)
    if tg_chat_ is not None:
        _set("tg_chat", tg_chat_) if tg_chat_ else _del("tg_chat")
    # con limites nuevos el nivel se vuelve a calcular desde cero (sin mensaje de "ya hay sitio")
    d = disk()
    new = _level(d["pct"], config(), 0) if config()["enabled"] else 0
    if new != _int_state("level"):
        _set("level", new)
        _set("since", time.time())
