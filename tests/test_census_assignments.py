"""API tests — census zones, teams, agent assignments."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_census_zone_team_assignment_flow(client: AsyncClient) -> None:
    suffix = uuid.uuid4().hex[:8]
    admin_email = f"census.admin.{suffix}@example.gov"
    agent_email = f"census.agent.{suffix}@example.gov"
    password = "SecurePass123!"

    reg_admin = await client.post(
        "/api/v1/auth/register",
        json={
            "email": admin_email,
            "password": password,
            "full_name": "Census Admin",
            "role_codes": ["CENTRAL_ADMIN"],
        },
    )
    assert reg_admin.status_code in {201, 409}

    reg_agent = await client.post(
        "/api/v1/auth/register",
        json={
            "email": agent_email,
            "password": password,
            "full_name": "Census Agent",
            "role_codes": ["CENSUS_AGENT"],
        },
    )
    assert reg_agent.status_code in {201, 409}

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

    code = f"CAMP-{suffix}"
    camp = await client.post(
        "/api/v1/census/campaigns",
        headers=admin_headers,
        json={"code": code, "name": f"Campagne {suffix}"},
    )
    assert camp.status_code == 201, camp.text
    campaign_id = camp.json()["id"]

    await client.patch(
        f"/api/v1/census/campaigns/{campaign_id}",
        headers=admin_headers,
        json={"status": "ACTIVE"},
    )

    zone = await client.post(
        f"/api/v1/census/campaigns/{campaign_id}/zones",
        headers=admin_headers,
        json={
            "code": f"Z-{suffix}",
            "name": "Zone test",
            "province_code": "KIN",
            "commune_code": "GOMBE",
            "geo_level": "COMMUNE",
        },
    )
    assert zone.status_code == 201, zone.text
    zone_id = zone.json()["id"]

    team = await client.post(
        f"/api/v1/census/campaigns/{campaign_id}/teams",
        headers=admin_headers,
        json={"code": f"T-{suffix}", "name": "Equipe test", "zone_id": zone_id},
    )
    assert team.status_code == 201, team.text
    team_id = team.json()["id"]

    asn = await client.post(
        f"/api/v1/census/teams/{team_id}/assignments",
        headers=admin_headers,
        json={"agent_user_id": agent_id},
    )
    assert asn.status_code == 201, asn.text

    mine = await client.get("/api/v1/census/agents/me/assignments", headers=agent_headers)
    assert mine.status_code == 200, mine.text
    body = mine.json()
    assert len(body) >= 1
    assert body[0]["campaign"]["id"] == campaign_id
    assert body[0]["zone"]["id"] == zone_id
