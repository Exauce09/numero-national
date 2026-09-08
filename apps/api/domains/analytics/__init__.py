"""Phase 9 — Analytics aggregates (no citizen PII in gov dashboards)."""

from apps.api.domains.analytics import models as models  # noqa: F401
from apps.api.domains.analytics.routes import router

__all__ = ["router", "models"]
