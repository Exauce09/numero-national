"""Aggregator for Phase 4 (état civil) and Phase 5 (cards / documents / portal)."""

from __future__ import annotations

from fastapi import APIRouter

from apps.api.domains.cards.router import router as cards_router
from apps.api.domains.citizen_portal.router import router as citizen_portal_router
from apps.api.domains.documents.router import router as documents_router
from apps.api.domains.etat_civil.router import router as etat_civil_router

PHASE_4_5_ROUTERS = (
    etat_civil_router,
    cards_router,
    documents_router,
    citizen_portal_router,
)


def include_phase_4_5(api: APIRouter) -> None:
    """Mount Phase 4–5 routers onto an APIRouter (flat include)."""
    for router in PHASE_4_5_ROUTERS:
        api.include_router(router)


# Back-compat alias: prefer include_phase_4_5 / PHASE_4_5_ROUTERS for mounting.
civil_cards_router = etat_civil_router

__all__ = [
    "PHASE_4_5_ROUTERS",
    "include_phase_4_5",
    "civil_cards_router",
    "etat_civil_router",
    "cards_router",
    "documents_router",
    "citizen_portal_router",
]
