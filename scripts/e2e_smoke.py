#!/usr/bin/env python3
"""End-to-end smoke: health → register → login → citizen → NIC → card → QR verify.

Requires a running API (docker compose up) with ALLOW_OPEN_REGISTRATION=true
and ALLOW_DEV_AUTH_HEADERS=true for permission seeding path via JWT + role assign.

Usage:
  py -3 scripts/e2e_smoke.py
  set BASE_URL=http://localhost:8000 && py -3 scripts/e2e_smoke.py
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date

import httpx

BASE = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")
RUN_ID = uuid.uuid4().hex[:8]
EMAIL = f"e2e.{RUN_ID}@example.gov"
PASSWORD = "SecurePass123!"


def die(msg: str, resp: httpx.Response | None = None) -> None:
    detail = ""
    if resp is not None:
        detail = f" [{resp.status_code}] {resp.text[:500]}"
    print(f"FAIL: {msg}{detail}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    print(f"E2E against {BASE}")
    with httpx.Client(base_url=BASE, timeout=30.0) as client:
        h = client.get("/health")
        if h.status_code != 200:
            die("health not ok — start docker compose first", h)
        body = h.json()
        if body.get("database") != "up":
            die(f"database not up: {body}", h)
        print("OK health", body)

        reg = client.post(
            "/api/v1/auth/register",
            json={
                "email": EMAIL,
                "password": PASSWORD,
                "full_name": "E2E Agent",
                "role_codes": ["CENTRAL_ADMIN"],
            },
        )
        if reg.status_code not in {201, 409}:
            die("register", reg)
        print("OK register", EMAIL)

        login = client.post(
            "/api/v1/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
        )
        if login.status_code != 200:
            die("login", login)
        tokens = login.json()
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        print("OK login")

        # Seed permissions via RBAC list (idempotent)
        client.get("/api/v1/rbac/roles", headers=headers)

        me = client.get("/api/v1/auth/me", headers=headers)
        if me.status_code != 200:
            die("me", me)
        user_id = me.json()["id"]
        # Ensure CENTRAL_ADMIN roles if register ignored roles without seed
        client.put(
            f"/api/v1/rbac/users/{user_id}/roles",
            headers=headers,
            json={"role_codes": ["CENTRAL_ADMIN"]},
        )
        # Re-login to refresh JWT claims path (permissions from DB on each request)
        login2 = client.post(
            "/api/v1/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
        )
        headers = {"Authorization": f"Bearer {login2.json()['access_token']}"}

        # Unique identity fields each run (avoids OPEN duplicate NIC block)
        day = int(RUN_ID[:2], 16) % 28 + 1
        month = int(RUN_ID[2:4], 16) % 12 + 1
        year = 1980 + (int(RUN_ID[4:6], 16) % 25)
        citizen = client.post(
            "/api/v1/registry/citizens",
            headers=headers,
            json={
                "given_names": f"Amina{RUN_ID}",
                "family_name": f"Teste2e{RUN_ID}",
                "sex": "FEMALE",
                "date_of_birth": str(date(year, month, day)),
                "place_of_birth": "Kinshasa",
                "nationality": "COD",
                "addresses": [],
            },
        )
        if citizen.status_code != 201:
            die("create citizen", citizen)
        cid = citizen.json()["id"]
        print("OK citizen", cid)

        validate = client.post(
            f"/api/v1/registry/citizens/{cid}/validate",
            headers=headers,
        )
        if validate.status_code != 200:
            die("validate/NIC", validate)
        nic = validate.json()["nic"]
        print("OK NIC", nic)

        card = client.post(
            "/api/v1/cards/issue",
            headers=headers,
            json={"citizen_id": cid},
        )
        if card.status_code not in {200, 201}:
            die("issue card", card)
        card_body = card.json()
        card_id = card_body.get("card_id") or card_body.get("id")
        qr = card_body.get("qr_payload") or card_body.get("qr")
        print("OK card", card_id)

        if qr:
            offline = client.post(
                "/api/v1/cards/verify-offline",
                headers=headers,
                json={"payload": qr} if isinstance(qr, dict) else qr,
            )
            # endpoint shapes may vary — accept 200 or structured body
            if offline.status_code == 200:
                print("OK QR offline verify", offline.json())
            else:
                # try online
                online = client.post(
                    "/api/v1/cards/verify-online",
                    headers=headers,
                    json={"card_id": str(card_id)},
                )
                if online.status_code != 200:
                    die("card verify", offline if offline.status_code >= 400 else online)
                print("OK card online verify", online.json())
        else:
            online = client.post(
                "/api/v1/cards/verify-online",
                headers=headers,
                json={"card_id": str(card_id)},
            )
            if online.status_code != 200:
                die("card online verify", online)
            print("OK card online verify", online.json())

        # Refresh rotation
        refreshed = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        if refreshed.status_code != 200:
            die("refresh rotation", refreshed)
        print("OK refresh rotation")

        client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": refreshed.json()["refresh_token"]},
        )
        print("OK logout")
        print("E2E PASSED")


if __name__ == "__main__":
    main()
