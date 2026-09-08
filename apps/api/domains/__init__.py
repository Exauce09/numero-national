"""Domain packages for the National Identity System.

Phases 3, 6–9 export routers here. Sibling phase packages (identity,
core_registry, etat_civil, cards, …) are mounted via soft-import in
`apps.api.api.v1_router`.
"""

from apps.api.domains.analytics.routes import router as analytics_router
from apps.api.domains.analytics.verify_routes import router as identity_verify_router
from apps.api.domains.biometric.routes import router as biometric_router
from apps.api.domains.health.routes import router as health_domain_router
from apps.api.domains.notifications.routes import router as notifications_router
from apps.api.domains.onip.routes import router as onip_router
from apps.api.domains.recensement.routes import router as census_router

PHASE_3_6_9_ROUTERS = (
    census_router,
    biometric_router,
    onip_router,
    health_domain_router,
    analytics_router,
    identity_verify_router,
    notifications_router,
)

__all__ = [
    "PHASE_3_6_9_ROUTERS",
    "census_router",
    "biometric_router",
    "onip_router",
    "health_domain_router",
    "analytics_router",
    "identity_verify_router",
    "notifications_router",
]
