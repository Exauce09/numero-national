"""IAM institutional + état civil juridique — coverage for plan Phase 1–3."""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from httpx import AsyncClient


async def _admin(client: AsyncClient) -> dict[str, str]:
    suffix = uuid.uuid4().hex[:8]
    email = f"iam.admin.{suffix}@example.gov"
    password = "SecurePass123!"
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "IAM Admin",
            "role_codes": ["CENTRAL_ADMIN"],
        },
    )
    assert reg.status_code in {201, 409}, reg.text
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def _register_role(
    client: AsyncClient, role: str
) -> tuple[dict[str, str], str]:
    suffix = uuid.uuid4().hex[:8]
    email = f"{role.lower()}.{suffix}@example.gov"
    password = "SecurePass123!"
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": role,
            "role_codes": [role],
        },
    )
    # Privileged roles blocked on open register — create via CENTRAL then assign
    if reg.status_code == 403 and role in {
        "ADMIN_NATIONAL",
        "ADMIN_PROVINCIAL",
        "SUPER_ADMIN_NATIONAL",
        "CENTRAL_ADMIN",
    }:
        admin = await _admin(client)
        # create as CITIZEN then assign
        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": password,
                "full_name": role,
                "role_codes": ["CITIZEN"],
            },
            headers=admin,
        )
        assert reg.status_code in {201, 409}, reg.text
        login = await client.post(
            "/api/v1/auth/login", json={"email": email, "password": password}
        )
        assert login.status_code == 200
        uid = (await client.get("/api/v1/auth/me", headers={
            "Authorization": f"Bearer {login.json()['access_token']}"
        })).json()["id"]
        put = await client.put(
            f"/api/v1/rbac/users/{uid}/roles",
            headers=admin,
            json={"role_codes": [role]},
        )
        assert put.status_code == 200, put.text
        login = await client.post(
            "/api/v1/auth/login", json={"email": email, "password": password}
        )
        return {"Authorization": f"Bearer {login.json()['access_token']}"}, email

    assert reg.status_code in {201, 409}, reg.text
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, email


