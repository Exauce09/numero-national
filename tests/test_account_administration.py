"""Account administration authorization tests (provision, scopes, lifecycle)."""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from httpx import AsyncClient


async def _admin(client: AsyncClient) -> dict[str, str]:
    suffix = uuid.uuid4().hex[:8]
    email = f"acc.admin.{suffix}@example.gov"
    password = "SecurePass123!"
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Central Admin",
            "role_codes": ["CENTRAL_ADMIN"],
        },
    )
    assert reg.status_code in {201, 409}, reg.text
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def _register_with_roles(
    client: AsyncClient, admin_h: dict[str, str], role: str, *, province_id: str | None = None
) -> tuple[dict[str, str], str]:
    suffix = uuid.uuid4().hex[:8]
    email = f"{role.lower()}.{suffix}@example.gov"
    password = "SecurePass123!"
    body: dict = {
        "email": email,
        "password": password,
        "full_name": role,
        "role_codes": ["CITIZEN"],
    }
    reg = await client.post("/api/v1/auth/register", json=body, headers=admin_h)
    assert reg.status_code in {201, 409}, reg.text
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    uid = me.json()["id"]
    put = await client.put(
        f"/api/v1/rbac/users/{uid}/roles",
        headers=admin_h,
        json={"role_codes": [role]},
    )
    assert put.status_code == 200, put.text
    if province_id:
        scope = await client.post(
            "/api/v1/iam/scopes",
            headers=admin_h,
            json={"user_id": uid, "scope_type": "PROVINCE", "territory_id": province_id},
        )
        assert scope.status_code in {200, 201}, scope.text
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, uid


async def _two_provinces(client: AsyncClient, admin_h: dict[str, str]) -> tuple[str, str]:
    # Ensure geo seed via provinces endpoint
    rows = await client.get("/api/v1/geo/provinces", headers=admin_h)
    assert rows.status_code == 200, rows.text
    data = rows.json()
    assert len(data) >= 2
    return str(data[0]["id"]), str(data[1]["id"])


async def _bureau(client: AsyncClient, admin_h: dict[str, str], province_id: str, code: str) -> str:
    res = await client.post(
        "/api/v1/iam/bureaux",
        headers=admin_h,
        json={
            "code": code,
            "name": f"Bureau {code}",
            "province_id": province_id,
            "status": "ACTIVE",
        },
    )
    assert res.status_code in {200, 201}, res.text
    return res.json()["id"]


async def _personnel(client: AsyncClient, admin_h: dict[str, str], matricule: str) -> str:
    res = await client.post(
        "/api/v1/iam/personnel",
        headers=admin_h,
        json={
            "matricule": matricule,
            "family_name": "Kabila",
            "given_names": "Jean",
            "function_title": "Agent",
            "status": "ACTIVE",
        },
    )
    assert res.status_code in {200, 201}, res.text
    return res.json()["id"]


def _provision_body(personnel_id: str, province_id: str, bureau_id: str, role: str = "AGENT_ETAT_CIVIL"):
    return {
        "personnel": {"mode": "select", "personnel_id": personnel_id},
        "assignment": {
            "province_id": province_id,
            "bureau_id": bureau_id,
            "function_code": "AGENT_ETAT_CIVIL" if role == "AGENT_ETAT_CIVIL" else role,
            "start_date": str(date.today()),
            "open_ended": True,
        },
        "credentials": {
            "username": f"user{uuid.uuid4().hex[:6]}",
            "email": f"user{uuid.uuid4().hex[:6]}@example.gov",
            "access_mode": "invite",
        },
        "role_code": role,
    }


