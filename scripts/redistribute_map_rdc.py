#!/usr/bin/env python3
"""Redistribute household map points across RDC provinces (fix Kinshasa cluster)."""

from __future__ import annotations

import hashlib
import os
import sys

import psycopg

DSN = os.getenv(
    "DATABASE_URL",
    "postgresql://nic_admin:change-me-strong-db-password@127.0.0.1:5432/nic_core",
)

PROVINCE_COORDS: dict[str, tuple[float, float]] = {
    "01": (-4.3276, 15.3136),
    "kinshasa": (-4.3276, 15.3136),
    "03": (-5.0410, 18.8160),
    "kwango": (-5.0410, 18.8160),
    "04": (-5.8160, 13.4500),
    "kongo-central": (-5.8160, 13.4500),
    "kongo central": (-5.8160, 13.4500),
    "06": (-5.9000, 22.4000),
    "kasai": (-5.9000, 22.4000),
    "07": (-2.1500, 22.4667),
    "sankuru": (-2.1500, 22.4667),
    "08": (-5.8960, 22.4170),
    "kasai-central": (-5.8960, 22.4170),
    "09": (-6.1333, 24.4833),
    "lomami": (-6.1333, 24.4833),
    "10": (-11.6647, 27.4794),
    "haut-katanga": (-11.6647, 27.4794),
    "11": (-10.7167, 25.4667),
    "lualaba": (-10.7167, 25.4667),
    "12": (-8.7333, 24.9833),
    "haut-lomami": (-8.7333, 24.9833),
    "13": (-2.5000, 28.8667),
    "sud-kivu": (-2.5000, 28.8667),
    "14": (-2.9500, 25.9500),
    "maniema": (-2.9500, 25.9500),
    "15": (-1.6780, 29.2220),
    "nord-kivu": (-1.6780, 29.2220),
    "16": (4.2833, 21.0167),
    "nord-ubangi": (4.2833, 21.0167),
}


def norm(s: str) -> str:
    s = s.strip().lower().replace("_", "-")
    for a, b in (
        ("é", "e"),
        ("è", "e"),
        ("ê", "e"),
        ("à", "a"),
        ("î", "i"),
        ("ô", "o"),
        ("û", "u"),
        ("ç", "c"),
        ("ï", "i"),
        ("ä", "a"),
    ):
        s = s.replace(a, b)
    return s


def coords_for(hint: str | None) -> tuple[float, float] | None:
    if not hint:
        return None
    key = norm(str(hint))
    if key in PROVINCE_COORDS:
        return PROVINCE_COORDS[key]
    for part in key.replace("(", " ").replace(")", " ").replace("—", " ").split():
        if part.isdigit() and len(part) <= 2:
            part = part.zfill(2)
            if part in PROVINCE_COORDS:
                return PROVINCE_COORDS[part]
    for name, coords in PROVINCE_COORDS.items():
        if name.isdigit():
            continue
        if name in key or key in name:
            return coords
    return None


def jitter(lat: float, lng: float, salt: str) -> tuple[float, float]:
    h = int(hashlib.md5(salt.encode("utf-8")).hexdigest()[:8], 16) % 10_000
    dlat = ((h % 100) - 50) / 900.0
    dlng = (((h // 100) % 100) - 50) / 900.0
    return lat + dlat, lng + dlng


def main() -> int:
    print(f"dsn_host={DSN.split('@')[-1]}")
    with psycopg.connect(DSN) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT h.id::text, h.local_id, h.address_line, h.latitude, h.longitude,
                       r.payload->>'province_origine' AS prov,
                       r.payload->>'province_code' AS pcode
                FROM recensement.households h
                LEFT JOIN recensement.census_records r ON r.household_id = h.id
                """
            )
            rows = cur.fetchall()
            print(f"scanned_rows={len(rows)}")
            seen_hh: set[str] = set()
            updated = 0
            skipped_no_prov = 0
            for hid, local_id, address, lat, lng, prov, pcode in rows:
                if hid in seen_hh:
                    continue
                seen_hh.add(hid)
                hint = pcode or prov or address
                base = coords_for(str(hint) if hint else None)
                if not base:
                    skipped_no_prov += 1
                    continue
                near_kin = (
                    lat is not None
                    and lng is not None
                    and abs(float(lat) + 4.3276) < 0.6
                    and abs(float(lng) - 15.3136) < 0.6
                )
                lid = str(local_id or "")
                is_batch = lid.startswith("batch") or "batch" in lid
                if not (near_kin or is_batch or lat is None or lng is None):
                    continue
                nlat, nlng = jitter(base[0], base[1], lid or hid)
                cur.execute(
                    """
                    UPDATE recensement.households
                    SET latitude = %s,
                        longitude = %s,
                        address_source = COALESCE(address_source, 'manual')
                    WHERE id = %s::uuid
                    """,
                    (nlat, nlng, hid),
                )
                updated += 1
            conn.commit()
            print(f"updated_households={updated} unique_hh={len(seen_hh)} skipped_no_prov={skipped_no_prov}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
