#!/usr/bin/env python3
"""Approuve + promeut (avec NIC) toutes les fiches SYNCED/APPROVED restantes."""

from __future__ import annotations

import json
import sys

import httpx

BASE = "http://127.0.0.1:8000"
SUP = ("supervisor.recensement@example.gov", "CensusSupervisor123!")
ADMIN = ("admin.recensement@example.gov", "CensusAdmin123!")


def login(client: httpx.Client, email: str, password: str) -> str | None:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    if r.status_code >= 400:
        return None
    return r.json().get("access_token")


def main() -> int:
    with httpx.Client(base_url=BASE, timeout=90.0) as client:
        tok = login(client, *ADMIN) or login(client, *SUP)
        if not tok:
            print("FAIL login", file=sys.stderr)
            return 1
        h = {"Authorization": f"Bearer {tok}", "Accept": "application/json"}

        camps = client.get("/api/v1/census/campaigns", headers=h)
        camps.raise_for_status()
        campaigns = camps.json()
        print(f"campaigns={len(campaigns)}")

        approved = promoted = failed = skipped = 0
        details: list[dict] = []

        for camp in campaigns:
            cid = camp["id"]
            code = camp.get("code")
            for status in ("SYNCED", "APPROVED"):
                rows = client.get(
                    f"/api/v1/census/campaigns/{cid}/records",
                    params={"status": status, "limit": 500},
                    headers=h,
                )
                if rows.status_code >= 400:
                    print(f"  skip list {code}/{status}: {rows.status_code}")
                    continue
                for r in rows.json() or []:
                    rid = r["id"]
                    name = f"{r.get('family_name')} {r.get('given_names')}"
                    if status == "SYNCED":
                        a = client.post(
                            f"/api/v1/census/records/{rid}/approve",
                            headers=h,
                            json={"note": "sync site globale"},
                        )
                        if a.status_code >= 400:
                            failed += 1
                            details.append({"name": name, "step": "approve", "err": a.text[:120]})
                            continue
                        approved += 1
                    p = client.post(
                        f"/api/v1/census/records/{rid}/promote",
                        headers=h,
                        json={"assign_nic": True},
                    )
                    if p.status_code >= 400:
                        failed += 1
                        details.append({"name": name, "step": "promote", "err": p.text[:160]})
                        continue
                    body = p.json()
                    if body.get("already_promoted"):
                        skipped += 1
                    else:
                        promoted += 1
                    details.append(
                        {
                            "name": name,
                            "nic": body.get("nic"),
                            "already": body.get("already_promoted"),
                            "nic_error": body.get("nic_error"),
                        }
                    )

        print(
            json.dumps(
                {
                    "approved": approved,
                    "promoted": promoted,
                    "already": skipped,
                    "failed": failed,
                    "sample": details[:12],
                },
                ensure_ascii=False,
            )
        )
        return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
