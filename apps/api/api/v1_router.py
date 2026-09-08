"""Aggregate API v1 routers for all domains.

Soft-imports sibling phase routers when packages are present.
Phases 3/6–9 are mounted via PHASE_3_6_9_ROUTERS (single include).
"""

from __future__ import annotations

import importlib
import logging

from fastapi import APIRouter

from apps.api.core.config import get_settings
from apps.api.domains import PHASE_3_6_9_ROUTERS

logger = logging.getLogger(__name__)

# Sibling phases (1.6+, 2, 4–5) — soft import only.
_OPTIONAL_ROUTERS: tuple[tuple[str, str], ...] = (
    ("apps.api.domains.identity.routes", "auth_router"),
    ("apps.api.domains.identity.routes", "institutions_router"),
    ("apps.api.domains.identity.routes", "rbac_router"),
    ("apps.api.domains.audit.routes", "router"),
    ("apps.api.domains.interop.routes", "router"),
    ("apps.api.domains.core_registry.router", "router"),
    ("apps.api.domains.geography.routes", "router"),
)


def _try_include(api: APIRouter, module_path: str, attr: str) -> None:
    try:
        mod = importlib.import_module(module_path)
        router = getattr(mod, attr)
        api.include_router(router)
        logger.info("Mounted optional router %s.%s", module_path, attr)
    except Exception as exc:
        logger.debug("Optional router skipped %s: %s", module_path, exc)


def build_v1_router() -> APIRouter:
    settings = get_settings()
    api = APIRouter(prefix=settings.api_v1_prefix)

    for module_path, attr in _OPTIONAL_ROUTERS:
        _try_include(api, module_path, attr)

    # Phase 4–5 — flat mount helper when present
    try:
        from apps.api.api.routers_civil_cards import include_phase_4_5

        include_phase_4_5(api)
        logger.info("Mounted Phase 4–5 civil/cards/documents/portal routers")
    except Exception as exc:
        logger.debug("Phase 4–5 routers not mounted: %s", exc)
        for module_path, attr in (
            ("apps.api.domains.etat_civil.router", "router"),
            ("apps.api.domains.cards.router", "router"),
            ("apps.api.domains.documents.router", "router"),
            ("apps.api.domains.citizen_portal.router", "router"),
        ):
            _try_include(api, module_path, attr)

    for router in PHASE_3_6_9_ROUTERS:
        api.include_router(router)

    return api


v1_router = build_v1_router()
