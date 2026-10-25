"""Alignement statuts d'enrôlement (plan ONIP) ↔ recensement existant.

Ne duplique pas les tables : réutilise CensusRecordStatus.
Interdiction : aucun NIN définitif offline.
"""

from __future__ import annotations

from apps.api.domains.recensement.models import CensusRecordStatus

# Plan module 3 → enum recensement
ENROLLMENT_STATUS_MAP: dict[str, str] = {
    "brouillon": CensusRecordStatus.DRAFT.value,
    "soumis": CensusRecordStatus.QUEUED.value,
    "synchronise": CensusRecordStatus.SYNCED.value,
    "a_completer": CensusRecordStatus.CONFLICT.value,
    "doublon_potentiel": CensusRecordStatus.CONFLICT.value,
    "en_validation": CensusRecordStatus.SYNCED.value,
    "valide": CensusRecordStatus.APPROVED.value,
    "rejete": CensusRecordStatus.REJECTED.value,
    "promu_fgp": CensusRecordStatus.PROMOTED.value,
}

PLAN_LABELS_FR: dict[str, str] = {
    CensusRecordStatus.DRAFT.value: "Brouillon",
    CensusRecordStatus.QUEUED.value: "Soumis / file sync",
    CensusRecordStatus.SYNCED.value: "Synchronisé — en contrôle",
    CensusRecordStatus.CONFLICT.value: "Conflit / doublon / à compléter",
    CensusRecordStatus.APPROVED.value: "Validé (recensement)",
    CensusRecordStatus.REJECTED.value: "Rejeté",
    CensusRecordStatus.PROMOTED.value: "Promu FGP (réf. interne)",
}

# Transitions autorisées (contrôle léger — permissions restent côté routes)
ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    CensusRecordStatus.DRAFT.value: frozenset(
        {CensusRecordStatus.QUEUED.value, CensusRecordStatus.SYNCED.value}
    ),
    CensusRecordStatus.QUEUED.value: frozenset(
        {
            CensusRecordStatus.SYNCED.value,
            CensusRecordStatus.CONFLICT.value,
            CensusRecordStatus.REJECTED.value,
        }
    ),
    CensusRecordStatus.SYNCED.value: frozenset(
        {
            CensusRecordStatus.APPROVED.value,
            CensusRecordStatus.REJECTED.value,
            CensusRecordStatus.CONFLICT.value,
        }
    ),
    CensusRecordStatus.CONFLICT.value: frozenset(
        {
            CensusRecordStatus.SYNCED.value,
            CensusRecordStatus.APPROVED.value,
            CensusRecordStatus.REJECTED.value,
            CensusRecordStatus.QUEUED.value,
        }
    ),
    CensusRecordStatus.APPROVED.value: frozenset(
        {
            CensusRecordStatus.PROMOTED.value,
            CensusRecordStatus.REJECTED.value,  # annulation contrôle avant promote
        }
    ),
    CensusRecordStatus.REJECTED.value: frozenset(
        {
            CensusRecordStatus.SYNCED.value,  # reprise revue
            CensusRecordStatus.APPROVED.value,
        }
    ),
    CensusRecordStatus.PROMOTED.value: frozenset(),
}


def plan_label(status: str) -> str:
    return PLAN_LABELS_FR.get(status, status)


def can_transition(current: str, target: str) -> bool:
    return target in ALLOWED_TRANSITIONS.get(current, frozenset())


def enrollment_status_catalog() -> dict[str, object]:
    return {
        "module": 3,
        "title": "Enrôlement de la population",
        "source": "recensement.CensusRecordStatus",
        "map_plan_fr": ENROLLMENT_STATUS_MAP,
        "labels": PLAN_LABELS_FR,
        "transitions": {k: sorted(v) for k, v in ALLOWED_TRANSITIONS.items()},
        "offline_nin_forbidden": True,
        "auto_merge_forbidden": True,
        "endpoints": {
            "list_records": "GET /api/v1/census/campaigns/{id}/records",
            "approve": "POST /api/v1/census/records/{id}/approve",
            "reject": "POST /api/v1/census/records/{id}/reject",
            "promote": "POST /api/v1/census/records/{id}/promote",
            "batch_promote": "POST /api/v1/census/campaigns/{id}/promote",
            "sync_push": "POST /api/v1/census/sync/push",
            "sync_pull": "POST /api/v1/census/sync/pull",
        },
        "note": "NIN définitif uniquement via service central après validation — jamais offline. "
        "Collecte = CensusRecord ; identité FGP = promote (Module 2).",
    }


def assert_transition(current: str, target: str) -> None:
    """Lève ValueError('invalid_transition') si transition interdite (RB-10 Module 3)."""
    cur = (current or "").strip().upper()
    tgt = (target or "").strip().upper()
    if not can_transition(cur, tgt):
        raise ValueError("invalid_transition")
