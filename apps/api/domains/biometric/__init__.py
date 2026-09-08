"""Phase 6 — Biometric / ABIS vault (templates never in citizens table)."""

from apps.api.domains.biometric import models as models  # noqa: F401
from apps.api.domains.biometric.routes import router

__all__ = ["router", "models"]
