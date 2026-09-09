"""API tests — census supervisor APPROVE / REJECT workflow."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


async def _setup(client: AsyncClient) -> tuple[dict[str, str], dict[str, str], str, str]:
    suffix = uuid.uuid4().hex[:8]
    admin_email = f"rev.admin.{suffix}@example.gov"
    agent_email = f"rev.agent.{suffix}@example.gov"
    password = "SecurePass123!"

    for email, roles in (
        (admin_email, ["CENTRAL_ADMIN"]),
        (agent_email, ["CENSUS_AGENT"]),
    ):
        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": password,
                "full_name": email,
                "role_codes": roles,
            },
        )
        assert reg.status_code in {201, 409}, reg.text

    admin_login = await client.post(
        "/api/v1/auth/login", json={"email": admin_email, "password": password}
    )
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    agent_login = await client.post(
        "/api/v1/auth/login", json={"email": agent_email, "password": password}
    )
    assert agent_login.status_code == 200
    agent_headers = {"Authorization": f"Bearer {agent_login.json()['access_token']}"}
    agent_id = (await client.get("/api/v1/auth/me", headers=agent_headers)).json()["id"]

    camp = await client.post(
        "/api/v1/census/campaigns",
        headers=admin_headers,
        json={"code": f"REV-{suffix}", "name": f"Review {suffix}"},
    )
    assert camp.status_code == 201, camp.text
    campaign_id = camp.json()["id"]
    await client.patch(
        f"/api/v1/census/campaigns/{campaign_id}",
        headers=admin_headers,
        json={"status": "ACTIVE"},
    )
    return admin_headers, agent_headers, campaign_id, agent_id


@pytest.mark.asyncio
async def test_supervisor_approve_and_reject_flow(client: AsyncClient) -> None:
    admin_headers, _agent_headers, campaign_id, agent_id = await _setup(client)
    device_uid = f"dev-{uuid.uuid4().hex[:10]}"
    hh_local = f"hh-{uuid.uuid4().hex[:8]}"
    rec_a = f"rec-a-{uuid.uuid4().hex[:8]}"
    rec_b = f"rec-b-{uuid.uuid4().hex[:8]}"

    push = await client.post(
        "/api/v1/census/sync/push",
        headers=admin_headers,
        json={
            "device_uid": device_uid,
            "agent_user_id": agent_id,
            "campaign_id": campaign_id,
            "items": [
                {
                    "entity_type": "household",
                    "local_id": hh_local,
                    "version": 1,
                    "data": {"address_line": "Av. Test", "member_count": 2},
                },
                {
                    "entity_type": "census_record",
                    "local_id": rec_a,
                    "version": 1,
                    "data": {
                        "household_local_id": hh_local,
                        "given_names": "Alice",
                        "family_name": "Ok",
                        "sex": "F",
                        "date_of_birth": "1992-02-02",
                    },
                },
                {
                    "entity_type": "census_record",
                    "local_id": rec_b,
                    "version": 1,
                    "data": {
                        "household_local_id": hh_local,
                        "given_names": "Bob",
                        "family_name": "Bad",
                        "sex": "M",
                        "date_of_birth": "1988-08-08",
                    },
                },
            ],
        },
    )
    assert push.status_code == 200, push.text
    assert push.json()["accepted"] == 3

    queue = await client.get(
        f"/api/v1/census/campaigns/{campaign_id}/records",
        headers=admin_headers,
        params={"status": "SYNCED"},
    )
    assert queue.status_code == 200, queue.text
    rows = queue.json()
    assert len(rows) == 2
    by_local = {r["local_id"]: r for r in rows}

    approved = await client.post(
        f"/api/v1/census/records/{by_local[rec_a]['id']}/approve",
        headers=admin_headers,
        json={"note": "Dossier complet"},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "APPROVED"
    assert approved.json()["review_note"] == "Dossier complet"
    assert approved.json()["reviewed_by"] is not None

    rejected = await client.post(
        f"/api/v1/census/records/{by_local[rec_b]['id']}/reject",
        headers=admin_headers,
        json={"note": "Date de naissance incohérente"},
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "REJECTED"

    # Already approved cannot be approved again
    again = await client.post(
        f"/api/v1/census/records/{by_local[rec_a]['id']}/approve",
        headers=admin_headers,
        json={},
    )
    assert again.status_code == 409

    # Rejected can be re-approved
    reapprove = await client.post(
        f"/api/v1/census/records/{by_local[rec_b]['id']}/approve",
        headers=admin_headers,
        json={"note": "Corrigé après contrôle"},
    )
    assert reapprove.status_code == 200, reapprove.text
    assert reapprove.json()["status"] == "APPROVED"

    remaining = await client.get(
        f"/api/v1/census/campaigns/{campaign_id}/records",
        headers=admin_headers,
        params={"status": "SYNCED"},
    )
    assert remaining.json() == []

    approved_list = await client.get(
        f"/api/v1/census/campaigns/{campaign_id}/records",
        headers=admin_headers,
        params={"status": "APPROVED"},
    )
    assert len(approved_list.json()) == 2

    # Reject requires a meaningful note
    bad = await client.post(
        f"/api/v1/census/records/{by_local[rec_a]['id']}/reject",
        headers=admin_headers,
        json={"note": "ab"},
    )
    assert bad.status_code == 422
