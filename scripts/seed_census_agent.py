#!/usr/bin/env python3
"""Idempotent seed: census agent + ACTIVE campaign + zone + team + assignment.

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
ADMIN_EMAIL = os.getenv("CENSUS_ADMIN_EMAIL", "admin.recensement@example.gov")
ADMIN_PASSWORD = os.getenv("CENSUS_ADMIN_PASSWORD", "CensusAdmin123!")
SUPERVISOR_EMAIL = os.getenv("CENSUS_SUPERVISOR_EMAIL", "supervisor.recensement@example.gov")
SUPERVISOR_PASSWORD = os.getenv("CENSUS_SUPERVISOR_PASSWORD", "CensusSupervisor123!")
CAMPAIGN_CODE = os.getenv("CENSUS_CAMPAIGN_CODE", "RGPH-2026")
ZONE_CODE = os.getenv("CENSUS_ZONE_CODE", "KIN-GOMBE-Z1")
TEAM_CODE = os.getenv("CENSUS_TEAM_CODE", "EQ-GOMBE-01")


def die(msg: str, resp: httpx.Response | None = None) -> None:
    extra = f" [{resp.status_code}] {resp.text[:400]}" if resp is not None else ""
    print(f"FAIL: {msg}{extra}", file=sys.stderr)
    sys.exit(1)


def ensure_user(client: httpx.Client, email: str, password: str, roles: list[str]) -> dict:
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": email.split("@")[0].replace(".", " ").title(),
            "role_codes": roles,
        },
    )
    if reg.status_code not in {201, 409}:
        die("register", reg)
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    if login.status_code != 200:
        die("login", login)
    tokens = login.json()
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    if me.status_code != 200:
        die("me", me)
    return {"tokens": tokens, "me": me.json()}


def main() -> None:
    print(f"Seed census ops against {BASE}")
    with httpx.Client(base_url=BASE, timeout=30.0) as client:
        health = client.get("/health")
        if health.status_code != 200 or health.json().get("database") != "up":
            die("API/database not up", health)

        admin = ensure_user(client, ADMIN_EMAIL, ADMIN_PASSWORD, ["CENTRAL_ADMIN"])
        supervisor = ensure_user(
            client, SUPERVISOR_EMAIL, SUPERVISOR_PASSWORD, ["CENSUS_SUPERVISOR"]
        )
        agent = ensure_user(client, EMAIL, PASSWORD, ["CENSUS_AGENT"])
        civil = ensure_user(
            client,
            os.getenv("CIVIL_OFFICER_EMAIL", "officier.etatcivil@example.gov"),
            os.getenv("CIVIL_OFFICER_PASSWORD", "CivilOfficer123!"),
            ["CIVIL_OFFICER"],
        )
        admin_headers = {"Authorization": f"Bearer {admin['tokens']['access_token']}"}
        agent_id = agent["me"]["id"]
        print(
            "OK users",
            ADMIN_EMAIL,
            SUPERVISOR_EMAIL,
            EMAIL,
            civil["me"]["email"],
            agent_id,
        )
        _ = supervisor  # seeded for approve/reject API

        campaigns = client.get("/api/v1/census/campaigns", headers=admin_headers)
        campaigns.raise_for_status()
        existing = [c for c in campaigns.json() if c.get("code") == CAMPAIGN_CODE]
        if existing:
            camp = existing[0]
            if camp.get("status") != "ACTIVE":
                patch = client.patch(
                    f"/api/v1/census/campaigns/{camp['id']}",
                    headers=admin_headers,
                    json={"status": "ACTIVE"},
                )
                if patch.status_code != 200:
                    die("activate campaign", patch)
                camp = patch.json()
            print("OK campaign", camp["id"], camp["status"])
        else:
            created = client.post(
                "/api/v1/census/campaigns",
                headers=admin_headers,
                json={
                    "code": CAMPAIGN_CODE,
                    "name": "Recensement général 2026",
                    "description": "Campagne démo terrain (seed APK)",
                },
            )
            if created.status_code not in {200, 201}:
                die("create campaign", created)
            camp = created.json()
            patch = client.patch(
                f"/api/v1/census/campaigns/{camp['id']}",
                headers=admin_headers,
                json={"status": "ACTIVE"},
            )
            if patch.status_code != 200:
                die("activate campaign", patch)
            camp = patch.json()
            print("OK campaign created", camp["id"])

        zones = client.get(f"/api/v1/census/campaigns/{camp['id']}/zones", headers=admin_headers)
        if zones.status_code != 200:
            die("list zones", zones)
        zone_list = [z for z in zones.json() if z.get("code") == ZONE_CODE]
        if zone_list:
            zone = zone_list[0]
            print("OK zone", zone["id"])
        else:
            zc = client.post(
                f"/api/v1/census/campaigns/{camp['id']}/zones",
                headers=admin_headers,
                json={
                    "code": ZONE_CODE,
                    "name": "Zone Gombe 1 — Kinshasa",
                    "province_code": "KIN",
                    "commune_code": "GOMBE",
                    "geo_level": "COMMUNE",
                },
            )
            if zc.status_code not in {200, 201}:
                die("create zone", zc)
            zone = zc.json()
            print("OK zone created", zone["id"])

        teams = client.get(f"/api/v1/census/campaigns/{camp['id']}/teams", headers=admin_headers)
        if teams.status_code != 200:
            die("list teams", teams)
        team_list = [t for t in teams.json() if t.get("code") == TEAM_CODE]
        if team_list:
            team = team_list[0]
            print("OK team", team["id"])
        else:
            tc = client.post(
                f"/api/v1/census/campaigns/{camp['id']}/teams",
                headers=admin_headers,
                json={
                    "code": TEAM_CODE,
                    "name": "Équipe Gombe 01",
                    "zone_id": zone["id"],
                },
            )
            if tc.status_code not in {200, 201}:
                die("create team", tc)
            team = tc.json()
            print("OK team created", team["id"])

        asn = client.post(
            f"/api/v1/census/teams/{team['id']}/assignments",
            headers=admin_headers,
            json={"agent_user_id": agent_id, "role_label": "CENSUS_AGENT"},
        )
        if asn.status_code not in {200, 201}:
            die("assign agent", asn)
        print("OK assignment", asn.json()["id"])

        agent_headers = {"Authorization": f"Bearer {agent['tokens']['access_token']}"}
        mine = client.get("/api/v1/census/agents/me/assignments", headers=agent_headers)
        if mine.status_code != 200:
            die("me/assignments", mine)
        print("OK me/assignments", len(mine.json()))

        print()
        print("Identifiants APK agent:")
        print(f"  Email    : {EMAIL}")
        print(f"  Password : {PASSWORD}")
        print("Admin recensement:")
        print(f"  Email    : {ADMIN_EMAIL}")
        print(f"  Password : {ADMIN_PASSWORD}")
        print("SEED PASSED")


if __name__ == "__main__":
    main()
