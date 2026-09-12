"""Scrape openalfa commune quartiers + sample streets for Kinshasa communes."""
from __future__ import annotations

import json
import re
import urllib.request
from html import unescape
from pathlib import Path


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", "replace")


def quartiers(slug: str) -> list[dict[str, str]]:
    html = fetch(f"https://rues-rd-congo.openalfa.com/{slug}")
    found: list[tuple[str, str]] = []
    for m in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>([^<]+)</a>', html):
        href, name = m.group(1), unescape(m.group(2)).strip()
        if not name:
            continue
        low = name.lower()
        if low in {slug, "kinshasa", "voir la carte", "villes"}:
            continue
        if not href.startswith("/"):
            continue
        if any(
            x in href
            for x in (
                "/rues/",
                "/contact",
                "/privacy",
                "/villes",
                "/autoroutes",
                "/lignes",
                "/ma-position",
                f"/{slug}/",
            )
        ):
            continue
        if href.strip("/") == slug:
            continue
        found.append((name, href))
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for name, href in found:
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({"name": name, "href": href})
    return out


def voies(href: str) -> list[str]:
    url = href if href.startswith("http") else f"https://rues-rd-congo.openalfa.com{href}"
    try:
        html = fetch(url)
    except Exception:
        return []
    names: list[str] = []
    for m in re.finditer(r'<a[^>]+href="/rues/[^"]+"[^>]*>(.*?)</a>', html, re.S):
        t = unescape(re.sub(r"<[^>]+>", "", m.group(1)))
        t = re.sub(r"\s+", " ", t).strip()
        if "," in t:
            t = t.split(",")[0].strip()
        if 2 <= len(t) <= 70:
            names.append(t)
    seen: set[str] = set()
    out: list[str] = []
    for n in names:
        k = n.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(n)
    return out[:40]


def main() -> None:
    data: dict = {}
    for slug in ["lemba", "barumbu", "lingwala", "gombe"]:
        qs = quartiers(slug)
        rows = []
        for q in qs:
            rows.append(
                {
                    "name": q["name"],
                    "href": q["href"],
                    "voies": voies(q["href"]),
                }
            )
        data[slug] = rows
        print(slug, len(rows), "quartiers")
    out = Path(__file__).resolve().parents[1] / "frontends" / "civil-officer" / "src" / "data" / "openalfa_kin_quartiers.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", out)


if __name__ == "__main__":
    main()
