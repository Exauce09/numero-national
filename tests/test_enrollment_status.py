"""Lot 2 — mapping statuts enrôlement + transitions."""

from __future__ import annotations

from apps.api.domains.recensement.enrollment_status import (
    can_transition,
    enrollment_status_catalog,
    plan_label,
)
from apps.api.domains.recensement.models import CensusRecordStatus


def test_catalog_forbids_offline_nin():
    cat = enrollment_status_catalog()
    assert cat["offline_nin_forbidden"] is True
    assert cat["map_plan_fr"]["valide"] == CensusRecordStatus.APPROVED.value


def test_plan_labels_cover_enum():
    for st in CensusRecordStatus:
        assert plan_label(st.value)


def test_approved_to_promoted_allowed():
    assert can_transition(
        CensusRecordStatus.APPROVED.value, CensusRecordStatus.PROMOTED.value
    )
    assert not can_transition(
        CensusRecordStatus.DRAFT.value, CensusRecordStatus.PROMOTED.value
    )


def test_promote_idempotence_contract():
    """Contrat métier : second promote doit signaler already_promoted (service)."""
    # Vérifie que le schéma PromoteResult expose le flag (pas de DB ici).
    from apps.api.domains.recensement.schemas import PromoteResult

    fields = PromoteResult.model_fields
    assert "already_promoted" in fields
