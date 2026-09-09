"""Fetch named highways per Kinshasa commune from OpenStreetMap (Overpass).

Writes:
  scripts/kinshasa_avenues_osm.json
  apps/api/domains/geography/kinshasa_avenues_data.py
"""

from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = Path(__file__).resolve().parent / "kinshasa_avenues_osm.json"
OUT_PY = ROOT / "apps" / "api" / "domains" / "geography" / "kinshasa_avenues_data.py"

COMMUNES = [
    "Gombe",
    "Kinshasa",
    "Barumbu",
    "Kintambo",
    "Lingwala",
    "Ngaliema",
    "Kasa-Vubu",
    "Kalamu",
    "Ngiri-Ngiri",
    "Bandalungwa",
    "Bumbu",
    "Makala",
    "Selembao",
    "Lemba",
    "Mont-Ngafula",
    "Kisenso",
    "Limete",
    "Matete",
    "Ngaba",
    "Ndjili",
    "Kimbanseke",
    "Masina",
    "Nsele",
    "Maluku",
]

# OSM sometimes uses alternate spellings for admin areas
COMMUNE_ALIASES: dict[str, list[str]] = {
    "Ndjili": ["Ndjili", "N'Djili", "N'djili"],
    "Kasa-Vubu": ["Kasa-Vubu", "Kasavubu", "Kasa Vubu"],
    "Ngiri-Ngiri": ["Ngiri-Ngiri", "Ngiri Ngiri"],
    "Mont-Ngafula": ["Mont-Ngafula", "Mont Ngafula"],
    "Nsele": ["Nsele", "N'Sele", "N'sele"],
}

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
UA = "NumeroNational/1.0 (Kinshasa avenue seed; offline census geo)"


def _norm_key(s: str) -> str:
    s = s.strip().lower()
    s = s.replace("’", "'").replace("`", "'")
    s = re.sub(r"\s+", " ", s)
    return s


def classify_name(name: str) -> tuple[str, str] | None:
    """Return (voie_type, clean_name) or None if unusable."""
    raw = name.strip()
    if not raw or len(raw) < 3:
        return None
    if re.fullmatch(r"[\d\s\-./]+", raw):
        return None
    m = re.match(
        r"^(avenue|av\.?|rue|r\.?|boulevard|bd\.?|boul\.?)\s+(.+)$",
        raw,
        flags=re.I,
    )
    if m:
        prefix = m.group(1).lower().rstrip(".")
        rest = m.group(2).strip(" -")
        if prefix.startswith("av"):
            vt = "AVENUE"
        elif prefix.startswith("r"):
            vt = "RUE"
        else:
            vt = "AVENUE"
        if not rest:
            return None
        return vt, rest
    return "AVENUE", raw


def overpass(query: str) -> dict:
    data = urllib.parse.urlencode({"data": query}).encode()
    last_err: Exception | None = None
    for mirror in OVERPASS_MIRRORS:
        for attempt in range(3):
            try:
                req = urllib.request.Request(
                    mirror,
                    data=data,
                    headers={"User-Agent": UA, "Accept": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=180) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except Exception as exc:  # noqa: BLE001
                last_err = exc
                time.sleep(5 + attempt * 8)
        time.sleep(3)
    raise RuntimeError(last_err)


def query_commune(commune: str) -> list[dict]:
    aliases = COMMUNE_ALIASES.get(commune, [commune])
    name_or = "|".join(re.escape(a) for a in aliases)
    q = f"""
[out:json][timeout:180];
area["name"="Kinshasa"]["boundary"="administrative"]["admin_level"="4"]->.kin;
area["name"~"^({name_or})$"]["boundary"="administrative"](area.kin)->.c;
(
  way["highway"]["name"](area.c);
);
out tags;
"""
    payload = overpass(q)
    return payload.get("elements") or []


def elements_to_voies(elements: list[dict]) -> tuple[list[tuple[str, str]], list[dict]]:
    seen: set[str] = set()
    voies: list[tuple[str, str]] = []
    raw_rows: list[dict] = []
    for el in elements:
        tags = el.get("tags") or {}
        name = tags.get("name")
        if not name:
            continue
        classified = classify_name(name)
        if not classified:
            continue
        vt, vn = classified
        key = f"{vt}|{_norm_key(vn)}"
        if key in seen:
            continue
        seen.add(key)
        voies.append((vt, vn))
        raw_rows.append(
            {
                "voie_type": vt,
                "name": vn,
                "osm_name": name,
                "highway": tags.get("highway"),
            }
        )
    voies.sort(key=lambda x: (0 if x[0] == "AVENUE" else 1, _norm_key(x[1])))
    return voies, raw_rows


def write_outputs(by_commune: dict[str, list[tuple[str, str]]], inventory: dict[str, list[dict]]) -> None:
    OUT_JSON.write_text(
        json.dumps(
            {
                "source": "OpenStreetMap Overpass",
                "city": "Kinshasa",
                "communes": inventory,
                "counts": {k: len(v) for k, v in by_commune.items()},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    lines = [
        '"""Avenues / rues Kinshasa extraites d\'OpenStreetMap (par commune).',
        "",
        "Généré par scripts/fetch_kinshasa_avenues_osm.py — ne pas éditer à la main",
        "sauf correction ciblée. Re-générer puis force seed géo.",
        '"""',
        "",
        "from __future__ import annotations",
        "",
        "# commune -> [(voie_type, name), ...]",
        "KINSHASA_AVENUES_BY_COMMUNE: dict[str, list[tuple[str, str]]] = {",
    ]
    for commune, voies in by_commune.items():
        lines.append(f"    {commune!r}: [")
        for vt, vn in voies:
            lines.append(f"        ({vt!r}, {vn!r}),")
        lines.append("    ],")
    lines.append("}")
    lines.append("")
    OUT_PY.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("Wrote", OUT_JSON)
    print("Wrote", OUT_PY)
    total = sum(len(v) for v in by_commune.values())
    nonempty = sum(1 for v in by_commune.values() if v)
    print(f"TOTAL entries: {total} across {nonempty}/{len(by_commune)} communes")


def main() -> None:
    by_commune: dict[str, list[tuple[str, str]]] = {c: [] for c in COMMUNES}
    inventory: dict[str, list[dict]] = {c: [] for c in COMMUNES}

    if OUT_JSON.exists():
        try:
            prev = json.loads(OUT_JSON.read_text(encoding="utf-8-sig"))
            for commune, rows in (prev.get("communes") or {}).items():
                if commune not in by_commune:
                    continue
                voies = [(r["voie_type"], r["name"]) for r in rows if r.get("name")]
                if voies:
                    by_commune[commune] = voies
                    inventory[commune] = rows
                    print(f"resume keep {commune}: {len(voies)}")
        except Exception as exc:  # noqa: BLE001
            print("resume skip:", exc)

    for i, commune in enumerate(COMMUNES):
        if by_commune.get(commune):
            print(f"[{i+1}/{len(COMMUNES)}] {commune} skip (already {len(by_commune[commune])})")
            continue
        print(f"[{i+1}/{len(COMMUNES)}] {commune}...")
        try:
            elements = query_commune(commune)
            voies, raw_rows = elements_to_voies(elements)
            by_commune[commune] = voies
            inventory[commune] = raw_rows
            print(f"  -> {len(voies)} voies uniques")
        except Exception as exc:  # noqa: BLE001
            print(f"  FAIL {commune}: {exc}")
        write_outputs(by_commune, inventory)
        time.sleep(8)

    write_outputs(by_commune, inventory)


if __name__ == "__main__":
    main()
