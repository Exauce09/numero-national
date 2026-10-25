"""Lot 3 — scénarios EC / décès / pas de suppression silencieuse (contrats)."""

from __future__ import annotations

from apps.api.domains.core_registry.enums import CitizenStatus


def test_deceased_status_exists_without_delete():
    assert CitizenStatus.DECEASED.value == "DECEASED"
    # Convention : décès = changement de statut, pas suppression mécanique.
    assert "MERGED" in {s.value for s in CitizenStatus}


def test_duplicate_act_helper_exists():
    from apps.api.domains.etat_civil import services as civil_services

    assert hasattr(civil_services, "find_duplicate_act")


def test_birth_rectification_death_status_vocabulary():
    """Vocabulaire attendu pour scénarios naissance / rectification / décès."""
    expected = {"DRAFT", "PENDING_VALIDATION", "ACTIVE", "DECEASED"}
    assert expected.issubset({s.value for s in CitizenStatus})
