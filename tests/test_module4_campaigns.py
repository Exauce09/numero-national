"""Module 4 — cycle de vie campagnes + sync ACTIVE-only."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from apps.api.domains.recensement.campaign_lifecycle import (
    assert_campaign_transition,
    campaign_accepts_sync,
    campaign_status_catalog,
    can_transition_campaign,
)
from apps.api.domains.recensement.models import CampaignStatus
from apps.api.domains.recensement.schemas import CampaignStatsOut, CampaignUpdate


def test_catalog_module4():
    cat = campaign_status_catalog()
    assert cat["module"] == 4
    assert cat["sync_only_when_active"] is True
    assert cat["offline_nin_forbidden"] is True
    assert cat["auto_merge_forbidden"] is True
    assert "transitions" in cat


def test_draft_to_active_allowed():
    assert can_transition_campaign(
        CampaignStatus.DRAFT.value, CampaignStatus.ACTIVE.value
    )


def test_closed_is_terminal():
    assert not can_transition_campaign(
        CampaignStatus.CLOSED.value, CampaignStatus.ACTIVE.value
    )
    with pytest.raises(ValueError, match="invalid_campaign_transition"):
        assert_campaign_transition(
            CampaignStatus.CLOSED.value, CampaignStatus.ACTIVE.value
        )


def test_paused_can_resume():
    assert can_transition_campaign(
        CampaignStatus.PAUSED.value, CampaignStatus.ACTIVE.value
    )


def test_sync_only_when_active():
    assert campaign_accepts_sync(CampaignStatus.ACTIVE.value)
    assert not campaign_accepts_sync(CampaignStatus.DRAFT.value)
    assert not campaign_accepts_sync(CampaignStatus.PAUSED.value)
    assert not campaign_accepts_sync(CampaignStatus.CLOSED.value)


@pytest.mark.asyncio
async def test_update_campaign_blocks_illegal_transition(monkeypatch):
    from apps.api.domains.recensement import service as svc

    campaign = MagicMock()
    campaign.status = CampaignStatus.CLOSED

    with pytest.raises(ValueError, match="invalid_campaign_transition"):
        await svc.update_campaign(
            MagicMock(),
            campaign,
            CampaignUpdate(status=CampaignStatus.ACTIVE),
        )


@pytest.mark.asyncio
async def test_sync_push_rejects_inactive_campaign(monkeypatch):
    from apps.api.domains.recensement import service as svc
    from apps.api.domains.recensement.schemas import SyncPushRequest

    camp = MagicMock()
    camp.status = CampaignStatus.PAUSED

    async def fake_get(_db, _id):
        return camp

    monkeypatch.setattr(svc, "get_campaign", fake_get)
    with pytest.raises(ValueError, match="campaign_not_active"):
        await svc.sync_push(
            MagicMock(),
            SyncPushRequest(
                device_uid="dev-test-1234",
                campaign_id=uuid4(),
                items=[],
            ),
        )


def test_stats_schema_has_coverage_fields():
    fields = CampaignStatsOut.model_fields
    assert "coverage_percent" in fields
    assert "zones_count" in fields
    assert "sync_batches_recent" in fields