@pytest.mark.asyncio
async def test_1_provincial_creates_agent_same_province(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    p1, _p2 = await _two_provinces(client, admin_h)
    provincial_h, _ = await _register_with_roles(client, admin_h, "ADMIN_PROVINCIAL", province_id=p1)
    # Scope for provincial
    me = await client.get("/api/v1/auth/me", headers=provincial_h)
    await client.post(
        "/api/v1/iam/scopes",
        headers=admin_h,
        json={"user_id": me.json()["id"], "scope_type": "PROVINCE", "territory_id": p1},
    )
    bureau = await _bureau(client, admin_h, p1, f"B-{uuid.uuid4().hex[:6]}")
    pid = await _personnel(client, admin_h, f"MAT-{uuid.uuid4().hex[:6]}")
    res = await client.post(
        "/api/v1/iam/accounts/provision",
        headers=provincial_h,
        json=_provision_body(pid, p1, bureau),
    )
    assert res.status_code == 201, res.text
    assert res.json()["account_status"] == "PENDING"


@pytest.mark.asyncio
async def test_2_provincial_refused_other_province(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    p1, p2 = await _two_provinces(client, admin_h)
    provincial_h, _ = await _register_with_roles(client, admin_h, "ADMIN_PROVINCIAL", province_id=p1)
    me = await client.get("/api/v1/auth/me", headers=provincial_h)
    await client.post(
        "/api/v1/iam/scopes",
        headers=admin_h,
        json={"user_id": me.json()["id"], "scope_type": "PROVINCE", "territory_id": p1},
    )
    bureau = await _bureau(client, admin_h, p2, f"B-{uuid.uuid4().hex[:6]}")
    pid = await _personnel(client, admin_h, f"MAT-{uuid.uuid4().hex[:6]}")
    res = await client.post(
        "/api/v1/iam/accounts/provision",
        headers=provincial_h,
        json=_provision_body(pid, p2, bureau),
    )
    assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_3_agent_cannot_change_own_role(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    agent_h, uid = await _register_with_roles(client, admin_h, "AGENT_ETAT_CIVIL")
    res = await client.post(
        f"/api/v1/iam/accounts/{uid}/change-role",
        headers=agent_h,
        json={"role_code": "OFFICIER_ETAT_CIVIL", "reason": "self elevation"},
    )
    assert res.status_code in {403, 401}, res.text


@pytest.mark.asyncio
async def test_4_agent_cannot_assign_officier_to_self_via_rbac(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    agent_h, uid = await _register_with_roles(client, admin_h, "AGENT_ETAT_CIVIL")
    res = await client.put(
        f"/api/v1/rbac/users/{uid}/roles",
        headers=agent_h,
        json={"role_codes": ["OFFICIER_ETAT_CIVIL"]},
    )
    assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_5_citizen_cannot_create_admin_account(client: AsyncClient) -> None:
    suffix = uuid.uuid4().hex[:8]
    email = f"citizen.{suffix}@example.gov"
    password = "SecurePass123!"
    reg = await client.post(
        "/api/v1/auth/citizen/register",
        json={
            "family_name": "Mwamba",
            "given_names": "Paul",
            "date_of_birth": "1990-01-01",
            "username": f"paul{suffix[:6]}",
            "email": email,
            "password": password,
            "password_confirm": password,
        },
    )
    assert reg.status_code == 201, reg.text
    assert "CITIZEN" in reg.json().get("roles", [])
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    h = {"Authorization": f"Bearer {login.json()['access_token']}"}
    admin_h = await _admin(client)
    p1, _ = await _two_provinces(client, admin_h)
    bureau = await _bureau(client, admin_h, p1, f"B-{uuid.uuid4().hex[:6]}")
    pid = await _personnel(client, admin_h, f"MAT-{uuid.uuid4().hex[:6]}")
    res = await client.post(
        "/api/v1/iam/accounts/provision",
        headers=h,
        json=_provision_body(pid, p1, bureau),
    )
    assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_6_sensitive_role_without_compatible_function_refused(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    p1, _ = await _two_provinces(client, admin_h)
    bureau = await _bureau(client, admin_h, p1, f"B-{uuid.uuid4().hex[:6]}")
    pid = await _personnel(client, admin_h, f"MAT-{uuid.uuid4().hex[:6]}")
    body = _provision_body(pid, p1, bureau, role="OFFICIER_ETAT_CIVIL")
    body["assignment"]["function_code"] = "AGENT_ETAT_CIVIL"
    # OFFICIER requires compatible function — AGENT alone is not enough for OFFICIER role
    # Actually ROLE_FUNCTION_COMPAT for OFFICIER does NOT include AGENT_ETAT_CIVIL
    res = await client.post("/api/v1/iam/accounts/provision", headers=admin_h, json=body)
    assert res.status_code == 400, res.text


@pytest.mark.asyncio
async def test_7_mutated_agent_old_bureau_inaccessible(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    p1, _ = await _two_provinces(client, admin_h)
    b1 = await _bureau(client, admin_h, p1, f"B1-{uuid.uuid4().hex[:5]}")
    b2 = await _bureau(client, admin_h, p1, f"B2-{uuid.uuid4().hex[:5]}")
    pid = await _personnel(client, admin_h, f"MAT-{uuid.uuid4().hex[:6]}")
    prov = await client.post(
        "/api/v1/iam/accounts/provision",
        headers=admin_h,
        json={
            **_provision_body(pid, p1, b1),
            "credentials": {
                "username": f"mut{uuid.uuid4().hex[:6]}",
                "email": f"mut{uuid.uuid4().hex[:6]}@example.gov",
                "access_mode": "temporary_password",
                "temporary_password": "SecurePass123!",
            },
        },
    )
    assert prov.status_code == 201, prov.text
    uid = prov.json()["user_id"]
    # Mutate to bureau 2
    ch = await client.post(
        f"/api/v1/iam/accounts/{uid}/change-assignment",
        headers=admin_h,
        json={
            "bureau_id": b2,
            "province_id": p1,
            "function_code": "AGENT_ETAT_CIVIL",
            "start_date": str(date.today()),
            "open_ended": True,
        },
    )
    assert ch.status_code == 200, ch.text
    # User scopes should be bureau 2; access-check old bureau from user perspective
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": prov.json()["email"], "password": "SecurePass123!"},
    )
    assert login.status_code == 200
    uh = {"Authorization": f"Bearer {login.json()['access_token']}"}
    old = await client.get(f"/api/v1/iam/bureaux/{b1}/access-check", headers=uh)
    assert old.status_code == 403, old.text
    new = await client.get(f"/api/v1/iam/bureaux/{b2}/access-check", headers=uh)
    assert new.status_code == 200, new.text


@pytest.mark.asyncio
async def test_8_disabled_account_cannot_login(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    agent_h, uid = await _register_with_roles(client, admin_h, "AGENT_ETAT_CIVIL")
    me = await client.get("/api/v1/auth/me", headers=agent_h)
    email = me.json()["email"]
    dis = await client.post(
        f"/api/v1/iam/users/{uid}/disable",
        headers=admin_h,
        json={"reason": "Fin de mission"},
    )
    assert dis.status_code == 200, dis.text
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "SecurePass123!"}
    )
    assert login.status_code in {401, 403}, login.text


@pytest.mark.asyncio
async def test_9_role_change_creates_audit(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    p1, _ = await _two_provinces(client, admin_h)
    bureau = await _bureau(client, admin_h, p1, f"B-{uuid.uuid4().hex[:6]}")
    pid = await _personnel(client, admin_h, f"MAT-{uuid.uuid4().hex[:6]}")
    # Create with OFFICIER-compatible function as AGENT first
    body = _provision_body(pid, p1, bureau, role="AGENT_ETAT_CIVIL")
    body["credentials"] = {
        "username": f"aud{uuid.uuid4().hex[:6]}",
        "email": f"aud{uuid.uuid4().hex[:6]}@example.gov",
        "access_mode": "temporary_password",
        "temporary_password": "SecurePass123!",
    }
    prov = await client.post("/api/v1/iam/accounts/provision", headers=admin_h, json=body)
    assert prov.status_code == 201, prov.text
    uid = prov.json()["user_id"]
    # Update assignment function to allow officier then change role
    await client.post(
        f"/api/v1/iam/accounts/{uid}/change-assignment",
        headers=admin_h,
        json={
            "bureau_id": bureau,
            "province_id": p1,
            "function_code": "OFFICIER_ETAT_CIVIL",
            "start_date": str(date.today()),
            "open_ended": True,
        },
    )
    ch = await client.post(
        f"/api/v1/iam/accounts/{uid}/change-role",
        headers=admin_h,
        json={"role_code": "OFFICIER_ETAT_CIVIL", "reason": "Promotion officier"},
    )
    assert ch.status_code == 200, ch.text
    hist = await client.get(f"/api/v1/iam/accounts/{uid}/history", headers=admin_h)
    assert hist.status_code == 200, hist.text
    actions = [e["action"] for e in hist.json()]
    assert "ROLE_CHANGED" in actions


@pytest.mark.asyncio
async def test_10_cross_scope_user_access_refused(client: AsyncClient) -> None:
    admin_h = await _admin(client)
    p1, p2 = await _two_provinces(client, admin_h)
    provincial_h, _ = await _register_with_roles(client, admin_h, "ADMIN_PROVINCIAL", province_id=p1)
    me = await client.get("/api/v1/auth/me", headers=provincial_h)
    await client.post(
        "/api/v1/iam/scopes",
        headers=admin_h,
        json={"user_id": me.json()["id"], "scope_type": "PROVINCE", "territory_id": p1},
    )
    bureau = await _bureau(client, admin_h, p2, f"B-{uuid.uuid4().hex[:6]}")
    pid = await _personnel(client, admin_h, f"MAT-{uuid.uuid4().hex[:6]}")
    prov = await client.post(
        "/api/v1/iam/accounts/provision",
        headers=admin_h,
        json=_provision_body(pid, p2, bureau),
    )
    assert prov.status_code == 201, prov.text
    uid = prov.json()["user_id"]
    res = await client.get(f"/api/v1/iam/accounts/{uid}", headers=provincial_h)
    assert res.status_code == 403, res.text
