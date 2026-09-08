"""Phase 5 — Citizen self-service portal API."""

from apps.api.domains.citizen_portal.router import router as citizen_portal_router

__all__ = ["citizen_portal_router"]
