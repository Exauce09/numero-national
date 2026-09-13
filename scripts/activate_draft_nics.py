#!/usr/bin/env python3
"""Attribue un NIC officiel aux citoyens DRAFT sans NIC (sans forcer les doublons)."""

from __future__ import annotations

import json
import sys

import httpx

BASE = "http://127.0.0.1:8000"
# Compte avec registry:citizen:validate
ADMIN_EMAIL = "admin.recensement@example.gov"
ADMIN_PASSWORD = "CensusAdmin123!"
# Fallback officier état civil si admin census absent
FALLBACK = ("officier.etatcivil@example.gov", "CivilOfficer123!")
# Superviseur recensement
FALLBACK2 = ("supervisor.recensement@example.gov", "CensusSupervisor123!")


def login(client: httpx.Client, email: str, password: str) -> str | None:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    if r.status_code >= 400:
        return None
    return r.json().get("access_token")


def main() -> int:
    with httpx.Client(base_url=BASE, timeout=60.0) as client:
        tok = None
        for email, pwd in [(ADMIN_EMAIL, ADMIN_PASSWORD), FALLBACK, FALLBACK2]:
            tok = login(client, email, pwd)
            if tok:
                print(f"logged_in_as={email}")
                break
        if not tok:
            print("FAIL: login", file=sys.stderr)
            return 1
        h = {"Authorization": f"Bearer {tok}", "Accept": "application/json"}

        items: list[dict] = []
        page = 1
        total = 0
        while True:
            r = client.get(
                "/api/v1/registry/citizens",
                params={"page": page, "page_size": 100},
                headers=h,
            )
            if r.status_code >= 400:
                print(f"FAIL list: {r.status_code} {r.text[:200]}", file=sys.stderr)
                return 1
            body = r.json()
            total = int(body.get("total") or 0)
            batch = body.get("items") or []
            items.extend(batch)
            if len(items) >= total or not batch:
                break
            page += 1
            if page > 50:
                break

        drafts = [
            c
            for c in items
            if (c.get("status") or "").upper() in {"DRAFT", "PENDING_VALIDATION"}
            and not c.get("nic")
        ]
        print(f"citizens_total={total} drafts_sans_nic={len(drafts)}")

        ok = 0
        blocked = 0
        errors = 0
        samples: list[dict] = []
        for c in drafts:
            cid = c["id"]
            name = f"{c.get('family_name')} {c.get('given_names')}"
            v = client.post(f"/api/v1/registry/citizens/{cid}/validate", headers=h)
            if v.status_code < 400:
                nic = (v.json() or {}).get("nic")
                ok += 1
                if len(samples) < 8:
                    samples.append({"name": name, "nic": nic})
                print(f"  OK {name} → {nic}")
            elif v.status_code == 409:
                blocked += 1
                print(f"  BLOCKED doublon {name}: {v.text[:120]}")
            else:
                errors += 1
                print(f"  ERR {name}: {v.status_code} {v.text[:120]}")

        print(
            json.dumps(
                {
                    "activated": ok,
                    "blocked_duplicates": blocked,
                    "errors": errors,
                    "samples": samples,
                },
                ensure_ascii=False,
            )
        )
        return 0 if errors == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
