import os
from pathlib import Path

DATA = Path(os.environ.get("DRIVE_DATA", "/data"))
STORAGE = DATA / "storage"      # archivos de cada usuario: storage/<usuario>
CONFIG = DATA / "config"        # base de datos y clave secreta
TRASH = DATA / "trash"          # papelera: trash/<usuario>
CACHE = DATA / "cache"          # miniaturas
TMP = DATA / "tmp"              # subidas en curso (en el disco, no en la SD)
ARCHIVE = DATA / "archivo"      # carpetas de cuentas eliminadas sin borrar sus archivos

DEFAULT_QUOTA_GB = float(os.environ.get("DEFAULT_QUOTA_GB", "0"))  # 0 = sin limite
ADMIN_USER = os.environ.get("ADMIN_USER", "").strip()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
SESSION_DAYS = 30
# 0 = nadie puede registrarse solo (el administrador crea las cuentas en Usuarios)
ALLOW_REGISTER = os.environ.get("ALLOW_REGISTER", "1").strip().lower() not in ("0", "no", "false")

for d in (STORAGE, CONFIG, TRASH, CACHE / "thumbs", TMP, ARCHIVE):
    d.mkdir(parents=True, exist_ok=True)
