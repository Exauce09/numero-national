"""API tests — census APPROVED → core_registry promotion."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


async def _setup(client: AsyncClient) -> tuple[dict[str, str], str, str]:
    suffix = uuid.uuid4().hex[:8]
    email = f"promo.admin.{suffix}@example.gov"
    password = "SecurePass123!"
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Promo Admin",
            "role_codes": ["CENTRAL_ADMIN"],
        },
    )
    assert reg.status_code in {201, 409}, reg.text
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    agent_id = (await client.get("/api/v1/auth/me", headers=headers)).json()["id"]

    camp = await client.post(
        "/api/v1/census/campaigns",
        headers=headers,
        json={"code": f"PRO-{suffix}", "name": f"Promote {suffix}"},
    )
    assert camp.status_code == 201, camp.text
    campaign_id = camp.json()["id"]
    await client.patch(
        f"/api/v1/census/campaigns/{campaign_id}",
        headers=headers,
        json={"status": "ACTIVE"},
    )
    return headers, campaign_id, agent_id


async def _push_and_approve(
    client: AsyncClient,
    headers: dict[str, str],
    campaign_id: str,
    agent_id: str,
    *,
    given: str,
    family: str,
    dob: str = "1991-03-03",
) -> str:
    hh = f"hh-{uuid.uuid4().hex[:8]}"
    rec = f"rec-{uuid.uuid4().hex[:8]}"
    push = await client.post(
        "/api/v1/census/sync/push",
        headers=headers,
        json={
            "device_uid": f"dev-{uuid.uuid4().hex[:10]}",
            "agent_user_id": agent_id,
            "campaign_id": campaign_id,
            "items": [
                {
                    "entity_type": "household",
                    "local_id": hh,
                    "version": 1,
                    "data": {"address_line": "Av. du Port 1", "member_count": 1},
                },
                {
                    "entity_type": "census_record",
                    "local_id": rec,
                    "version": 1,
                    "data": {
                        "household_local_id": hh,
                        "given_names": given,
                        "family_name": family,
                        "sex": "M",
                        "date_of_birth": dob,
                    },
                },
            ],
        },
    )
    assert push.status_code == 200, push.text
    queue = await client.get(
        f"/api/v1/census/campaigns/{campaign_id}/records",
        headers=headers,
        params={"status": "SYNCED"},
    )
    row = next(r for r in queue.json() if r["local_id"] == rec)
    approved = await client.post(
        f"/api/v1/census/records/{row['id']}/approve",
        headers=headers,
        json={"note": "OK pour registre"},
    )
    assert approved.status_code == 200, approved.text
    return row["id"]


@pytest.mark.asyncio
async def test_promote_single_idempotent_and_batch(client: AsyncClient) -> None:
    headers, campaign_id, agent_id = await _setup(client)
    suffix = uuid.uuid4().hex[:6]

    record_id = await _push_and_approve(
        client,
        headers,
        campaign_id,
        agent_id,
        given=f"Promo{suffix}",
        family=f"Citizen{suffix}",
    )

    promo = await client.post(
        f"/api/v1/census/records/{record_id}/promote",
        headers=headers,
        json={"assign_nic": True},
    )
    assert promo.status_code == 200, promo.text
    body = promo.json()
    assert body["already_promoted"] is False
    assert body["citizen_id"]
    assert body["nic_assigned"] is True
    assert body["nic"]
    assert body["citizen_status"] == "ACTIVE"

    again = await client.post(
        f"/api/v1/census/records/{record_id}/promote",
        headers=headers,
        json={},
    )
    assert again.status_code == 200
    assert again.json()["already_promoted"] is True
    assert again.json()["citizen_id"] == body["citizen_id"]

    citizen = await client.get(
        f"/api/v1/registry/citizens/{body['citizen_id']}",
        headers=headers,
    )
    assert citizen.status_code == 200, citizen.text
    assert citizen.json()["given_names"] == f"Promo{suffix}"
    assert citizen.json()["nic"] == body["nic"]

    promoted = await client.get(
        f"/api/v1/census/campaigns/{campaign_id}/records",
        headers=headers,
        params={"status": "PROMOTED"},
    )
    assert any(r["id"] == record_id for r in promoted.json())

    await _push_and_approve(
        client, headers, campaign_id, agent_id, given=f"A{suffix}", family=f"Batch{suffix}"
    )
    await _push_and_approve(
        client, headers, campaign_id, agent_id, given=f"B{suffix}", family=f"Batch{suffix}"
    )

    batch = await client.post(
        f"/api/v1/census/campaigns/{campaign_id}/promote",
        headers=headers,
        json={"assign_nic": False, "limit": 10},
    )
    assert batch.status_code == 200, batch.text
    batch_body = batch.json()
    assert batch_body["promoted"] == 2
    assert batch_body["failed"] == 0
    assert all(r["citizen_id"] for r in batch_body["results"])
    assert all(r["nic"] is None for r in batch_body["results"])
