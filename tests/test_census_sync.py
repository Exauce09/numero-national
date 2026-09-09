"""API tests — census sync push/pull and version conflicts."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


async def _bootstrap_campaign(client: AsyncClient) -> tuple[dict[str, str], str, str]:
    suffix = uuid.uuid4().hex[:8]
    email = f"sync.agent.{suffix}@example.gov"
    password = "SecurePass123!"

    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Sync Agent",
            "role_codes": ["CENSUS_AGENT", "CENTRAL_ADMIN"],
        },
    )
    assert reg.status_code in {201, 409}, reg.text

    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    me = await client.get("/api/v1/auth/me", headers=headers)
    agent_id = me.json()["id"]

    camp = await client.post(
        "/api/v1/census/campaigns",
        headers=headers,
        json={"code": f"SYNC-{suffix}", "name": f"Sync {suffix}"},
    )
    assert camp.status_code == 201, camp.text
    campaign_id = camp.json()["id"]
    await client.patch(
        f"/api/v1/census/campaigns/{campaign_id}",
        headers=headers,
        json={"status": "ACTIVE"},
    )
    return headers, campaign_id, agent_id


@pytest.mark.asyncio
async def test_sync_push_pull_conflicts_and_force(client: AsyncClient) -> None:
    """Single session covers accept, pull fields, stale conflict, force, missing HH."""
    headers, campaign_id, agent_id = await _bootstrap_campaign(client)
    device_uid = f"device-{uuid.uuid4().hex[:10]}"
    hh_local = f"hh-{uuid.uuid4().hex[:8]}"
    rec_local = f"rec-{uuid.uuid4().hex[:8]}"

    push = await client.post(
        "/api/v1/census/sync/push",
        headers=headers,
        json={
            "device_uid": device_uid,
            "agent_user_id": agent_id,
            "campaign_id": campaign_id,
            "items": [
                {
                    "entity_type": "household",
                    "local_id": hh_local,
                    "version": 1,
                    "data": {
                        "address_line": "Av. Liberation 12",
                        "latitude": -4.32,
                        "longitude": 15.31,
                        "member_count": 1,
                    },
                },
                {
                    "entity_type": "census_record",
                    "local_id": rec_local,
                    "version": 2,
                    "data": {
                        "household_local_id": hh_local,
                        "given_names": "Jean",
                        "family_name": "Mbala",
                        "sex": "M",
                        "date_of_birth": "1990-01-15",
                    },
                },
            ],
        },
    )
    assert push.status_code == 200, push.text
    body = push.json()
    assert body["accepted"] == 2
    assert body["conflicts"] == 0

    pull = await client.post(
        "/api/v1/census/sync/pull",
        headers=headers,
        json={"device_uid": device_uid, "campaign_id": campaign_id},
    )
    assert pull.status_code == 200, pull.text
    pulled = pull.json()
    assert any(h["local_id"] == hh_local and h.get("campaign_id") == campaign_id for h in pulled["households"])
    rec = next(r for r in pulled["records"] if r["local_id"] == rec_local)
    assert rec["household_local_id"] == hh_local
    assert rec["campaign_id"] == campaign_id
    assert rec["version"] == 2

    stale = await client.post(
        "/api/v1/census/sync/push",
        headers=headers,
        json={
            "device_uid": device_uid,
            "agent_user_id": agent_id,
            "campaign_id": campaign_id,
            "items": [
                {
                    "entity_type": "census_record",
                    "local_id": rec_local,
                    "version": 1,
                    "data": {
                        "household_local_id": hh_local,
                        "given_names": "Stale",
                        "family_name": "Client",
                    },
                },
            ],
        },
    )
    assert stale.status_code == 200, stale.text
    conflict = stale.json()
    assert conflict["conflicts"] == 1
    detail = conflict["details"][0]
    assert detail["reason"] == "stale_version"
    assert detail["server_version"] == 2
    assert detail["server"]["given_names"] == "Jean"

    forced = await client.post(
        "/api/v1/census/sync/push",
        headers=headers,
        json={
            "device_uid": device_uid,
            "agent_user_id": agent_id,
            "campaign_id": campaign_id,
            "items": [
                {
                    "entity_type": "census_record",
                    "local_id": rec_local,
                    "version": 3,
                    "data": {
                        "household_local_id": hh_local,
                        "given_names": "Forced",
                        "family_name": "Local",
                    },
                },
            ],
        },
    )
    assert forced.status_code == 200, forced.text
    assert forced.json()["accepted"] == 1
    assert forced.json()["conflicts"] == 0

    orphan = await client.post(
        "/api/v1/census/sync/push",
        headers=headers,
        json={
            "device_uid": device_uid,
            "agent_user_id": agent_id,
            "campaign_id": campaign_id,
            "items": [
                {
                    "entity_type": "census_record",
                    "local_id": f"orphan-{uuid.uuid4().hex[:8]}",
                    "version": 1,
                    "data": {
                        "household_local_id": "missing-hh",
                        "given_names": "Orphan",
                        "family_name": "Record",
                    },
                },
            ],
        },
    )
    assert orphan.status_code == 200, orphan.text
    assert orphan.json()["details"][0]["reason"] == "missing_household"
