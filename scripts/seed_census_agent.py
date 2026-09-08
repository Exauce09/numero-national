#!/usr/bin/env python3
"""Idempotent seed: census agent + ACTIVE demo campaign for the Flutter APK.

Requires API up with ALLOW_OPEN_REGISTRATION=true (dev).

  py -3 scripts/seed_census_agent.py
"""

from __future__ import annotations

import os
import sys

import httpx

BASE = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")
EMAIL = os.getenv("CENSUS_AGENT_EMAIL", "agent.recensement@example.gov")
PASSWORD = os.getenv("CENSUS_AGENT_PASSWORD", "CensusAgent123!")
CAMPAIGN_CODE = os.getenv("CENSUS_CAMPAIGN_CODE", "RGPH-2026")


def main() -> None:
    print(f"Seed census agent against {BASE}")
    with httpx.Client(base_url=BASE, timeout=30.0) as client:
        health = client.get("/health")
        if health.status_code != 200 or health.json().get("database") != "up":
            print("FAIL: API/database not up", file=sys.stderr)
            sys.exit(1)

        reg = client.post(
            "/api/v1/auth/register",
            json={
                "email": EMAIL,
                "password": PASSWORD,
                "full_name": "Agent Recensement Terrain",
                "role_codes": ["CENSUS_AGENT"],
            },
        )
        if reg.status_code in {201, 409}:
            print(f"OK register/exists {EMAIL} [{reg.status_code}]")
        else:
            print(f"FAIL register [{reg.status_code}] {reg.text[:400]}", file=sys.stderr)
            sys.exit(1)

        login = client.post(
            "/api/v1/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
        )
        if login.status_code != 200:
            print(f"FAIL login [{login.status_code}] {login.text[:400]}", file=sys.stderr)
            sys.exit(1)
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("OK login")

        me = client.get("/api/v1/auth/me", headers=headers)
        if me.status_code == 200:
            print("OK me", me.json().get("id"), me.json().get("roles"))

        campaigns = client.get("/api/v1/census/campaigns")
        campaigns.raise_for_status()
        existing = [c for c in campaigns.json() if c.get("code") == CAMPAIGN_CODE]
        if existing:
            camp = existing[0]
            if camp.get("status") != "ACTIVE":
                patch = client.patch(
                    f"/api/v1/census/campaigns/{camp['id']}",
                    json={"status": "ACTIVE"},
                )
                print(f"OK campaign activate [{patch.status_code}] {CAMPAIGN_CODE}")
            else:
                print(f"OK campaign exists ACTIVE {CAMPAIGN_CODE} {camp['id']}")
        else:
            created = client.post(
                "/api/v1/census/campaigns",
                json={
                    "code": CAMPAIGN_CODE,
                    "name": "Recensement général 2026",
                    "description": "Campagne démo terrain (seed APK)",
                },
            )
            if created.status_code not in {200, 201}:
                print(f"FAIL create campaign [{created.status_code}] {created.text[:400]}", file=sys.stderr)
                sys.exit(1)
            camp = created.json()
            patch = client.patch(
                f"/api/v1/census/campaigns/{camp['id']}",
                json={"status": "ACTIVE"},
            )
            print(f"OK campaign created+ACTIVE [{patch.status_code}] {camp['id']}")

        print()
        print("Identifiants APK:")
        print(f"  Email    : {EMAIL}")
        print(f"  Password : {PASSWORD}")
        print("SEED PASSED")


if __name__ == "__main__":
    main()
