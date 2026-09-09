"""Compact Kinshasa avenues: commune extracts + shared city-wide OSM fallback."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INV = Path(__file__).resolve().parent / "kinshasa_avenues_osm.json"
CITY_RAW = Path(__file__).resolve().parent / "_osm_kin_avenues_raw.json"
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


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower().replace("’", "'"))


def classify(name: str) -> tuple[str, str] | None:
    raw = name.strip()
    if not raw or len(raw) < 3:
        return None
    if re.fullmatch(r"[\d\s\-./]+", raw):
        return None
    m = re.match(
        r"^(avenue|av\.?|rue|r\.?|boulevard|bd\.?|boul\.?)\s+(.+)$",
        raw,
        re.I,
    )
    if m:
        p = m.group(1).lower().rstrip(".")
        rest = m.group(2).strip(" -")
        vt = "AVENUE" if p.startswith("av") or p.startswith("b") else "RUE"
        return (vt, rest) if rest else None
    return ("AVENUE", raw)


def uniq_voies(pairs: list[tuple[str, str]]) -> list[tuple[str, str]]:
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for vt, vn in pairs:
        key = f"{vt}|{norm(vn)}"
        if key in seen:
            continue
        seen.add(key)
        out.append((vt, vn))
    out.sort(key=lambda x: (0 if x[0] == "AVENUE" else 1, norm(x[1])))
    return out


def emit_list(name: str, voies: list[tuple[str, str]]) -> list[str]:
    lines = [f"{name}: list[tuple[str, str]] = ["]
    for vt, vn in voies:
        lines.append(f"    ({vt!r}, {vn!r}),")
    lines.append("]")
    return lines


def main() -> None:
    commune_exact: dict[str, list[tuple[str, str]]] = {}
    if INV.exists():
        inv = json.loads(INV.read_text(encoding="utf-8-sig"))
        sources = inv.get("sources") or {}
        for c, rows in (inv.get("communes") or {}).items():
            if sources.get(c) == "city_fallback":
                continue
            pairs = uniq_voies(
                [(r["voie_type"], r["name"]) for r in rows if r.get("name") and r.get("voie_type")]
            )
            if pairs:
                commune_exact[c] = pairs

    # Re-read original partial if sources missing
    if not commune_exact and INV.exists():
        inv = json.loads(INV.read_text(encoding="utf-8-sig"))
        counts = inv.get("counts") or {}
        for c, n in counts.items():
            if n and n < 400:  # heuristic: exact extracts are smaller than city list
                rows = (inv.get("communes") or {}).get(c) or []
                pairs = uniq_voies(
                    [(r["voie_type"], r["name"]) for r in rows if r.get("name") and r.get("voie_type")]
                )
                if pairs:
                    commune_exact[c] = pairs

    city: list[tuple[str, str]] = []
    if CITY_RAW.exists():
        raw = json.loads(CITY_RAW.read_text(encoding="utf-8-sig"))
        pairs = []
        for e in raw.get("elements") or []:
            name = (e.get("tags") or {}).get("name")
            if not name:
                continue
            cl = classify(name)
            if cl:
                pairs.append(cl)
        city = uniq_voies(pairs)

    # Prefer known good exact communes from first fetch
    for c in ("Gombe", "Kintambo", "Kasa-Vubu", "Kalamu"):
        if c not in commune_exact and INV.exists():
            rows = (json.loads(INV.read_text(encoding="utf-8-sig")).get("communes") or {}).get(c) or []
            # If it was overwritten with city fallback, skip if too large
            pairs = uniq_voies(
                [(r["voie_type"], r["name"]) for r in rows if r.get("name") and r.get("voie_type")]
            )
            if pairs and len(pairs) < 400:
                commune_exact[c] = pairs

    lines = [
        '"""Avenues / rues Kinshasa (OpenStreetMap).',
        "",
        "- KINSHASA_CITY_AVENUES : ways name~Avenue dans Kinshasa (fallback).",
        "- KINSHASA_AVENUES_BY_COMMUNE : extracts par polygone commune quand disponibles.",
        "- avenues_for_commune(name) : extract commune ou fallback city.",
        '"""',
        "",
        "from __future__ import annotations",
        "",
    ]
    lines.extend(emit_list("KINSHASA_CITY_AVENUES", city))
    lines.append("")
    lines.append("KINSHASA_AVENUES_BY_COMMUNE: dict[str, list[tuple[str, str]]] = {")
    for c in sorted(commune_exact):
        lines.append(f"    {c!r}: [")
        for vt, vn in commune_exact[c]:
            lines.append(f"        ({vt!r}, {vn!r}),")
        lines.append("    ],")
    lines.append("}")
    lines.append("")
    lines.append("def avenues_for_commune(commune: str) -> list[tuple[str, str]]:")
    lines.append('    """Voies OSM pour une commune Kinshasa."""')
    lines.append("    exact = KINSHASA_AVENUES_BY_COMMUNE.get(commune)")
    lines.append("    if exact:")
    lines.append("        return list(exact)")
    lines.append("    return list(KINSHASA_CITY_AVENUES)")
    lines.append("")

    OUT_PY.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        "wrote",
        OUT_PY.name,
        OUT_PY.stat().st_size,
        "city",
        len(city),
        "exact communes",
        {k: len(v) for k, v in commune_exact.items()},
    )


if __name__ == "__main__":
    main()
