"""Idiomas del servidor (mensajes de error y paginas de los enlaces publicos).

Usa los mismos archivos que la web: app/static/i18n/<idioma>.json, con
«texto en español» -> «traduccion». Si un texto no esta traducido sale en español.
Los mensajes con datos ({n}, {rel}...) se buscan con un patron, asi el codigo puede
seguir lanzando HTTPException(400, f"...") en español sin cambiar nada.
"""
import json, re
from pathlib import Path

LANGS = ("es", "en")
DEFAULT = "es"
_DIR = Path(__file__).parent / "static" / "i18n"
_dicts: dict[str, dict[str, str]] = {}
_patterns: dict[str, list] = {}


def _load(lang: str) -> dict:
    if lang not in _dicts:
        try:
            d = json.loads((_DIR / f"{lang}.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            d = {}
        _dicts[lang] = d
        pats = []
        for k, v in d.items():
            if "{" in k:
                names = re.findall(r"\{(\w+)\}", k)
                rx = re.escape(k)
                for n in names:
                    rx = rx.replace(re.escape("{" + n + "}"), f"(?P<{n}>.+?)", 1)
                try:
                    pats.append((len(re.sub(r"\{\w+\}", "", k)), re.compile("^" + rx + "$", re.S), v))
                except re.error:
                    pass
        # primero los patrones con mas texto fijo (asi «No existe: {rel}» gana a «{a} de {b}»)
        pats.sort(key=lambda p: -p[0])
        _patterns[lang] = [(rx, v) for _, rx, v in pats]
    return _dicts[lang]


def tr(text, lang: str, **kw) -> str:
    """Traduce un texto en español. Con kw rellena {huecos}; sin kw, si el texto ya
    viene con los datos dentro, lo reconoce por patron."""
    if not isinstance(text, str):
        return text
    if lang == DEFAULT or lang not in LANGS:
        return text.format(**kw) if kw else text
    d = _load(lang)
    if text in d:
        out = d[text]
        return out.format(**kw) if kw else out
    if not kw:
        for rx, v in _patterns[lang]:
            m = rx.match(text)
            if m:
                return v.format(**m.groupdict())
    return text.format(**kw) if kw else text


def norm(lang) -> str | None:
    lang = (lang or "").strip().lower()[:2]
    return lang if lang in LANGS else None


def lang_of(request) -> str:
    """Idioma de quien pregunta: el elegido en DrivePanel (cookie dp_lang, que la web
    pone segun la cuenta) o, si no hay, el del navegador (Accept-Language)."""
    c = norm(request.cookies.get("dp_lang"))
    if c:
        return c
    for part in request.headers.get("accept-language", "").split(","):
        l = norm(part.split(";")[0])
        if l:
            return l
    return DEFAULT
