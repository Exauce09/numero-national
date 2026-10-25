"""Module 8 — Interconnexion état civil → FGP (réception idempotente, pas de NIN inventé)."""

from apps.api.domains.civil_interconnect.router import router

__all__ = ["router"]
