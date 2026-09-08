"""Phase 9 — Notifications (email/SMS/push stubs)."""

from apps.api.domains.notifications import models as models  # noqa: F401
from apps.api.domains.notifications.routes import router

__all__ = ["router", "models"]
