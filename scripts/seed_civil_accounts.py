#!/usr/bin/env python3
"""Crée les comptes démo état civil selon les rôles IAM (idempotent).

Prérequis : API up, ALLOW_OPEN_REGISTRATION=true (dev).

  py -3 scripts/seed_civil_accounts.py
"""

from __future__ import annotations

import os
import sys

import httpx

BASE = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")

# Alias UI → compte API
CIVIL_ACCOUNTS: list[dict[str, object]] = [
    {
        "alias": "admin",
        "email": "admin.provincial@example.gov",
        "password": "AdminProvincial123!",
        "roles": ["ADMIN_PROVINCIAL"],
        "full_name": "Directrice de l'État civil général de la RDC",
    },
    {
        "alias": "responsable",
        "email": "responsable.bureau@example.gov",
        "password": "ResponsableBureau123!",
        "roles": ["RESPONSABLE_BUREAU"],
        "full_name": "Responsable Bureau Gombe",
    },
    {
        "alias": "officier",
        "email": "officier.etatcivil@example.gov",
        "password": "CivilOfficer123!",
        "roles": ["OFFICIER_ETAT_CIVIL", "CIVIL_OFFICER"],
        "full_name": "Hervé Kinkete",
    },
    {
        "alias": "agent",
        "email": "agent.etatcivil@example.gov",
        "password": "AgentCivil123!",
        "roles": ["AGENT_ETAT_CIVIL"],
        "full_name": "Agent État Civil Gombe",
    },
    {
        "alias": "auditeur",
        "email": "auditeur.etatcivil@example.gov",
        "password": "AuditeurCivil123!",
        "roles": ["AUDITEUR"],
        "full_name": "Auditeur État Civil",
    },
]

PRIVILEGED = {"SUPER_ADMIN_NATIONAL", "ADMIN_NATIONAL", "ADMIN_PROVINCIAL", "CENTRAL_ADMIN"}


def die(msg: str, resp: httpx.Response | None = None) -> None:
    extra = f" [{resp.status_code}] {resp.text[:400]}" if resp is not None else ""
    print(f"FAIL: {msg}{extra}", file=sys.stderr)
    sys.exit(1)


def login(client: httpx.Client, email: str, password: str) -> dict:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        die(f"login {email}", res)
    return res.json()


def me(client: httpx.Client, token: str) -> dict:
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    if res.status_code != 200:
        die("auth/me", res)
    return res.json()


def register_user(
    client: httpx.Client,
    *,
    email: str,
    password: str,
    full_name: str,
    role_codes: list[str],
) -> None:
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": full_name,
            "role_codes": role_codes,
        },
    )
    if res.status_code not in {201, 409}:
        die(f"register {email}", res)


def assign_roles(client: httpx.Client, admin_token: str, user_id: str, roles: list[str]) -> None:
    res = client.put(
        f"/api/v1/rbac/users/{user_id}/roles",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role_codes": roles},
    )
    if res.status_code not in {200, 201}:
        die(f"assign roles {user_id}", res)


def ensure_account(
    client: httpx.Client,
    *,
    admin_token: str,
    email: str,
    password: str,
    full_name: str,
    roles: list[str],
) -> dict:
    # Open registration refuse les rôles admin privilégiés → créer sans, puis assigner.
    open_roles = [r for r in roles if r not in PRIVILEGED]
    if not open_roles:
        open_roles = []  # compte vide puis élévation admin
    register_user(
        client,
        email=email,
        password=password,
        full_name=full_name,
        role_codes=open_roles,
    )
    tokens = login(client, email, password)
    profile = me(client, tokens["access_token"])
    have = {str(r).upper() for r in (profile.get("roles") or [])}
    want = {r.upper() for r in roles}
    if want - have:
        assign_roles(client, admin_token, str(profile["id"]), roles)
        tokens = login(client, email, password)
        profile = me(client, tokens["access_token"])
    # Met à jour le nom affiché si l'utilisateur existe déjà (register 409).
    if str(profile.get("full_name") or "") != full_name:
        try:
            import psycopg

            dsn = os.getenv(
                "DATABASE_URL",
                "postgresql://nic_admin:change-me-strong-db-password@127.0.0.1:5432/nic_core",
            )
            with psycopg.connect(dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE identity.users SET full_name = %s WHERE email = %s",
                        (full_name, email),
                    )
                conn.commit()
        except Exception as exc:  # noqa: BLE001
            print(f"  (warn) full_name DB update {email}: {exc}")
    return profile


def main() -> None:
    print(f"Seed comptes etat civil -> {BASE}")
    with httpx.Client(base_url=BASE, timeout=30.0) as client:
        health = client.get("/health")
        if health.status_code != 200:
            die("API down", health)

        admin_email = os.getenv("CENSUS_ADMIN_EMAIL", "admin.recensement@example.gov")
        admin_password = os.getenv("CENSUS_ADMIN_PASSWORD", "CensusAdmin123!")
        register_user(
            client,
            email=admin_email,
            password=admin_password,
            full_name="Administrateur Central Démo",
            role_codes=["CENTRAL_ADMIN"],
        )
        admin_tokens = login(client, admin_email, admin_password)
        admin_token = admin_tokens["access_token"]

        print("\nComptes créés / vérifiés :\n")
        print(f"{'Alias UI':<14} {'Email':<42} {'Mot de passe':<24} Rôles")
        print("-" * 110)

        ui_passwords = {
            "officier": "DemoCivil2026!",
            "agent": "DemoAgentCivil2026!",
            "responsable": "DemoResponsable2026!",
            "auditeur": "DemoAuditeur2026!",
            "admin": "DemoAdminProv2026!",
        }

        for acc in CIVIL_ACCOUNTS:
            email = str(acc["email"])
            password = str(acc["password"])
            roles = list(acc["roles"])  # type: ignore[arg-type]
            profile = ensure_account(
                client,
                admin_token=admin_token,
                email=email,
                password=password,
                full_name=str(acc["full_name"]),
                roles=roles,
            )
            alias = str(acc["alias"])
            final_roles = ",".join(profile.get("roles") or roles)
            print(
                f"{alias:<14} {email:<42} {password:<24} {final_roles}"
            )
            print(f"{'':14} {'alias UI ->':<42} {ui_passwords.get(alias, '-'):<24}")

        print("\nOK - site http://127.0.0.1:5176")
        print("  officier / DemoCivil2026!   (validation actes)")
        print("  agent / DemoAgentCivil2026! (saisie sans validation)")
        print("  responsable / DemoResponsable2026!")
        print("  auditeur / DemoAuditeur2026!")
        print("  admin / DemoAdminProv2026!")


if __name__ == "__main__":
    main()
