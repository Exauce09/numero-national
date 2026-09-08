"""API v1 router aggregator — include domain routers here for main.py."""

from fastapi import APIRouter

from apps.api.api.routes import health
from apps.api.api.routers_civil_cards import include_phase_4_5
from apps.api.domains.core_registry.router import router as registry_router

api_router = APIRouter()
api_router.include_router(health.router)

_v1 = APIRouter(prefix="/api/v1")
_v1.include_router(registry_router)
include_phase_4_5(_v1)
api_router.include_router(_v1)
