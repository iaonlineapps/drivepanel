import hashlib, hmac, os, secrets, sqlite3, threading, time
from .config import CONFIG, ADMIN_USER, ADMIN_PASSWORD, DEFAULT_QUOTA_GB, SESSION_DAYS

DB_PATH = CONFIG / "drivepanel.db"
_local = threading.local()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  pw_hash TEXT NOT NULL, is_admin INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', quota INTEGER DEFAULT 0, created REAL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER, expires REAL);
CREATE TABLE IF NOT EXISTS trash(
  id INTEGER PRIMARY KEY, username TEXT, orig_path TEXT, trash_name TEXT,
  is_dir INTEGER, size INTEGER, deleted_at REAL);
CREATE TABLE IF NOT EXISTS shares(
  id INTEGER PRIMARY KEY, owner TEXT, path TEXT, token TEXT UNIQUE,
  target TEXT, created REAL, expires REAL);
CREATE TABLE IF NOT EXISTS activity(
  id INTEGER PRIMARY KEY, username TEXT, action TEXT, path TEXT,
  size INTEGER DEFAULT 0, at REAL);
CREATE INDEX IF NOT EXISTS activity_user_at ON activity(username, at);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
"""


def conn():
    c = getattr(_local, "c", None)
    if c is None:
        c = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL")
        _local.c = c
    return c


def q(sql, *args):
    return conn().execute(sql, args).fetchall()


def q1(sql, *args):
    return conn().execute(sql, args).fetchone()


def run(sql, *args):
    return conn().execute(sql, args)


# --- contrasenas -----------------------------------------------------------
ITER = 120_000


def hash_pw(pw: str) -> str:
    salt = os.urandom(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, ITER)
    return f"pbkdf2${ITER}${salt.hex()}${h.hex()}"


def check_pw(pw: str, stored: str) -> bool:
    try:
        _, it, salt, h = stored.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), int(it))
        return hmac.compare_digest(calc.hex(), h)
    except Exception:
        return False


# cache para WebDAV (cada peticion trae usuario/contrasena)
_auth_cache = {}


def authenticate(username: str, password: str):
    """Devuelve la fila del usuario si es correcto y esta aprobado."""
    key = (username.lower(), hashlib.sha256(password.encode()).hexdigest())
    hit = _auth_cache.get(key)
    if hit and hit[0] > time.time():
        u = q1("SELECT * FROM users WHERE id=?", hit[1])
        if u and u["status"] == "approved":
            return u
    u = q1("SELECT * FROM users WHERE username=?", username)
    if not u or not check_pw(password, u["pw_hash"]):
        return None
    if u["status"] == "approved":
        _auth_cache[key] = (time.time() + 600, u["id"])
    return u


def clear_auth_cache():
    _auth_cache.clear()


# --- sesiones ----------------------------------------------------------------
def new_session(user_id: int) -> str:
    tok = secrets.token_urlsafe(32)
    run("INSERT INTO sessions VALUES(?,?,?)", tok, user_id, time.time() + SESSION_DAYS * 86400)
    return tok


def session_user(tok: str):
    if not tok:
        return None
    return q1("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id "
              "WHERE s.token=? AND s.expires>? AND u.status='approved'", tok, time.time())


def init():
    conn().executescript(SCHEMA)
    # migraciones de bases de datos creadas con versiones anteriores
    cols = {r["name"] for r in q("PRAGMA table_info(shares)")}
    if "expires" not in cols:
        run("ALTER TABLE shares ADD COLUMN expires REAL")
    run("DELETE FROM sessions WHERE expires<?", time.time())
    run("DELETE FROM activity WHERE at<?", time.time() - 180 * 86400)  # se guarda medio ano
    if ADMIN_USER and ADMIN_PASSWORD and not q1("SELECT id FROM users WHERE username=?", ADMIN_USER):
        run("INSERT INTO users(username,pw_hash,is_admin,status,quota,created) VALUES(?,?,1,'approved',0,?)",
            ADMIN_USER, hash_pw(ADMIN_PASSWORD), time.time())


def default_quota() -> int:
    return int(DEFAULT_QUOTA_GB * 1024**3)


# --- registro de actividad (para el panel) ------------------------------------
def log(username: str, action: str, path: str = "", size: int = 0):
    """Apunta lo que hace cada usuario: upload, mkdir, rename, move, delete, restore, purge, share."""
    try:
        run("INSERT INTO activity(username,action,path,size,at) VALUES(?,?,?,?,?)",
            username, action, path, int(size or 0), time.time())
    except sqlite3.Error:
        pass  # el registro nunca debe romper una operacion