@pytest.mark.asyncio
async def test_provincial_cannot_create_national_admin_request(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    # Seed personnel
    pers = await client.post(
        "/api/v1/iam/personnel",
        headers=admin_h,
        json={
            "matricule": f"M-{uuid.uuid4().hex[:6]}",
            "family_name": "Test",
            "given_names": "Prov",
            "email_pro": f"prov.{uuid.uuid4().hex[:6]}@example.gov",
        },
    )
    assert pers.status_code == 201, pers.text
    provincial_h, _ = await _register_role(client, "ADMIN_PROVINCIAL")
    req = await client.post(
        "/api/v1/iam/account-requests",
        headers=provincial_h,
        json={
            "personnel_id": pers.json()["id"],
            "requested_role": "ADMIN_NATIONAL",
            "reason": "should fail",
        },
    )
    assert req.status_code == 403, req.text


@pytest.mark.asyncio
async def test_cannot_self_assign_roles(client: AsyncClient) -> None:
    headers, _ = await _register_role(client, "AGENT_ETAT_CIVIL")
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    uid = me.json()["id"]
    put = await client.put(
        f"/api/v1/rbac/users/{uid}/roles",
        headers=headers,
        json={"role_codes": ["CENTRAL_ADMIN"]},
    )
    assert put.status_code in {403, 401}, put.text


@pytest.mark.asyncio
async def test_bureau_scope_blocks_other_bureau(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    b1 = await client.post(
        "/api/v1/iam/bureaux",
        headers=admin_h,
        json={"code": f"B1-{uuid.uuid4().hex[:4]}", "name": "Bureau 1"},
    )
    b2 = await client.post(
        "/api/v1/iam/bureaux",
        headers=admin_h,
        json={"code": f"B2-{uuid.uuid4().hex[:4]}", "name": "Bureau 2"},
    )
    assert b1.status_code == 201 and b2.status_code == 201
    agent_h, _ = await _register_role(client, "AGENT_ETAT_CIVIL")
    me = (await client.get("/api/v1/auth/me", headers=agent_h)).json()
    await client.post(
        "/api/v1/iam/scopes",
        headers=admin_h,
        json={
            "user_id": me["id"],
            "scope_type": "BUREAU",
            "bureau_id": b1.json()["id"],
        },
    )
    check = await client.get(
        f"/api/v1/iam/bureaux/{b2.json()['id']}/access-check",
        headers=agent_h,
    )
    assert check.status_code == 403, check.text


@pytest.mark.asyncio
async def test_disabled_user_cannot_login(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    agent_h, email = await _register_role(client, "AGENT_ETAT_CIVIL")
    uid = (await client.get("/api/v1/auth/me", headers=agent_h)).json()["id"]
    dis = await client.post(
        f"/api/v1/iam/users/{uid}/disable",
        headers=admin_h,
        json={"reason": "Départ définitif test"},
    )
    assert dis.status_code == 200, dis.text
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "SecurePass123!"}
    )
    assert login.status_code == 403, login.text


@pytest.mark.asyncio
async def test_birth_validate_mention_and_soft_delete_guard(client: AsyncClient) -> None:
    officer_h, _ = await _register_role(client, "CIVIL_OFFICER")
    birth = await client.post(
        "/api/v1/civil/births",
        headers=officer_h,
        json={
            "commune_code": "KIN-GOMBE",
            "payload": {"child_nom": "Test", "child_prenom": "Bebe"},
            "status": "DRAFT",
        },
    )
    assert birth.status_code in {200, 201}, birth.text
    act_id = birth.json()["id"]
    act_number = birth.json()["act_number"]
    assert "/" in act_number, act_number
    parts = act_number.split("/")
    assert len(parts) == 3 and parts[0] == "KIN-GOMBE" and parts[1].isdigit() and parts[2].isdigit()
    tr = await client.post(
        f"/api/v1/civil/acts/{act_id}/transition",
        headers=officer_h,
        json={"status": "SUBMITTED"},
    )
    assert tr.status_code == 200, tr.text
    tr2 = await client.post(
        f"/api/v1/civil/acts/{act_id}/transition",
        headers=officer_h,
        json={"status": "VALIDATED"},
    )
    assert tr2.status_code == 200, tr2.text
    code = tr2.json().get("verification_code")
    assert code
    verify = await client.post(
        "/api/v1/civil/documents/verify",
        json={"code": code},
    )
    assert verify.status_code == 200
    assert verify.json()["status"] == "DOCUMENT_VALIDE"
    assert verify.json().get("authenticated") is True

    extract = await client.get(f"/api/v1/civil/acts/{act_id}/extract", headers=officer_h)
    assert extract.status_code == 200, extract.text
    body = extract.json()
    assert body["verification_code"] == code
    assert body["authentication"]
    assert body["conservation"]["immutable_when_validated"] is True

    mention = await client.post(
        "/api/v1/civil/mentions",
        headers=officer_h,
        json={"target_act_id": act_id, "mention_type": "MARRIAGE", "reference": "M-1"},
    )
    assert mention.status_code == 201, mention.text

    mentions = await client.get(f"/api/v1/civil/acts/{act_id}/mentions", headers=officer_h)
    assert mentions.status_code == 200
    assert len(mentions.json()) >= 1

    trx = await client.post(
        "/api/v1/civil/transcriptions",
        headers=officer_h,
        json={
            "source_act_ref": "ACTE-EXT-001",
            "source_place": "Lubumbashi",
            "source_authority": "État civil Lubumbashi",
            "resulting_act_id": act_id,
        },
    )
    assert trx.status_code == 201, trx.text

    delete = await client.delete(f"/api/v1/civil/acts/{act_id}", headers=officer_h)
    assert delete.status_code == 403, delete.text


@pytest.mark.asyncio
async def test_bureau_scope_blocks_civil_write(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    b1 = await client.post(
        "/api/v1/iam/bureaux",
        headers=admin_h,
        json={"code": f"B1-{uuid.uuid4().hex[:4]}", "name": "Bureau 1"},
    )
    b2 = await client.post(
        "/api/v1/iam/bureaux",
        headers=admin_h,
        json={"code": f"B2-{uuid.uuid4().hex[:4]}", "name": "Bureau 2"},
    )
    assert b1.status_code == 201 and b2.status_code == 201, (b1.text, b2.text)
    id1, id2 = b1.json()["id"], b2.json()["id"]

    officer_h, _ = await _register_role(client, "CIVIL_OFFICER")
    me = (await client.get("/api/v1/auth/me", headers=officer_h)).json()
    await client.post(
        "/api/v1/iam/scopes",
        headers=admin_h,
        json={
            "user_id": me["id"],
            "scope_type": "BUREAU",
            "bureau_id": id1,
        },
    )

    blocked = await client.post(
        "/api/v1/civil/births",
        headers=officer_h,
        json={
            "commune_code": "KIN-LING",
            "bureau_id": id2,
            "payload": {"prenom": "Test"},
            "status": "DRAFT",
        },
    )
    assert blocked.status_code == 403, blocked.text

    ok = await client.post(
        "/api/v1/civil/births",
        headers=officer_h,
        json={
            "commune_code": "KIN-GOMBE",
            "bureau_id": id1,
            "payload": {"prenom": "Ok"},
            "status": "DRAFT",
        },
    )
    assert ok.status_code in {200, 201}, ok.text


@pytest.mark.asyncio
async def test_divorce_does_not_delete_marriage(client: AsyncClient) -> None:
    officer_h, _ = await _register_role(client, "CIVIL_OFFICER")
    marriage = await client.post(
        "/api/v1/civil/marriages",
        headers=officer_h,
        json={
            "commune_code": "KIN-GOMBE",
            "payload": {"epoux": "A", "epouse": "B"},
            "status": "DRAFT",
        },
    )
    assert marriage.status_code in {200, 201}, marriage.text
    mid = marriage.json()["id"]
    for status_name in ("SUBMITTED", "VALIDATED"):
        tr = await client.post(
            f"/api/v1/civil/acts/{mid}/transition",
            headers=officer_h,
            json={"status": status_name},
        )
        assert tr.status_code == 200, tr.text
    divorce = await client.post(
        "/api/v1/civil/divorces",
        headers=officer_h,
        json={
            "commune_code": "KIN-GOMBE",
            "payload": {"marriage_act_id": mid},
            "status": "DRAFT",
        },
    )
    assert divorce.status_code in {200, 201}, divorce.text
    still = await client.get(f"/api/v1/civil/acts/{mid}", headers=officer_h)
    assert still.status_code == 200
    assert still.json()["id"] == mid
    assert still.json()["status"] == "VALIDATED"


@pytest.mark.asyncio
async def test_deprecated_displacement_write_blocked(client: AsyncClient) -> None:
    officer_h, _ = await _register_role(client, "CIVIL_OFFICER")
    bad = await client.post(
        "/api/v1/civil/displacements",
        headers=officer_h,
        json={"commune_code": "KIN-GOMBE", "payload": {}, "status": "DRAFT"},
    )
    assert bad.status_code == 400, bad.text


@pytest.mark.asyncio
async def test_officer_without_assignment_blocked_for_officier_request(
    client: AsyncClient,
) -> None:
    admin_h = await _admin(client)
    pers = await client.post(
        "/api/v1/iam/personnel",
        headers=admin_h,
        json={
            "matricule": f"OF-{uuid.uuid4().hex[:6]}",
            "family_name": "Sans",
            "given_names": "Affectation",
            "email_pro": f"of.{uuid.uuid4().hex[:6]}@example.gov",
        },
    )
    assert pers.status_code == 201
    req = await client.post(
        "/api/v1/iam/account-requests",
        headers=admin_h,
        json={
            "personnel_id": pers.json()["id"],
            "requested_role": "OFFICIER_ETAT_CIVIL",
            "reason": "needs assignment first",
        },
    )
    assert req.status_code == 400, req.text


@pytest.mark.asyncio
async def test_account_request_approve_creates_user(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    email = f"agent.new.{uuid.uuid4().hex[:6]}@example.gov"
    pers = await client.post(
        "/api/v1/iam/personnel",
        headers=admin_h,
        json={
            "matricule": f"AG-{uuid.uuid4().hex[:6]}",
            "family_name": "Nouveau",
            "given_names": "Agent",
            "email_pro": email,
        },
    )
    assert pers.status_code == 201
    bureau = await client.post(
        "/api/v1/iam/bureaux",
        headers=admin_h,
        json={"code": f"BX-{uuid.uuid4().hex[:4]}", "name": "Bureau Test"},
    )
    assert bureau.status_code == 201
    asg = await client.post(
        "/api/v1/iam/assignments",
        headers=admin_h,
        json={
            "personnel_id": pers.json()["id"],
            "bureau_id": bureau.json()["id"],
            "function_code": "AGENT_ETAT_CIVIL",
            "start_date": date.today().isoformat(),
        },
    )
    assert asg.status_code == 201, asg.text
    req = await client.post(
        "/api/v1/iam/account-requests",
        headers=admin_h,
        json={
            "personnel_id": pers.json()["id"],
            "requested_role": "AGENT_ETAT_CIVIL",
            "requested_bureau_id": bureau.json()["id"],
            "reason": "affectation OK",
        },
    )
    assert req.status_code == 201, req.text
    appr = await client.post(
        f"/api/v1/iam/account-requests/{req.json()['id']}/approve",
        headers=admin_h,
        json={"temporary_password": "TempPass123!", "email": email},
    )
    assert appr.status_code == 200, appr.text
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "TempPass123!"}
    )
    assert login.status_code == 200, login.text
