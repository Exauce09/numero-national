"""Normalisation des libellés géographiques pour anti-doublons (orthographe)."""

from __future__ import annotations

import re
import unicodedata

_PREFIX_RE = re.compile(
    r"^(avenue|av\.?|rue|r\.?|boulevard|bd\.?|boul\.?|quartier|q\.?|"
    r"commune(\s+de)?|district(\s+de)?|localite|localité|cite|cité)\s+",
    re.IGNORECASE,
)


def normalize_geo_name(name: str) -> str:
    """Clé stable : ignore casse, accents, ponctuation, espaces et préfixes courants."""
    s = (name or "").strip().lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = _PREFIX_RE.sub("", s)
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s


def display_name(name: str) -> str:
    return " ".join((name or "").split()).strip()
