"""Phase 8 — Health domain (confidential schema `health`)."""

from apps.api.domains.health import models as models  # noqa: F401
from apps.api.domains.health.routes import router

__all__ = ["router", "models"]
