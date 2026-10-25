"""Module 4 — cycle de vie campagne (enum existant, sans duplication de tables).

Mapping cahier → CampaignStatus :
  BROUILLON / A_APPROUVER / PLANIFIEE → DRAFT
  ACTIVE → ACTIVE
  SUSPENDUE → PAUSED
  EN_CLOTURE / CLOTUREE / ANNULEE → CLOSED
"""

from __future__ import annotations

from apps.api.domains.recensement.models import CampaignStatus

PLAN_TO_STATUS: dict[str, str] = {
    "brouillon": CampaignStatus.DRAFT.value,
    "a_approuver": CampaignStatus.DRAFT.value,
    "planifiee": CampaignStatus.DRAFT.value,
    "active": CampaignStatus.ACTIVE.value,
    "suspendue": CampaignStatus.PAUSED.value,
    "en_cloture": CampaignStatus.CLOSED.value,
    "cloturee": CampaignStatus.CLOSED.value,
    "annulee": CampaignStatus.CLOSED.value,
}

PLAN_LABELS_FR: dict[str, str] = {
    CampaignStatus.DRAFT.value: "Brouillon / planifiée",
    CampaignStatus.ACTIVE.value: "Active — collecte autorisée",
    CampaignStatus.PAUSED.value: "Suspendue",
    CampaignStatus.CLOSED.value: "Clôturée / annulée",
}

ALLOWED_CAMPAIGN_TRANSITIONS: dict[str, frozenset[str]] = {
    CampaignStatus.DRAFT.value: frozenset(
        {CampaignStatus.ACTIVE.value, CampaignStatus.CLOSED.value}
    ),
    CampaignStatus.ACTIVE.value: frozenset(
        {CampaignStatus.PAUSED.value, CampaignStatus.CLOSED.value}
    ),
    CampaignStatus.PAUSED.value: frozenset(
        {CampaignStatus.ACTIVE.value, CampaignStatus.CLOSED.value}
    ),
    CampaignStatus.CLOSED.value: frozenset(),  # terminal — réouverture exceptionnelle hors API
}


def can_transition_campaign(current: str, target: str) -> bool:
    if current == target:
        return True
    return target in ALLOWED_CAMPAIGN_TRANSITIONS.get(current, frozenset())


def assert_campaign_transition(current: str, target: str) -> None:
    cur = (current or "").strip().upper()
    tgt = (target or "").strip().upper()
    if not can_transition_campaign(cur, tgt):
        raise ValueError("invalid_campaign_transition")


def campaign_accepts_sync(status: str) -> bool:
    """Sync terrain uniquement si campagne ACTIVE (cahier §9 / §4.2)."""
    return (status or "").strip().upper() == CampaignStatus.ACTIVE.value


def campaign_status_catalog() -> dict[str, object]:
    return {
        "module": 4,
        "title": "Recensement et campagnes",
        "source": "recensement.CampaignStatus",
        "map_plan_fr": PLAN_TO_STATUS,
        "labels": PLAN_LABELS_FR,
        "transitions": {k: sorted(v) for k, v in ALLOWED_CAMPAIGN_TRANSITIONS.items()},
        "sync_only_when_active": True,
        "offline_nin_forbidden": True,
        "auto_merge_forbidden": True,
        "endpoints": {
            "campaigns": "GET|POST /api/v1/census/campaigns",
            "update": "PATCH /api/v1/census/campaigns/{id}",
            "zones": "GET|POST /api/v1/census/campaigns/{id}/zones",
            "teams": "GET|POST /api/v1/census/campaigns/{id}/teams",
            "assignments": "GET|POST /api/v1/census/teams/{id}/assignments",
            "sync_batches": "GET /api/v1/census/campaigns/{id}/sync-batches",
            "stats": "GET /api/v1/census/campaigns/{id}/stats",
            "export": "GET /api/v1/census/campaigns/{id}/export.csv",
        },
        "note": "Collecte terrain ≠ validation identité / NIN. Sync bloquée si PAUSED ou CLOSED.",
    }
