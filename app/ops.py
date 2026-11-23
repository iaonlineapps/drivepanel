"""Operaciones compartidas por la web y por WebDAV (papelera y compartidos)."""
import os, secrets, time
from . import db
from .fsutil import user_root, trash_root, safe_path, clean_rel, dir_size, changed


def move_to_trash(username: str, rel: str) -> bool:
    """Mueve un archivo o carpeta de la unidad del usuario a su papelera."""
    root, troot = user_root(username), trash_root(username)
    rel = clean_rel(rel)
    p = safe_path(root, rel)
    if not rel or p == root or not os.path.lexists(p):
        return False
    isdir = p.is_dir()
    size = dir_size(p) if isdir else p.stat().st_size
    tname = f"{int(time.time()*1000)}_{secrets.token_hex(3)}_{p.name}"
    os.rename(p, troot / tname)
    db.run("INSERT INTO trash(username,orig_path,trash_name,is_dir,size,deleted_at) VALUES(?,?,?,?,?,?)",
           username, rel, tname, int(isdir), size, time.time())
    db.run("DELETE FROM shares WHERE owner=? AND (path=? OR path LIKE ?)", username, rel, rel + "/%")
    db.log(username, "delete", rel, size)
    changed(username)
    return True


def fix_shares(owner: str, old: str, new: str):
    """Tras renombrar o mover, los compartidos siguen apuntando al mismo elemento."""
    old, new = clean_rel(old), clean_rel(new)
    for s in db.q("SELECT id,path FROM shares WHERE owner=?", owner):
        if s["path"] == old or s["path"].startswith(old + "/"):
            db.run("UPDATE shares SET path=? WHERE id=?", new + s["path"][len(old):], s["id"])
    changed(owner)


def drop_shares(owner: str, rel: str):
    rel = clean_rel(rel)
    db.run("DELETE FROM shares WHERE owner=? AND (path=? OR path LIKE ?)", owner, rel, rel + "/%")
