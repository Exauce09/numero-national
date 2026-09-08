"""Phase 3 — Recensement (census) field operations & sync."""

from apps.api.domains.recensement import models as models  # noqa: F401
from apps.api.domains.recensement.routes import router

__all__ = ["router", "models"]
